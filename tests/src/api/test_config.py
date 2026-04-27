"""
Unit tests for api/config.py — exercise-based config endpoints.
"""
import json
import os
import tempfile
import unittest
import storage
import storage.base
from app import app as workout_app


class TestConfigAPI(unittest.TestCase):
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

    def _write_default_config(self, data):
        path = os.path.join(self.tmp.name, "default", "config.json")
        with open(path, "w") as f:
            json.dump(data, f)

    def _setup_default_config(self):
        self._write_default_config({
            "muscle_weights": {m: 2.0 for m in
                ["QUADS","GLUTES","HAMSTRINGS","CALVES","CHEST","SHOULDERS",
                 "TRICEPS","LATS","BICEPS","REAR_DELTS","FOREARMS","CORE"]},
            "fatigue_decay": 0.85, "max_difficulty_allowed": 5,
            "target_exercise_count": 6,
            "pattern_limits": {"SQUAT": 2, "HINGE": 2, "PUSH": 3,
                                "PULL": 3, "CORE": 2, "ACCESSORY": 3},
            "muscle_usage_limit": 0.9, "sore_block_threshold": 0.6,
            "fatigue_block_threshold": 0.9, "fatigue_block_contribution": 0.5,
            "sore_penalty_factor": 3.0,
            "weekly_targets": {m: {"min": 1, "mid": 2, "max": 3} for m in
                ["QUADS","GLUTES","HAMSTRINGS","CALVES","CHEST","SHOULDERS",
                 "TRICEPS","LATS","BICEPS","REAR_DELTS","FOREARMS","CORE"]}
        })

    def test_get_config_returns_defaults(self):
        self._setup_default_config()
        r = self.client.get("/api/config")
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertIn("muscle_weights", data)
        self.assertIn("fatigue_decay", data)
        self.assertIn("target_exercise_count", data)

    def test_post_config_updates_config(self):
        self._setup_default_config()
        r = self.client.post("/api/config", json={"fatigue_decay": 0.7})
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertAlmostEqual(data["config"]["fatigue_decay"], 0.7)

    def test_post_config_rejects_invalid(self):
        self._setup_default_config()
        r = self.client.post("/api/config", json={"fatigue_decay": 5.0})
        self.assertEqual(r.status_code, 400)

    def test_reset_config(self):
        self._setup_default_config()
        self.client.post("/api/config", json={"fatigue_decay": 0.5})
        r = self.client.post("/api/config/reset", json={})
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertIn("config", data)

    def test_get_config_history(self):
        self._setup_default_config()
        self.client.post("/api/config", json={"fatigue_decay": 0.7})
        r = self.client.get("/api/config/history")
        self.assertEqual(r.status_code, 200)
        self.assertIsInstance(r.get_json(), list)
        self.assertGreater(len(r.get_json()), 0)


if __name__ == "__main__":
    unittest.main()
