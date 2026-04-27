"""
Exercises and Soreness API Endpoints

Handles exercise list management (flat list) and per-muscle soreness tracking.
"""

from flask import jsonify, request
from storage import (
    get_exercises, save_exercises, get_soreness, save_soreness,
    get_current_user, set_current_user, get_all_muscle_names
)


def register_exercises_routes(app):
    """Register exercise and soreness routes with the Flask app."""

    def _set_user(req):
        username = req.args.get('user') or get_current_user()
        if username:
            set_current_user(username)

    # ------------------------------------------------------------------
    # GET /api/exercises  — full exercise list
    # PUT /api/exercises  — replace entire exercise list
    # ------------------------------------------------------------------

    @app.route("/api/exercises", methods=["GET"])
    def get_exercises_endpoint():
        """Get the full exercise list."""
        _set_user(request)
        return jsonify(get_exercises())

    @app.route("/api/exercises", methods=["PUT"])
    def replace_exercises():
        """Replace the entire exercise list."""
        _set_user(request)
        data = request.json
        if not isinstance(data, list):
            return jsonify({"error": "Expected a JSON array of exercises"}), 400
        save_exercises(data)
        return jsonify({"status": "ok", "exercises": get_exercises()})

    # ------------------------------------------------------------------
    # POST /api/exercises — add a single exercise
    # ------------------------------------------------------------------

    @app.route("/api/exercises", methods=["POST"])
    def add_exercise():
        """Add a new exercise to the list."""
        _set_user(request)
        data = request.json
        error = _validate_exercise(data)
        if error:
            return jsonify({"error": error}), 400

        exercises = get_exercises()
        if any(e["name"] == data["name"] for e in exercises):
            return jsonify({"error": f"Exercise '{data['name']}' already exists"}), 409

        exercises.append(data)
        save_exercises(exercises)
        return jsonify({"status": "ok", "exercise": data}), 201

    # ------------------------------------------------------------------
    # PUT /api/exercises/<name> — update a single exercise
    # DELETE /api/exercises/<name> — delete a single exercise
    # ------------------------------------------------------------------

    @app.route("/api/exercises/<exercise_name>", methods=["PUT"])
    def update_exercise(exercise_name):
        """Update an existing exercise by name."""
        _set_user(request)
        data = request.json
        exercises = get_exercises()
        for i, ex in enumerate(exercises):
            if ex["name"] == exercise_name:
                exercises[i] = {**ex, **data, "name": exercise_name}
                save_exercises(exercises)
                return jsonify({"status": "ok", "exercise": exercises[i]})
        return jsonify({"error": f"Exercise '{exercise_name}' not found"}), 404

    @app.route("/api/exercises/<exercise_name>", methods=["DELETE"])
    def delete_exercise(exercise_name):
        """Delete an exercise by name."""
        _set_user(request)
        exercises = get_exercises()
        new_list = [e for e in exercises if e["name"] != exercise_name]
        if len(new_list) == len(exercises):
            return jsonify({"error": f"Exercise '{exercise_name}' not found"}), 404
        save_exercises(new_list)
        return jsonify({"status": "ok"})

    # ------------------------------------------------------------------
    # GET /api/soreness
    # POST /api/soreness
    # ------------------------------------------------------------------

    @app.route("/api/soreness", methods=["GET"])
    def get_soreness_endpoint():
        """Get per-muscle soreness state."""
        _set_user(request)
        return jsonify(get_soreness())

    @app.route("/api/soreness", methods=["POST"])
    def save_soreness_endpoint():
        """Update per-muscle soreness state."""
        _set_user(request)
        data = request.json
        if not isinstance(data, dict):
            return jsonify({"error": "Expected a JSON object"}), 400
        valid_muscles = set(get_all_muscle_names())
        for muscle in data:
            if muscle not in valid_muscles:
                return jsonify({"error": f"Unknown muscle: {muscle}"}), 400
            if not isinstance(data[muscle], bool):
                return jsonify({"error": f"soreness[{muscle}] must be a boolean"}), 400
        save_soreness(data)
        return jsonify({"soreness": get_soreness()})


def _validate_exercise(data: dict) -> str:
    """Return an error string if the exercise dict is invalid, else None."""
    if not isinstance(data, dict):
        return "Exercise must be an object"
    if not isinstance(data.get("name"), str) or not data["name"].strip():
        return "Exercise name is required"
    if not isinstance(data.get("muscles"), dict) or not data["muscles"]:
        return "muscles must be a non-empty object mapping muscle names to contribution floats"
    for muscle, c in data["muscles"].items():
        if not isinstance(c, (int, float)) or not (0 < c <= 1):
            return f"muscles[{muscle}] contribution must be a float in (0, 1]"
    if "difficulty" in data and (not isinstance(data["difficulty"], int) or not 1 <= data["difficulty"] <= 5):
        return "difficulty must be an integer 1–5"
    if "priority" in data and (not isinstance(data["priority"], int) or not 1 <= data["priority"] <= 5):
        return "priority must be an integer 1–5"
    valid_patterns = {"SQUAT", "HINGE", "PUSH", "PULL", "CORE", "ACCESSORY"}
    if "pattern" in data and data["pattern"] not in valid_patterns:
        return f"pattern must be one of: {', '.join(sorted(valid_patterns))}"
    return None
