"""
Unit tests for api/users.py module.
Tests user management API endpoints.
"""

import json
import os
import tempfile
import unittest

# Add src to path before importing

from app import app as workout_app
import storage
import storage.base


class TestUsersAPI(unittest.TestCase):
    """Tests for user management API endpoints."""

    def setUp(self):
        """Set up test client and temporary data directory."""
        self.temp_dir = tempfile.TemporaryDirectory()
        os.makedirs(os.path.join(self.temp_dir.name, "default"), exist_ok=True)
        os.makedirs(os.path.join(self.temp_dir.name, "users"), exist_ok=True)

        self.original_data_dir = storage.base.DATA_DIR
        storage.base.DATA_DIR = self.temp_dir.name
        storage.set_current_user(None)
        workout_app.testing = True
        self.client = workout_app.test_client()

    def tearDown(self):
        """Clean up temporary directory."""
        storage.base.DATA_DIR = self.original_data_dir
        storage.set_current_user(None)
        self.temp_dir.cleanup()

    def test_get_users_empty_list(self):
        """Test GET /api/users returns empty list initially."""
        response = self.client.get('/api/users')

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data, [])

    def test_create_user_success(self):
        """Test POST /api/users creates a user successfully."""
        response = self.client.post(
            '/api/users',
            json={'username': 'newuser'}
        )

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['username'], 'newuser')

    def test_create_user_without_copy_from_default(self):
        """Test creating user without copying from default."""
        response = self.client.post(
            '/api/users',
            json={'username': 'nocopyuser', 'copy_from_default': False}
        )

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['username'], 'nocopyuser')

    def test_create_user_missing_username(self):
        """Test POST /api/users rejects request without username."""
        response = self.client.post('/api/users', json={})

        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn('error', data)

    def test_create_user_duplicate(self):
        """Test POST /api/users rejects duplicate username."""
        self.client.post('/api/users', json={'username': 'duplicate'})

        response = self.client.post('/api/users', json={'username': 'duplicate'})

        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn('error', data)

    def test_create_user_default_reserved(self):
        """Test POST /api/users rejects 'default' username."""
        response = self.client.post('/api/users', json={'username': 'default'})

        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn('error', data)

    def test_delete_user_success(self):
        """Test DELETE /api/users/<username> deletes user."""
        self.client.post('/api/users', json={'username': 'todelete'})

        response = self.client.delete('/api/users/todelete')

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['status'], 'ok')

    def test_delete_user_not_found(self):
        """Test DELETE /api/users/<username> returns error for non-existent user."""
        response = self.client.delete('/api/users/nonexistent')

        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn('error', data)

    def test_delete_default_user_fails(self):
        """Test DELETE /api/users/default fails."""
        response = self.client.delete('/api/users/default')

        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn('error', data)

    def test_get_current_user_initial(self):
        """Test GET /api/current-user returns default initially."""
        response = self.client.get('/api/current-user')

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['current_user'], 'default')

    def test_set_current_user_success(self):
        """Test POST /api/current-user sets current user."""
        response = self.client.post(
            '/api/current-user',
            json={'username': 'testuser'}
        )

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['current_user'], 'testuser')

    def test_set_current_user_missing_username(self):
        """Test POST /api/current-user rejects request without username."""
        response = self.client.post('/api/current-user', json={})

        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn('error', data)


if __name__ == '__main__':
    unittest.main()
