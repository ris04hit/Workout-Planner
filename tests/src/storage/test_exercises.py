"""
Unit tests for storage/exercises.py — flat exercise list storage.
"""
import json
import os
import tempfile
import unittest
import storage.base
from storage.exercises import get_exercises, save_exercises, get_soreness, save_soreness
from storage.base import set_current_user

_EXERCISES = [
    {"name": "Squat", "enabled": True, "difficulty": 3, "priority": 5,
     "pattern": "SQUAT", "family": "SQUAT", "muscles": {"QUADS": 0.8}},
    {"name": "Bench Press", "enabled": True, "difficulty": 3, "priority": 5,
     "pattern": "PUSH", "family": "PRESS", "muscles": {"CHEST": 0.8}},
]


class TestExercisesStorage(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.orig = storage.base.DATA_DIR
        storage.base.DATA_DIR = self.tmp.name
        os.makedirs(os.path.join(self.tmp.name, "default"), exist_ok=True)
        set_current_user("testuser")

    def tearDown(self):
        storage.base.DATA_DIR = self.orig
        set_current_user(None)
        self.tmp.cleanup()

    def _write_default_exercises(self):
        path = os.path.join(self.tmp.name, "default", "exercises.json")
        with open(path, "w") as f:
            json.dump(_EXERCISES, f)

    def test_get_exercises_returns_list(self):
        self._write_default_exercises()
        exercises = get_exercises()
        self.assertIsInstance(exercises, list)

    def test_save_and_load_exercises(self):
        save_exercises(_EXERCISES)
        loaded = get_exercises()
        self.assertEqual(len(loaded), len(_EXERCISES))
        self.assertEqual(loaded[0]["name"], "Squat")

    def test_save_exercises_persists_to_file(self):
        save_exercises(_EXERCISES)
        file_path = storage.base._get_user_file_path("exercises.json")
        with open(file_path) as f:
            saved = json.load(f)
        self.assertEqual(saved, _EXERCISES)

    def test_get_soreness_returns_dict(self):
        save_exercises(_EXERCISES)
        soreness = get_soreness()
        self.assertIsInstance(soreness, dict)

    def test_get_soreness_includes_all_muscles(self):
        save_exercises(_EXERCISES)
        soreness = get_soreness()
        self.assertIn("QUADS", soreness)
        self.assertIn("CHEST", soreness)

    def test_save_and_get_soreness(self):
        save_exercises(_EXERCISES)
        save_soreness({"QUADS": True, "CHEST": False})
        result = get_soreness()
        self.assertTrue(result["QUADS"])
        self.assertFalse(result["CHEST"])

    def test_soreness_defaults_to_false(self):
        save_exercises(_EXERCISES)
        soreness = get_soreness()
        for v in soreness.values():
            self.assertFalse(v)

    def test_save_empty_exercises(self):
        save_exercises([])
        self.assertEqual(get_exercises(), [])


if __name__ == "__main__":
    unittest.main()
