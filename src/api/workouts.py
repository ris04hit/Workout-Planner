"""
Workout Management API Endpoints

Handles workout suggestion, creation, update, deletion, and history.
"""

from flask import jsonify, request
from datetime import date
import math

from core_logic import (
    select_workout, get_effective_config, score_exercise_breakdown, is_exercise_valid,
    compute_fatigue_from_history, compute_weekly_load_from_history
)
from storage import (
    get_workouts, add_workout, update_workout, delete_workout,
    get_exercise_progress, get_today_workout,
    get_current_user, set_current_user,
    get_soreness, get_config, get_exercises
)


def register_workout_routes(app):
    """Register all workout-related routes with the Flask app."""

    def _set_user(req):
        username = req.args.get('user') or get_current_user()
        if username:
            set_current_user(username)

    def _get_history_names(config: dict, workouts: list) -> list:
        """Return exercise names from the last N workouts for repetition penalty."""
        n = int(config.get("scoring", {}).get("recency_history_sessions", 2))
        names = []
        for w in workouts[-n:]:
            names.extend(e.get("name") for e in w.get("exercises", []))
        return names

    def _get_last_done_days(workouts: list) -> dict:
        """Return {exercise_name: days_since_last_done} across all history."""
        today = date.today()
        last_done: dict = {}
        for w in sorted(workouts, key=lambda x: x.get("date", ""), reverse=True):
            try:
                workout_date = date.fromisoformat(w["date"])
            except (KeyError, ValueError):
                continue
            days_ago = (today - workout_date).days
            for ex in w.get("exercises", []):
                name = ex.get("name")
                if name and name not in last_done:
                    last_done[name] = days_ago
        return last_done

    def _group_by_pattern(exercises: list) -> dict:
        """Group selected exercises by their pattern for the frontend."""
        grouped = {}
        for ex in exercises:
            p = ex.get("pattern", "ACCESSORY")
            grouped.setdefault(p, []).append(ex)
        return grouped

    def _sanitize(value):
        """Convert non-JSON-serialisable floats to None."""
        if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
            return None
        return value

    def _validate_workout_payload(data):
        """Validate a workout POST/PUT payload."""
        if not isinstance(data, dict):
            return "Invalid request body"
        exercises = data.get("exercises", [])
        if not isinstance(exercises, list) or not exercises:
            return "Workout must include at least one exercise"
        for ex in exercises:
            if not isinstance(ex, dict):
                return "Each exercise must be an object"
            if not isinstance(ex.get("name"), str) or not ex["name"].strip():
                return "Exercise name is required"
            mode = ex.get("mode")
            if mode not in {"reps", "time"}:
                return "Exercise mode must be 'reps' or 'time'"
            sets = ex.get("sets", [])
            if not isinstance(sets, list):
                return "Exercise sets must be a list"
            for s in sets:
                if not isinstance(s, dict):
                    return "Each set must be an object"
                weight = s.get("weight")
                if weight is not None and (not isinstance(weight, (int, float)) or weight < 0):
                    return "Set weight must be a non-negative number"
                if mode == "reps":
                    reps = s.get("reps")
                    if not isinstance(reps, int) or reps <= 0:
                        return "Reps must be a positive integer"
                else:
                    dur = s.get("duration_sec")
                    if not isinstance(dur, int) or dur <= 0:
                        return "Duration must be a positive integer"
        return None

    # ------------------------------------------------------------------
    # GET /api/suggest
    # ------------------------------------------------------------------

    @app.route("/api/suggest", methods=["GET"])
    def suggest():
        """
        Get today's workout suggestion.

        Response:
        {
          "exercises": [ { name, pattern, family, muscles, difficulty, priority, ... } ],
          "grouped_by_pattern": { "PUSH": [...], "PULL": [...], ... },
          "fatigue": { muscle: float },
          "weekly_load": { muscle: float }
        }
        """
        _set_user(request)

        config = get_effective_config(get_config())
        workouts = get_workouts()
        exercises = get_exercises()
        fatigue = compute_fatigue_from_history(workouts, config, exercise_defs=exercises)
        weekly_load = compute_weekly_load_from_history(workouts, exercise_defs=exercises)
        sore = get_soreness()
        history = _get_history_names(config, workouts)

        last_done_days = _get_last_done_days(workouts)
        selected = select_workout(fatigue, weekly_load, sore, history, exercises, config, last_done_days)

        scored = []
        for ex in selected:
            bd = score_exercise_breakdown(ex, fatigue, weekly_load, sore, history, config)
            scored.append({**ex, "_score": bd["total"], "_score_breakdown": bd})

        selected_names = {ex["name"] for ex in scored}

        all_scores = []
        for ex in exercises:
            if not ex.get("enabled", True):
                continue
            bd = score_exercise_breakdown(ex, fatigue, weekly_load, sore, history, config)
            blocked = not is_exercise_valid(ex, fatigue, sore, config)
            all_scores.append({
                "name":             ex["name"],
                "pattern":          ex.get("pattern", "ACCESSORY"),
                "muscles":          ex.get("muscles", {}),
                "difficulty":       ex.get("difficulty"),
                "_score":           bd["total"],
                "_score_breakdown": bd,
                "_selected":        ex["name"] in selected_names,
                "_blocked":         blocked,
            })
        all_scores.sort(key=lambda x: (x["_blocked"], -x["_score"]))

        today_workout = get_today_workout()
        return jsonify({
            "exercises":          scored,
            "grouped_by_pattern": _group_by_pattern(scored),
            "all_scores":         all_scores,
            "fatigue":            {m: round(v, 4) for m, v in fatigue.items()},
            "weekly_load":        {m: round(v, 4) for m, v in weekly_load.items()},
            "already_done_today": today_workout is not None,
            "today_workout_id":   today_workout.get("id") if today_workout else None,
        })

    # ------------------------------------------------------------------
    # GET+POST /api/workout
    # ------------------------------------------------------------------

    @app.route("/api/workout", methods=["GET", "POST"])
    def workout():
        """Get workout history or save a new workout."""
        _set_user(request)

        if request.method == "GET":
            return jsonify(get_workouts())

        data = request.json
        error = _validate_workout_payload(data)
        if error:
            return jsonify({"error": error}), 400

        if not data.get("force"):
            existing = get_today_workout()
            if existing:
                return jsonify({
                    "status": "already_done",
                    "error": "Workout already logged for today.",
                    "today_workout_id": existing.get("id")
                }), 409

        try:
            result = add_workout({"exercises": data["exercises"]})
            return jsonify(result)
        except ValueError as e:
            return jsonify({"status": "duplicate", "error": str(e)}), 409
        except Exception as e:
            return jsonify({"error": "Failed to save workout", "details": str(e)}), 500

    # ------------------------------------------------------------------
    # PUT /api/workout/<id>
    # ------------------------------------------------------------------

    @app.route("/api/workout/<workout_id>", methods=["PUT"])
    def update_workout_endpoint(workout_id):
        """Update exercises of an existing workout."""
        _set_user(request)

        data = request.json
        error = _validate_workout_payload(data)
        if error:
            return jsonify({"error": error}), 400

        try:
            result = update_workout(workout_id, data["exercises"])
            return jsonify(result)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            return jsonify({"error": "Failed to update workout", "details": str(e)}), 500

    # ------------------------------------------------------------------
    # DELETE /api/workout/<id>
    # ------------------------------------------------------------------

    @app.route("/api/workout/<workout_id>", methods=["DELETE"])
    def delete_workout_endpoint(workout_id):
        """Delete a workout."""
        _set_user(request)

        try:
            delete_workout(workout_id)
            return jsonify({"status": "ok"})
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            return jsonify({"error": "Failed to delete workout"}), 500

    # ------------------------------------------------------------------
    # GET /api/history
    # ------------------------------------------------------------------

    @app.route("/api/history", methods=["GET"])
    def history():
        """Get full workout history."""
        _set_user(request)
        return jsonify(get_workouts())

    # ------------------------------------------------------------------
    # GET /api/fatigue   DELETE /api/fatigue
    # ------------------------------------------------------------------

    @app.route("/api/fatigue", methods=["GET"])
    def get_fatigue_endpoint():
        """Get current per-muscle fatigue computed from workout history."""
        _set_user(request)
        config = get_effective_config(get_config())
        exercises = get_exercises()
        fatigue = compute_fatigue_from_history(get_workouts(), config, exercise_defs=exercises)
        return jsonify(fatigue)

    # ------------------------------------------------------------------
    # GET /api/progress/<exercise_name>
    # ------------------------------------------------------------------

    @app.route("/api/progress/<exercise_name>", methods=["GET"])
    def exercise_progress(exercise_name):
        """Get personal best and last performance for an exercise."""
        _set_user(request)
        return jsonify(get_exercise_progress(exercise_name))
