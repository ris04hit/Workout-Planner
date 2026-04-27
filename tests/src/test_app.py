import json
import os
import tempfile
import unittest
from pathlib import Path

import app as workout_app
import storage
import storage.base

_EXERCISES = [
    {"name": "Squat", "enabled": True, "difficulty": 3, "priority": 5,
     "pattern": "SQUAT", "family": "SQUAT", "muscles": {"QUADS": 0.8, "GLUTES": 0.6}},
    {"name": "Bench Press", "enabled": True, "difficulty": 3, "priority": 5,
     "pattern": "PUSH", "family": "PRESS", "muscles": {"CHEST": 0.8}},
]

_CONFIG = {
    "muscle_weights": {m: 2.0 for m in
        ["QUADS","GLUTES","HAMSTRINGS","CALVES","CHEST","SHOULDERS",
         "TRICEPS","LATS","BICEPS","REAR_DELTS","FOREARMS","CORE"]},
    "fatigue_decay": 0.85, "max_difficulty_allowed": 5,
    "target_exercise_count": 6,
    "pattern_limits": {"SQUAT": 2, "HINGE": 2, "PUSH": 3, "PULL": 3, "CORE": 2, "ACCESSORY": 3},
    "muscle_usage_limit": 0.9, "sore_block_threshold": 0.6,
    "fatigue_block_threshold": 0.9, "fatigue_block_contribution": 0.5,
    "sore_penalty_factor": 3.0,
    "weekly_targets": {m: {"min": 1, "mid": 2, "max": 3} for m in
        ["QUADS","GLUTES","HAMSTRINGS","CALVES","CHEST","SHOULDERS",
         "TRICEPS","LATS","BICEPS","REAR_DELTS","FOREARMS","CORE"]}
}


class WorkoutApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_data_dir = storage.base.DATA_DIR
        storage.base.DATA_DIR = self.temp_dir.name
        os.makedirs(os.path.join(self.temp_dir.name, "default"), exist_ok=True)
        os.makedirs(os.path.join(self.temp_dir.name, "users"), exist_ok=True)
        storage.set_current_user(None)
        workout_app.app.testing = True
        self.client = workout_app.app.test_client()
        self._write_default("exercises.json", _EXERCISES)
        self._write_default("config.json", _CONFIG)
        self._write_default("soreness.json", {})
        self._write_default("workouts.json", [])

    def tearDown(self):
        storage.base.DATA_DIR = self.original_data_dir
        storage.set_current_user(None)
        self.temp_dir.cleanup()

    def _write_default(self, filename, data):
        path = Path(self.temp_dir.name) / "default" / filename
        path.write_text(json.dumps(data))

    def test_get_soreness_returns_dict(self):
        r = self.client.get("/api/soreness")
        self.assertEqual(r.status_code, 200)
        self.assertIsInstance(r.get_json(), dict)

    def test_post_soreness_saves(self):
        r = self.client.post("/api/soreness", json={"QUADS": True})
        self.assertEqual(r.status_code, 200)
        r2 = self.client.get("/api/soreness")
        self.assertTrue(r2.get_json().get("QUADS"))

    def test_save_workout_rejects_empty_exercises(self):
        r = self.client.post("/api/workout", json={"exercises": []})
        self.assertEqual(r.status_code, 400)
        self.assertIn("exercise", r.get_json()["error"].lower())

    def test_save_workout_rejects_invalid_reps(self):
        payload = {"exercises": [
            {"name": "Squat", "mode": "reps", "sets": [{"reps": -1, "weight": 10}]}
        ]}
        r = self.client.post("/api/workout", json=payload)
        self.assertEqual(r.status_code, 400)
        self.assertIn("positive integer", r.get_json()["error"].lower())

    def test_duplicate_workout_returns_conflict(self):
        payload = {"exercises": [
            {"name": "Squat", "mode": "reps", "sets": [{"reps": 10, "weight": 20}]}
        ]}
        first = self.client.post("/api/workout", json=payload)
        second = self.client.post("/api/workout", json=payload)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 409)
        self.assertEqual(second.get_json()["status"], "already_done")

    def test_invalid_config_is_rejected(self):
        r = self.client.post("/api/config", json={"fatigue_decay": 5.0})
        self.assertEqual(r.status_code, 400)
        self.assertIn("fatigue_decay", r.get_json()["error"].lower())

    def test_config_history_and_revert_flow(self):
        save = self.client.post("/api/config", json={"fatigue_decay": 0.7})
        self.assertEqual(save.status_code, 200)
        self.assertAlmostEqual(save.get_json()["config"]["fatigue_decay"], 0.7)

        hist = self.client.get("/api/config/history")
        self.assertEqual(len(hist.get_json()), 1)

        reset = self.client.post("/api/config/reset", json={})
        self.assertEqual(reset.status_code, 200)
        self.assertIn("fatigue_decay", reset.get_json()["config"])

        revert = self.client.post("/api/config/revert", json={"index": 0})
        self.assertEqual(revert.status_code, 200)
        self.assertAlmostEqual(revert.get_json()["config"]["fatigue_decay"], 0.7)


if __name__ == "__main__":
    unittest.main()
