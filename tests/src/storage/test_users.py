"""
Unit tests for storage/users.py module.
Tests user management functionality.
"""

import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path


from storage.users import (
    get_users, create_user, delete_user, ensure_user_exists, _copy_default_user_data
)
import storage.base
from storage.base import DEFAULT_USER, set_current_user


class TestUserStorage(unittest.TestCase):
    """Tests for user management storage functions."""

    def setUp(self):
        """Set up temporary directory for test data."""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_data_dir = None

        # Patch DATA_DIR for testing
        import storage.base
        self.original_data_dir = storage.base.DATA_DIR
        storage.base.DATA_DIR = self.temp_dir.name

        # Reset user context
        set_current_user(None)

        # Create data directories
        os.makedirs(os.path.join(self.temp_dir.name, "default"), exist_ok=True)
        os.makedirs(os.path.join(self.temp_dir.name, "users"), exist_ok=True)

    def tearDown(self):
        """Clean up temporary directory."""
        import storage.base
        storage.base.DATA_DIR = self.original_data_dir
        set_current_user(None)
        self.temp_dir.cleanup()

    def test_get_users_empty_when_no_file(self):
        """Test that get_users returns empty list when no users file exists."""
        users = get_users()
        self.assertEqual(users, [])

    def test_get_users_with_legacy_format(self):
        """Test get_users handles legacy array format."""
        users_file = os.path.join(storage.base.DATA_DIR, "users.json")
        os.makedirs(os.path.dirname(users_file), exist_ok=True)
        with open(users_file, 'w') as f:
            json.dump(["user1", "user2"], f)

        users = get_users()
        self.assertEqual(users, ["user1", "user2"])

    def test_get_users_with_object_format(self):
        """Test get_users handles object format with users array."""
        users_file = os.path.join(storage.base.DATA_DIR, "users.json")
        os.makedirs(os.path.dirname(users_file), exist_ok=True)
        with open(users_file, 'w') as f:
            json.dump({
                "users": ["user1", "user2", "user3"],
                "created_at": "2024-01-01",
                "last_updated": "2024-01-02"
            }, f)

        users = get_users()
        self.assertEqual(users, ["user1", "user2", "user3"])

    def test_create_user_basic(self):
        """Test basic user creation."""
        result = create_user("testuser")

        self.assertEqual(result["username"], "testuser")
        self.assertEqual(result["status"], "ok")

        users = get_users()
        self.assertIn("testuser", users)

    def test_create_user_with_copy_from_default(self):
        """Test user creation with data copy from default."""
        # Create default user data
        default_dir = os.path.join(self.temp_dir.name, "default")
        with open(os.path.join(default_dir, "test.json"), 'w') as f:
            json.dump({"data": "default"}, f)

        create_user("newuser", copy_from_default=True)

        # Check that data was copied
        user_file = os.path.join(self.temp_dir.name, "users", "newuser", "test.json")
        self.assertTrue(os.path.exists(user_file))

        with open(user_file) as f:
            data = json.load(f)
        self.assertEqual(data, {"data": "default"})

    def test_create_user_rejects_empty_username(self):
        """Test that create_user rejects empty username."""
        with self.assertRaises(ValueError) as context:
            create_user("")
        self.assertIn("Username must be a non-empty string", str(context.exception))

    def test_create_user_rejects_none_username(self):
        """Test that create_user rejects None username."""
        with self.assertRaises(ValueError) as context:
            create_user(None)
        self.assertIn("Username must be a non-empty string", str(context.exception))

    def test_create_user_rejects_default_username(self):
        """Test that create_user rejects reserved 'default' username."""
        with self.assertRaises(ValueError) as context:
            create_user("default")
        self.assertIn("reserved name", str(context.exception).lower())

    def test_create_user_rejects_duplicate_username(self):
        """Test that create_user rejects duplicate usernames."""
        create_user("uniqueuser")

        with self.assertRaises(ValueError) as context:
            create_user("uniqueuser")
        self.assertIn("already exists", str(context.exception).lower())

    def test_delete_user(self):
        """Test user deletion."""
        create_user("todelete")
        result = delete_user("todelete")

        self.assertEqual(result["status"], "ok")

        users = get_users()
        self.assertNotIn("todelete", users)

    def test_delete_user_removes_data_directory(self):
        """Test that delete_user removes user's data directory."""
        create_user("todelete", copy_from_default=False)

        # Create some user data
        user_dir = os.path.join(self.temp_dir.name, "users", "todelete")
        os.makedirs(user_dir, exist_ok=True)
        with open(os.path.join(user_dir, "data.json"), 'w') as f:
            json.dump({"test": "data"}, f)

        delete_user("todelete")

        self.assertFalse(os.path.exists(user_dir))

    def test_delete_user_rejects_default_user(self):
        """Test that delete_user rejects deleting default user."""
        with self.assertRaises(ValueError) as context:
            delete_user("default")
        self.assertIn("default user", str(context.exception).lower())

    def test_delete_user_rejects_nonexistent_user(self):
        """Test that delete_user rejects deleting non-existent user."""
        with self.assertRaises(ValueError) as context:
            delete_user("nonexistent")
        self.assertIn("does not exist", str(context.exception).lower())

    def test_ensure_user_exists_adds_new_user(self):
        """Test that ensure_user_exists adds new users."""
        ensure_user_exists("newuser")

        users = get_users()
        self.assertIn("newuser", users)

    def test_ensure_user_exists_ignores_existing_user(self):
        """Test that ensure_user_exists handles existing users."""
        create_user("existinguser")

        # Should not raise error
        ensure_user_exists("existinguser")

        users = get_users()
        self.assertEqual(users.count("existinguser"), 1)

    def test_ensure_user_exists_ignores_default_user(self):
        """Test that ensure_user_exists silently accepts default user."""
        # Should not raise error or modify users list
        ensure_user_exists("default")

        users = get_users()
        self.assertNotIn("default", users)

    def test_ensure_user_exists_uses_current_user_when_no_arg(self):
        """Test that ensure_user_exists uses current user when no argument provided."""
        set_current_user("currentuser")
        ensure_user_exists()

        users = get_users()
        self.assertIn("currentuser", users)


