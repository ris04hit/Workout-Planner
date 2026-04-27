"""
Unit tests for storage/workouts.py module.
Tests workout data management functionality.
"""

import json
import os
import tempfile
import unittest
from datetime import datetime, timedelta


from storage.workouts import (
    get_workouts, add_workout, update_workout, delete_workout,
    save_all_workouts, is_duplicate, get_exercise_progress
)
from storage.base import set_current_user


class TestWorkoutStorage(unittest.TestCase):
    """Tests for workout storage functions."""

    def setUp(self):
        """Set up temporary directory for test data."""
        self.temp_dir = tempfile.TemporaryDirectory()

        # Patch DATA_DIR for testing
        import storage.base
        self.original_data_dir = storage.base.DATA_DIR
        storage.base.DATA_DIR = self.temp_dir.name

        # Create data directories
        os.makedirs(os.path.join(self.temp_dir.name, "default"), exist_ok=True)
        os.makedirs(os.path.join(self.temp_dir.name, "users"), exist_ok=True)

        set_current_user("testuser")

    def tearDown(self):
        """Clean up temporary directory."""
        import storage.base
        storage.base.DATA_DIR = self.original_data_dir
        set_current_user(None)
        self.temp_dir.cleanup()

    def test_get_workouts_empty_when_no_data(self):
        """Test that get_workouts returns empty list when no data exists."""
        workouts = get_workouts()
        self.assertEqual(workouts, [])

    def test_add_workout_basic(self):
        """Test adding a basic workout."""
        workout = {
            "groups": ["LEGS"],
            "exercises": [
                {"name": "Squat", "group": "LEGS", "mode": "reps", "sets": [{"reps": 10, "weight": 100}]}
            ]
        }

        result = add_workout(workout)

        self.assertEqual(result["groups"], ["LEGS"])
        self.assertIn("id", result)
        self.assertIn("date", result)

    def test_add_workout_generates_unique_id(self):
        """Test that add_workout generates unique IDs for each workout."""
        workout1 = {"date": "2024-01-14", "exercises": []}
        workout2 = {"date": "2024-01-15", "exercises": []}

        result1 = add_workout(workout1)
        result2 = add_workout(workout2)

        self.assertNotEqual(result1["id"], result2["id"])

    def test_add_workout_adds_date_if_missing(self):
        """Test that add_workout adds current date if not provided."""
        workout = {"groups": ["LEGS"], "exercises": []}

        result = add_workout(workout)

        self.assertIn("date", result)
        # Verify date is in ISO format (YYYY-MM-DD)
        self.assertRegex(result["date"], r"^\d{4}-\d{2}-\d{2}$")

    def test_add_workout_preserves_provided_date(self):
        """Test that add_workout preserves user-provided date."""
        workout = {"groups": ["LEGS"], "exercises": [], "date": "2024-01-15"}

        result = add_workout(workout)

        self.assertEqual(result["date"], "2024-01-15")

    def test_add_workout_detects_duplicate(self):
        """Test that add_workout detects duplicate workouts."""
        workout = {
            "date": "2024-01-15",
            "groups": ["LEGS"],
            "exercises": [{"name": "Squat", "group": "LEGS", "mode": "reps", "sets": []}]
        }

        add_workout(workout.copy())

        with self.assertRaises(ValueError) as context:
            add_workout(workout.copy())
        self.assertIn("already exists", str(context.exception).lower())

    def test_add_workout_different_dates_allowed(self):
        """Test that workouts with different dates are allowed."""
        workout1 = {
            "date": "2024-01-15",
            "exercises": [{"name": "Squat", "mode": "reps", "sets": []}]
        }
        workout2 = {
            "date": "2024-01-16",
            "exercises": [{"name": "Squat", "mode": "reps", "sets": []}]
        }

        add_workout(workout1)
        add_workout(workout2)  # Should not raise

        workouts = get_workouts()
        self.assertEqual(len(workouts), 2)

    def test_update_workout_basic(self):
        """Test updating an existing workout."""
        workout = {
            "date": "2024-01-15",
            "groups": ["LEGS"],
            "exercises": [{"name": "Squat", "group": "LEGS", "mode": "reps", "sets": []}]
        }

        added = add_workout(workout.copy())
        workout_id = added["id"]

        updated = update_workout(
            added["id"],
            [
                {"name": "Squat", "mode": "reps", "sets": []},
                {"name": "Plank", "mode": "time", "sets": []}
            ]
        )

        self.assertEqual(len(updated["exercises"]), 2)
        self.assertEqual(updated["id"], workout_id)
        self.assertEqual(updated["date"], "2024-01-15")  # Date preserved

    def test_update_workout_not_found(self):
        """Test updating a non-existent workout."""
        with self.assertRaises(ValueError) as context:
            update_workout("nonexistent-id", [])
        self.assertIn("not found", str(context.exception).lower())

    def test_delete_workout_by_id(self):
        """Test deleting a workout by ID."""
        workout = {"groups": ["LEGS"], "exercises": []}

        added = add_workout(workout.copy())
        workout_id = added["id"]

        delete_workout(workout_id)

        workouts = get_workouts()
        self.assertEqual(len(workouts), 0)

    def test_delete_workout_falls_back_to_date(self):
        """Test that delete_workout falls back to date-based deletion."""
        workout = {"date": "2024-01-15", "groups": ["LEGS"], "exercises": []}

        add_workout(workout.copy())

        # Delete by date (backward compatibility)
        delete_workout("2024-01-15")

        workouts = get_workouts()
        self.assertEqual(len(workouts), 0)

    def test_delete_workout_not_found(self):
        """Test deleting a non-existent workout."""
        with self.assertRaises(ValueError) as context:
            delete_workout("nonexistent-id")
        self.assertIn("not found", str(context.exception).lower())

    def test_save_all_workouts(self):
        """Test saving all workouts."""
        workouts = [
            {"id": "1", "date": "2024-01-15", "groups": ["LEGS"], "exercises": []},
            {"id": "2", "date": "2024-01-16", "groups": ["PUSH"], "exercises": []}
        ]

        save_all_workouts(workouts)

        result = get_workouts()
        self.assertEqual(len(result), 2)

    def test_is_duplicate_same_date_same_groups_same_exercises(self):
        """Test duplicate detection with same date, groups, and exercises."""
        existing = {
            "date": "2024-01-15",
            "groups": ["LEGS"],
            "exercises": [{"name": "Squat"}, {"name": "Lunge"}]
        }
        new = {
            "date": "2024-01-15",
            "groups": ["LEGS"],
            "exercises": [{"name": "Lunge"}, {"name": "Squat"}]  # Different order
        }

        self.assertTrue(is_duplicate(existing, new))

    def test_is_duplicate_different_date(self):
        """Test that different dates are not duplicates."""
        existing = {"date": "2024-01-15", "groups": ["LEGS"], "exercises": [{"name": "Squat"}]}
        new = {"date": "2024-01-16", "groups": ["LEGS"], "exercises": [{"name": "Squat"}]}

        self.assertFalse(is_duplicate(existing, new))

    def test_is_duplicate_same_date_same_exercises(self):
        """Test that same date + same exercises are duplicates."""
        existing = {"date": "2024-01-15", "exercises": [{"name": "Squat"}]}
        new = {"date": "2024-01-15", "exercises": [{"name": "Squat"}]}

        self.assertTrue(is_duplicate(existing, new))

    def test_is_duplicate_different_exercises(self):
        """Test that different exercises are not duplicates."""
        existing = {"date": "2024-01-15", "groups": ["LEGS"], "exercises": [{"name": "Squat"}]}
        new = {"date": "2024-01-15", "groups": ["LEGS"], "exercises": [{"name": "Lunge"}]}

        self.assertFalse(is_duplicate(existing, new))


