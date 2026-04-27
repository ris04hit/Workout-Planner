"""
Unit tests for api/workouts.py — exercise-based workout endpoints.
"""
import os
import json
import tempfile
import unittest
import storage
import storage.base
from app import app as workout_app


GOOD_WORKOUT = {
    "exercises": [
        {"name": "Squat", "pattern": "SQUAT", "family": "SQUAT",
         "muscles": {"QUADS": 0.8, "GLUTES": 0.6},
         "mode": "reps", "sets": [{"reps": 5, "weight": 100}]}
    ]
}


class TestWorkoutsAPI(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.orig = storage.base.DATA_DIR
        storage.base.DATA_DIR = self.tmp.name
        os.makedirs(os.path.join(self.tmp.name, "default"), exist_ok=True)
        os.makedirs(os.path.join(self.tmp.name, "users"), exist_ok=True)
        storage.set_current_user(None)
        workout_app.testing = True
        self.client = workout_app.test_client()

    def tearDown(self):
        storage.base.DATA_DIR = self.orig
        storage.set_current_user(None)
        self.tmp.cleanup()

    def _write_default(self, filename, data):
        path = os.path.join(self.tmp.name, "default", filename)
        with open(path, "w") as f:
            json.dump(data, f)

    def _setup_defaults(self):
        exercises = [
            {"name": "Squat", "enabled": True, "difficulty": 3, "priority": 5,
             "pattern": "SQUAT", "family": "SQUAT", "muscles": {"QUADS": 0.8, "GLUTES": 0.6}}
        ]
        config = {
            "muscle_weights": {"QUADS": 2.5, "GLUTES": 2.5, "HAMSTRINGS": 2.5, "CALVES": 1.0,
                                "CHEST": 2.5, "SHOULDERS": 2.0, "TRICEPS": 1.5, "LATS": 2.5,
                                "BICEPS": 1.5, "REAR_DELTS": 1.0, "FOREARMS": 1.0, "CORE": 2.0},
            "fatigue_decay": 0.85, "max_difficulty_allowed": 5, "target_exercise_count": 6,
            "pattern_limits": {"SQUAT": 2, "HINGE": 2, "PUSH": 3, "PULL": 3, "CORE": 2, "ACCESSORY": 3},
            "muscle_usage_limit": 0.9, "sore_block_threshold": 0.6,
            "fatigue_block_threshold": 0.9, "fatigue_block_contribution": 0.5,
            "sore_penalty_factor": 3.0,
            "weekly_targets": {m: {"min": 1, "mid": 2, "max": 3} for m in
                                ["QUADS","GLUTES","HAMSTRINGS","CALVES","CHEST",
                                 "SHOULDERS","TRICEPS","LATS","BICEPS","REAR_DELTS","FOREARMS","CORE"]}
        }
        self._write_default("exercises.json", exercises)
        self._write_default("config.json", config)
        self._write_default("soreness.json", {})
        self._write_default("workouts.json", [])

    def test_suggest_returns_exercises(self):
        self._setup_defaults()
        r = self.client.get("/api/suggest")
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertIn("exercises", data)
        self.assertIn("grouped_by_pattern", data)
        self.assertIn("fatigue", data)
        self.assertIn("weekly_load", data)

    def test_suggest_returns_all_scores(self):
        self._setup_defaults()
        data = self.client.get("/api/suggest").get_json()
        self.assertIn("all_scores", data)
        self.assertIsInstance(data["all_scores"], list)

    def test_suggest_exercises_have_score_and_breakdown(self):
        self._setup_defaults()
        data = self.client.get("/api/suggest").get_json()
        for ex in data["exercises"]:
            self.assertIn("_score", ex)
            self.assertIn("_score_breakdown", ex)
            bd = ex["_score_breakdown"]
            for key in ("total", "readiness", "priority", "recency_penalty",
                        "soreness_penalty", "contribution_capped"):
                self.assertIn(key, bd)

    def test_all_scores_have_required_flags(self):
        self._setup_defaults()
        data = self.client.get("/api/suggest").get_json()
        for ex in data["all_scores"]:
            self.assertIn("_selected", ex)
            self.assertIn("_blocked", ex)
            self.assertIn("_score", ex)
            self.assertIn("_score_breakdown", ex)

    def test_all_scores_selected_matches_exercises(self):
        self._setup_defaults()
        data = self.client.get("/api/suggest").get_json()
        selected_names = {e["name"] for e in data["exercises"]}
        flagged_names  = {e["name"] for e in data["all_scores"] if e["_selected"]}
        self.assertEqual(selected_names, flagged_names)

    def test_all_scores_sorted_valid_before_blocked(self):
        self._setup_defaults()
        data = self.client.get("/api/suggest").get_json()
        scores = data["all_scores"]
        if len(scores) > 1:
            first_blocked = next((i for i, e in enumerate(scores) if e["_blocked"]), len(scores))
            last_valid    = next((i for i, e in enumerate(reversed(scores)) if not e["_blocked"]), 0)
            last_valid_idx = len(scores) - 1 - last_valid
            self.assertGreaterEqual(first_blocked, last_valid_idx)

    def test_get_workout_empty(self):
        self._setup_defaults()
        r = self.client.get("/api/workout")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json(), [])

    def test_post_workout_success(self):
        self._setup_defaults()
        r = self.client.post("/api/workout", json=GOOD_WORKOUT)
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertIn("id", data)
        self.assertIn("date", data)

    def test_post_workout_rejects_empty_exercises(self):
        self._setup_defaults()
        r = self.client.post("/api/workout", json={"exercises": []})
        self.assertEqual(r.status_code, 400)
        self.assertIn("error", r.get_json())

    def test_post_workout_rejects_negative_reps(self):
        self._setup_defaults()
        bad = {"exercises": [{"name": "Squat", "mode": "reps",
                               "sets": [{"reps": -1, "weight": 100}]}]}
        r = self.client.post("/api/workout", json=bad)
        self.assertEqual(r.status_code, 400)

    def test_post_workout_rejects_invalid_mode(self):
        self._setup_defaults()
        bad = {"exercises": [{"name": "Squat", "mode": "invalid",
                               "sets": [{"reps": 5, "weight": 100}]}]}
        r = self.client.post("/api/workout", json=bad)
        self.assertEqual(r.status_code, 400)

    def test_post_workout_time_mode(self):
        self._setup_defaults()
        payload = {"exercises": [{"name": "Plank", "mode": "time",
                                   "sets": [{"duration_sec": 60, "weight": 0}]}]}
        r = self.client.post("/api/workout", json=payload)
        self.assertEqual(r.status_code, 200)

    def test_duplicate_rejected(self):
        self._setup_defaults()
        self.client.post("/api/workout", json=GOOD_WORKOUT)
        r = self.client.post("/api/workout", json=GOOD_WORKOUT)
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.get_json()["status"], "already_done")

    def test_delete_workout(self):
        self._setup_defaults()
        create = self.client.post("/api/workout", json=GOOD_WORKOUT)
        wid = create.get_json()["id"]
        r = self.client.delete(f"/api/workout/{wid}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json()["status"], "ok")

    def test_delete_workout_not_found(self):
        self._setup_defaults()
        r = self.client.delete("/api/workout/nonexistent")
        self.assertEqual(r.status_code, 400)

    def test_get_fatigue_endpoint(self):
        self._setup_defaults()
        r = self.client.get("/api/fatigue")
        self.assertEqual(r.status_code, 200)
        self.assertIsInstance(r.get_json(), dict)

    def test_update_workout_endpoint(self):
        self._setup_defaults()
        created = self.client.post("/api/workout", json=GOOD_WORKOUT).get_json()
        wid = created["id"]
        updated_exercises = [
            {"name": "Squat", "pattern": "SQUAT", "mode": "reps",
             "sets": [{"reps": 8, "weight": 120}]}
        ]
        r = self.client.put(f"/api/workout/{wid}", json={"exercises": updated_exercises})
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertEqual(data["id"], wid)
        self.assertEqual(len(data["exercises"]), 1)
        self.assertEqual(data["exercises"][0]["sets"][0]["reps"], 8)

    def test_update_workout_not_found(self):
        self._setup_defaults()
        r = self.client.put("/api/workout/nonexistent",
                            json={"exercises": [{"name": "Squat", "mode": "reps", "sets": []}]})
        self.assertEqual(r.status_code, 400)

    def test_progress_endpoint_empty(self):
        self._setup_defaults()
        r = self.client.get("/api/progress/Squat")
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertIn("last", data)
        self.assertIn("best", data)
        self.assertIsNone(data["last"])
        self.assertIsNone(data["best"])

    def test_progress_endpoint_after_workout(self):
        self._setup_defaults()
        self.client.post("/api/workout", json=GOOD_WORKOUT)
        r = self.client.get("/api/progress/Squat")
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertIsNotNone(data["last"])
        self.assertIsNotNone(data["best"])


if __name__ == "__main__":
    unittest.main()