class TestCopyDefaultUserData(unittest.TestCase):
    """Tests for _copy_default_user_data function."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        import storage.base
        self.original_data_dir = storage.base.DATA_DIR
        storage.base.DATA_DIR = self.temp_dir.name

        os.makedirs(os.path.join(self.temp_dir.name, "default"), exist_ok=True)
        os.makedirs(os.path.join(self.temp_dir.name, "users"), exist_ok=True)

    def tearDown(self):
        import storage.base
        storage.base.DATA_DIR = self.original_data_dir
        self.temp_dir.cleanup()

    def test_copy_default_user_data_copies_all_json_files(self):
        """Test that all JSON files are copied from default."""
        default_dir = os.path.join(self.temp_dir.name, "default")

        # Create multiple JSON files
        with open(os.path.join(default_dir, "file1.json"), 'w') as f:
            json.dump({"data": 1}, f)
        with open(os.path.join(default_dir, "file2.json"), 'w') as f:
            json.dump({"data": 2}, f)

        # Create a non-JSON file (should not be copied)
        with open(os.path.join(default_dir, "readme.txt"), 'w') as f:
            f.write("This is a readme")

        _copy_default_user_data("newuser")

        user_dir = os.path.join(self.temp_dir.name, "users", "newuser")
        self.assertTrue(os.path.exists(os.path.join(user_dir, "file1.json")))
        self.assertTrue(os.path.exists(os.path.join(user_dir, "file2.json")))
        self.assertFalse(os.path.exists(os.path.join(user_dir, "readme.txt")))

    def test_copy_default_user_data_preserves_file_contents(self):
        """Test that copied files preserve their contents."""
        default_dir = os.path.join(self.temp_dir.name, "default")
        test_data = {"complex": {"nested": [1, 2, 3]}, "value": "test"}

        with open(os.path.join(default_dir, "data.json"), 'w') as f:
            json.dump(test_data, f)

        _copy_default_user_data("newuser")

        user_file = os.path.join(self.temp_dir.name, "users", "newuser", "data.json")
        with open(user_file) as f:
            copied_data = json.load(f)

        self.assertEqual(copied_data, test_data)


if __name__ == "__main__":
    unittest.main()