class TestExerciseProgress(unittest.TestCase):
    """Tests for exercise progress tracking."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        import storage.base
        self.original_data_dir = storage.base.DATA_DIR
        storage.base.DATA_DIR = self.temp_dir.name

        os.makedirs(os.path.join(self.temp_dir.name, "default"), exist_ok=True)
        set_current_user("testuser")

    def tearDown(self):
        import storage.base
        storage.base.DATA_DIR = self.original_data_dir
        set_current_user(None)
        self.temp_dir.cleanup()

    def test_get_exercise_progress_empty_when_no_workouts(self):
        """Test progress returns empty when no workouts exist."""
        progress = get_exercise_progress("Squat")

        self.assertIsNone(progress["last"])
        self.assertIsNone(progress["best"])
        self.assertIsNone(progress["last_display"])
        self.assertIsNone(progress["best_display"])

    def test_get_exercise_progress_tracks_last_and_best(self):
        """Test progress tracks last and best performance."""
        # Add workouts with exercise
        workouts = [
            {
                "date": "2024-01-10",
                "groups": ["LEGS"],
                "exercises": [
                    {"name": "Squat", "sets": [{"reps": 10, "weight": 100}]}
                ]
            },
            {
                "date": "2024-01-15",
                "groups": ["LEGS"],
                "exercises": [
                    {"name": "Squat", "sets": [{"reps": 8, "weight": 120}]}
                ]
            }
        ]

        for w in workouts:
            add_workout(w)

        progress = get_exercise_progress("Squat")

        self.assertIsNotNone(progress["last"])
        self.assertIsNotNone(progress["best"])
        self.assertEqual(progress["last"]["date"], "2024-01-15")  # Most recent
        # Best volume: 10*100=1000 vs 8*120=960, so first workout is best
        self.assertEqual(progress["best"]["date"], "2024-01-10")

    def test_get_exercise_progress_calculates_volume_correctly(self):
        """Test that volume is calculated correctly (reps * weight)."""
        workout = {
            "date": "2024-01-15",
            "groups": ["LEGS"],
            "exercises": [
                {"name": "Squat", "sets": [
                    {"reps": 10, "weight": 100},
                    {"reps": 8, "weight": 110}
                ]}
            ]
        }

        add_workout(workout)

        progress = get_exercise_progress("Squat")

        # Volume = 10*100 + 8*110 = 1000 + 880 = 1880
        self.assertEqual(progress["last"]["volume"], 1880)

    def test_get_exercise_progress_format_display(self):
        """Test display format for progress."""
        workout = {
            "date": "2024-01-15",
            "groups": ["LEGS"],
            "exercises": [
                {"name": "Squat", "sets": [{"reps": 10, "weight": 100}]}
            ]
        }

        add_workout(workout)

        progress = get_exercise_progress("Squat")

        self.assertEqual(progress["last_display"], "10 × 100")
        self.assertEqual(progress["best_display"], "10 × 100")

    def test_get_exercise_progress_time_mode_display(self):
        """Test display format for time-mode exercise progress."""
        workout = {
            "date": "2024-01-15",
            "groups": ["CORE"],
            "exercises": [
                {"name": "Plank", "sets": [{"duration_sec": 60, "weight": 0}]}
            ]
        }

        add_workout(workout)

        progress = get_exercise_progress("Plank")

        self.assertIsNotNone(progress["last"])
        self.assertEqual(progress["last_display"], "60s × 0")
        self.assertEqual(progress["best_display"], "60s × 0")

    def test_get_exercise_progress_time_mode_picks_longest_duration(self):
        """Test that time-mode display picks the set with the highest duration."""
        workout = {
            "date": "2024-01-15",
            "groups": ["CORE"],
            "exercises": [
                {"name": "Plank", "sets": [
                    {"duration_sec": 30, "weight": 0},
                    {"duration_sec": 90, "weight": 0},
                    {"duration_sec": 60, "weight": 0}
                ]}
            ]
        }

        add_workout(workout)

        progress = get_exercise_progress("Plank")

        self.assertEqual(progress["last_display"], "90s × 0")

    def test_get_exercise_progress_ignores_other_exercises(self):
        """Test that progress only tracks specified exercise."""
        workout = {
            "date": "2024-01-15",
            "groups": ["LEGS"],
            "exercises": [
                {"name": "Squat", "sets": [{"reps": 10, "weight": 100}]},
                {"name": "Lunge", "sets": [{"reps": 12, "weight": 50}]}
            ]
        }

        add_workout(workout)

        squat_progress = get_exercise_progress("Squat")
        lunge_progress = get_exercise_progress("Lunge")
        deadlift_progress = get_exercise_progress("Deadlift")

        self.assertIsNotNone(squat_progress["last"])
        self.assertIsNotNone(lunge_progress["last"])
        self.assertIsNone(deadlift_progress["last"])


class TestUpdateWorkout(unittest.TestCase):
    """Tests for update_workout function."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        import storage.base
        self.original_data_dir = storage.base.DATA_DIR
        storage.base.DATA_DIR = self.temp_dir.name
        os.makedirs(os.path.join(self.temp_dir.name, "default"), exist_ok=True)
        os.makedirs(os.path.join(self.temp_dir.name, "users"), exist_ok=True)
        set_current_user("testuser")

    def tearDown(self):
        import storage.base
        storage.base.DATA_DIR = self.original_data_dir
        set_current_user(None)
        self.temp_dir.cleanup()

    def test_update_workout_preserves_date(self):
        """Test that update_workout preserves the original workout date."""
        workout = add_workout({
            "date": "2024-01-15",
            "groups": ["LEGS"],
            "exercises": [{"name": "Squat", "mode": "reps", "group": "LEGS", "sets": [{"reps": 10, "weight": 100}]}]
        })

        updated = update_workout(
            workout["id"],
            [
                {"name": "Squat", "mode": "reps", "group": "LEGS", "sets": [{"reps": 12, "weight": 110}]},
                {"name": "Plank", "mode": "time", "group": "CORE", "sets": [{"duration_sec": 60, "weight": 0}]}
            ]
        )

        self.assertEqual(updated["date"], "2024-01-15")
        self.assertEqual(updated["id"], workout["id"])

    def test_update_workout_not_found_raises(self):
        """Test that update_workout raises ValueError for unknown id."""
        with self.assertRaises(ValueError):
            update_workout("nonexistent-id", [])


if __name__ == "__main__":
    unittest.main()
