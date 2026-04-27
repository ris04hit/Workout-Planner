"""
Unit tests for storage/config.py — exercise-based config storage.
"""
import os
import tempfile
import unittest
import storage.base
from storage.config import (
    get_config, set_config, get_config_history, reset_config,
    revert_config, get_effective_config, validate_config, _save_config_history
)
from storage.base import set_current_user


class TestConfigStorage(unittest.TestCase):
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

    def test_get_config_empty_when_no_file(self):
        self.assertEqual(get_config(), {})

    def test_set_and_get_config(self):
        set_config({"fatigue_decay": 0.7})
        self.assertAlmostEqual(get_config()["fatigue_decay"], 0.7)

    def test_reset_config_clears_overrides(self):
        set_config({"fatigue_decay": 0.5})
        result = reset_config()
        self.assertIn("fatigue_decay", result)
        saved = get_config()
        self.assertEqual(saved, {})

    def test_revert_config(self):
        set_config({"fatigue_decay": 0.8})
        set_config({"fatigue_decay": 0.6})
        reverted = revert_config(0)
        self.assertAlmostEqual(reverted["fatigue_decay"], 0.8)

    def test_revert_invalid_index_raises(self):
        with self.assertRaises(ValueError):
            revert_config(0)

    def test_get_config_history_empty_initially(self):
        self.assertEqual(get_config_history(), [])

    def test_get_effective_config_has_defaults(self):
        effective = get_effective_config({})
        for key in ("muscle_weights", "fatigue_decay", "target_exercise_count",
                    "pattern_limits", "weekly_targets"):
            self.assertIn(key, effective)

    def test_get_effective_config_applies_override(self):
        effective = get_effective_config({"fatigue_decay": 0.5})
        self.assertAlmostEqual(effective["fatigue_decay"], 0.5)


class TestConfigValidation(unittest.TestCase):
    def test_rejects_non_dict(self):
        with self.assertRaises(ValueError):
            validate_config("bad")

    def test_accepts_empty(self):
        self.assertEqual(validate_config({}), {})

    def test_muscle_weights_must_be_positive(self):
        with self.assertRaises(ValueError):
            validate_config({"muscle_weights": {"QUADS": -1}})

    def test_fatigue_decay_out_of_range(self):
        with self.assertRaises(ValueError):
            validate_config({"fatigue_decay": 0})
        with self.assertRaises(ValueError):
            validate_config({"fatigue_decay": 1.5})

    def test_target_exercise_count_must_be_positive_int(self):
        with self.assertRaises(ValueError):
            validate_config({"target_exercise_count": 0})

    def test_max_difficulty_must_be_positive_int(self):
        with self.assertRaises(ValueError):
            validate_config({"max_difficulty_allowed": 0})

    def test_pattern_limits_must_be_non_negative_ints(self):
        with self.assertRaises(ValueError):
            validate_config({"pattern_limits": {"PUSH": -1}})

    def test_valid_config_preserved(self):
        cfg = {"fatigue_decay": 0.9, "target_exercise_count": 5,
               "muscle_weights": {"QUADS": 2.5}}
        result = validate_config(cfg)
        self.assertAlmostEqual(result["fatigue_decay"], 0.9)


class TestConfigHistory(unittest.TestCase):
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

    def test_save_config_history_adds_entry(self):
        _save_config_history({"v": 1})
        history = get_config_history()
        self.assertEqual(len(history), 1)
        self.assertIn("timestamp", history[0])

    def test_history_capped_at_50(self):
        for i in range(55):
            _save_config_history({"i": i})
        self.assertEqual(len(get_config_history()), 50)


if __name__ == "__main__":
    unittest.main()
