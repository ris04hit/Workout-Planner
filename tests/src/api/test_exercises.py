"""
Unit tests for api/exercises.py — flat exercise list endpoints.
"""
import json
import os
import tempfile
import unittest
import storage
import storage.base
from app import app as workout_app

_EXERCISES = [
    {"name": "Squat", "enabled": True, "difficulty": 3, "priority": 5,
     "pattern": "SQUAT", "family": "SQUAT", "muscles": {"QUADS": 0.8, "GLUTES": 0.6}},
    {"name": "Bench Press", "enabled": True, "difficulty": 3, "priority": 5,
     "pattern": "PUSH", "family": "PRESS", "muscles": {"CHEST": 0.8}},
]


class TestExercisesAPI(unittest.TestCase):
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

    def _setup_default_exercises(self):
        path = os.path.join(self.tmp.name, "default", "exercises.json")
        with open(path, "w") as f:
            json.dump(_EXERCISES, f)

    def test_get_exercises_returns_list(self):
        self._setup_default_exercises()
        r = self.client.get("/api/exercises")
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 2)

    def test_get_exercises_have_required_fields(self):
        self._setup_default_exercises()
        r = self.client.get("/api/exercises")
        for ex in r.get_json():
            for field in ("name", "enabled", "difficulty", "priority", "pattern", "muscles"):
                self.assertIn(field, ex)

    def test_put_exercises_saves(self):
        self._setup_default_exercises()
        updated = [_EXERCISES[0]]
        r = self.client.put("/api/exercises", json=updated)
        self.assertEqual(r.status_code, 200)
        r2 = self.client.get("/api/exercises")
        self.assertEqual(len(r2.get_json()), 1)

    def test_get_soreness_returns_dict(self):
        self._setup_default_exercises()
        r = self.client.get("/api/soreness")
        self.assertEqual(r.status_code, 200)
        self.assertIsInstance(r.get_json(), dict)

    def test_post_soreness_saves(self):
        self._setup_default_exercises()
        r = self.client.post("/api/soreness", json={"QUADS": True, "CHEST": False})
        self.assertEqual(r.status_code, 200)
        r2 = self.client.get("/api/soreness")
        self.assertTrue(r2.get_json().get("QUADS"))


if __name__ == "__main__":
    unittest.main()
