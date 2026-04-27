"""
Unit tests for the /api/progress/<exercise_name> endpoint (in api/workouts.py).
"""

import os
import tempfile
import unittest

from app import app as workout_app
import storage
import storage.base


class TestProgressAPI(unittest.TestCase):
    """Tests for GET /api/progress/<exercise_name>."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_data_dir = storage.base.DATA_DIR
        storage.base.DATA_DIR = self.temp_dir.name

        os.makedirs(os.path.join(self.temp_dir.name, "default"), exist_ok=True)
        os.makedirs(os.path.join(self.temp_dir.name, "users"), exist_ok=True)

        storage.set_current_user(None)
        workout_app.testing = True
        self.client = workout_app.test_client()

    def tearDown(self):
        storage.base.DATA_DIR = self.original_data_dir
        storage.set_current_user(None)
        self.temp_dir.cleanup()

    def _post_workout(self, exercises):
        return self.client.post('/api/workout', json={"exercises": exercises})

    def test_get_progress_empty_for_new_exercise(self):
        """GET /api/progress/<exercise> returns nulls for an exercise never logged."""
        response = self.client.get('/api/progress/NewExercise')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIsNone(data['last'])
        self.assertIsNone(data['best'])
        self.assertIsNone(data['last_display'])
        self.assertIsNone(data['best_display'])

    def test_get_progress_tracks_exercise_history(self):
        """GET /api/progress/<exercise> returns last and best after logging."""
        self._post_workout([
            {'name': 'Squat', 'mode': 'reps', 'sets': [{'reps': 10, 'weight': 100}]}
        ])
        data = self.client.get('/api/progress/Squat').get_json()
        self.assertIsNotNone(data['last'])
        self.assertIsNotNone(data['best'])
        self.assertEqual(data['best']['volume'], 1000)

    def test_get_progress_calculates_volume_correctly(self):
        """Volume = sum(reps × weight) across all sets."""
        self._post_workout([
            {'name': 'Squat', 'mode': 'reps', 'sets': [
                {'reps': 10, 'weight': 100},
                {'reps': 8, 'weight': 110}
            ]}
        ])
        data = self.client.get('/api/progress/Squat').get_json()
        self.assertEqual(data['last']['volume'], 1880)

    def test_get_progress_formats_display(self):
        """last_display/best_display show the highest-volume set."""
        self._post_workout([
            {'name': 'Squat', 'mode': 'reps', 'sets': [
                {'reps': 10, 'weight': 100},
                {'reps': 5, 'weight': 150}
            ]}
        ])
        data = self.client.get('/api/progress/Squat').get_json()
        self.assertEqual(data['last_display'], '10 × 100')
        self.assertEqual(data['best_display'], '10 × 100')

    def test_get_progress_exercise_not_found(self):
        """Non-existent exercise returns nulls (not a 404)."""
        data = self.client.get('/api/progress/NonExistentExercise').get_json()
        self.assertIsNone(data['last'])
        self.assertIsNone(data['best'])

    def test_get_progress_url_encoded_name(self):
        """URL-encoded exercise names are resolved correctly."""
        self._post_workout([
            {'name': 'Bench Press', 'mode': 'reps', 'sets': [{'reps': 10, 'weight': 135}]}
        ])
        data = self.client.get('/api/progress/Bench%20Press').get_json()
        self.assertIsNotNone(data['last'])

    def test_get_progress_tracks_multiple_exercises_separately(self):
        """Each exercise has its own independent progress record."""
        self._post_workout([
            {'name': 'Squat', 'mode': 'reps', 'sets': [{'reps': 10, 'weight': 100}]},
            {'name': 'Lunge', 'mode': 'reps', 'sets': [{'reps': 12, 'weight': 50}]}
        ])
        squat = self.client.get('/api/progress/Squat').get_json()
        lunge = self.client.get('/api/progress/Lunge').get_json()
        self.assertEqual(squat['last']['volume'], 1000)
        self.assertEqual(lunge['last']['volume'], 600)

    def test_get_progress_time_mode(self):
        """Time-mode exercises use duration_sec as volume."""
        self._post_workout([
            {'name': 'Plank', 'mode': 'time', 'sets': [
                {'duration_sec': 60, 'weight': 0},
                {'duration_sec': 90, 'weight': 0}
            ]}
        ])
        data = self.client.get('/api/progress/Plank').get_json()
        self.assertIsNotNone(data['last'])
        self.assertEqual(data['last_display'], '90s × 0')


if __name__ == '__main__':
    unittest.main()
