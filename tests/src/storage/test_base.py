"""
Unit tests for storage/base.py module.
Tests file I/O operations and user context management.
"""

import json
import os
import tempfile
import unittest
from pathlib import Path


from storage.base import (
    get_current_user, set_current_user, _read, _write,
    _get_user_file_path, DATA_DIR, DEFAULT_USER, _ensure_data_dir
)


class TestBaseStorage(unittest.TestCase):
    """Tests for base storage utilities."""

    def setUp(self):
        """Set up temporary directory for test data."""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_data_dir = DATA_DIR

        # Patch DATA_DIR for testing
        import storage.base
        storage.base.DATA_DIR = self.temp_dir.name

        # Reset user context
        set_current_user(None)

    def tearDown(self):
        """Clean up temporary directory and restore original state."""
        import storage.base
        storage.base.DATA_DIR = self.original_data_dir
        set_current_user(None)
        self.temp_dir.cleanup()

    def test_default_user_constant(self):
        """Test that DEFAULT_USER is 'default'."""
        self.assertEqual(DEFAULT_USER, "default")

    def test_get_current_user_returns_default_when_not_set(self):
        """Test that get_current_user returns default when no user is set."""
        user = get_current_user()
        self.assertEqual(user, DEFAULT_USER)

    def test_set_and_get_current_user(self):
        """Test setting and getting current user."""
        set_current_user("testuser")
        user = get_current_user()
        self.assertEqual(user, "testuser")

    def test_get_current_user_uses_cached_value(self):
        """Test that get_current_user caches the user value."""
        set_current_user("cached_user")
        # Second call should return cached value
        user1 = get_current_user()
        user2 = get_current_user()
        self.assertEqual(user1, user2)
        self.assertEqual(user1, "cached_user")

    def test_get_user_file_path_for_default_user(self):
        """Test file path generation for default user."""
        set_current_user(DEFAULT_USER)
        path = _get_user_file_path("test.json")
        expected = os.path.join(self.temp_dir.name, "default", "test.json")
        self.assertEqual(path, expected)

    def test_get_user_file_path_for_custom_user(self):
        """Test file path generation for custom user."""
        set_current_user("customuser")
        path = _get_user_file_path("data.json")
        expected = os.path.join(self.temp_dir.name, "users", "customuser", "data.json")
        self.assertEqual(path, expected)

    def test_ensure_data_dir_creates_directories(self):
        """Test that _ensure_data_dir creates required directories."""
        _ensure_data_dir()

        self.assertTrue(os.path.exists(self.temp_dir.name))
        self.assertTrue(os.path.exists(os.path.join(self.temp_dir.name, "default")))
        self.assertTrue(os.path.exists(os.path.join(self.temp_dir.name, "users")))

    def test_write_and_read_data(self):
        """Test writing and reading data to/from files."""
        set_current_user("testuser")
        test_data = {"key": "value", "number": 42, "list": [1, 2, 3]}

        _write("test_data", test_data)
        result = _read("test_data")

        self.assertEqual(result, test_data)

    def test_read_returns_default_when_file_missing(self):
        """Test that _read returns default value when file doesn't exist."""
        set_current_user("testuser")
        result = _read("nonexistent", default="default_value")
        self.assertEqual(result, "default_value")

    def test_read_returns_none_when_no_default_and_file_missing(self):
        """Test that _read returns None when no default is specified and file is missing."""
        set_current_user("testuser")
        result = _read("nonexistent")
        self.assertIsNone(result)

    def test_read_handles_corrupted_json(self):
        """Test that _read handles corrupted JSON gracefully."""
        set_current_user("testuser")

        # Create a corrupted JSON file
        file_path = _get_user_file_path("corrupted.json")
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, 'w') as f:
            f.write("{invalid json}")

        result = _read("corrupted", default="default_value")
        self.assertEqual(result, "default_value")

    def test_write_creates_parent_directories(self):
        """Test that _write creates parent directories if needed."""
        set_current_user("newuser")

        # Ensure directories don't exist
        user_dir = os.path.join(self.temp_dir.name, "users", "newuser")
        if os.path.exists(user_dir):
            os.rmdir(user_dir)

        # Write should create directories
        _write("data", {"test": "data"})

        self.assertTrue(os.path.exists(user_dir))

    def test_write_preserves_data_types(self):
        """Test that _write preserves various data types."""
        set_current_user("testuser")

        complex_data = {
            "string": "value",
            "integer": 42,
            "float": 3.14,
            "boolean": True,
            "null": None,
            "list": [1, 2, 3],
            "nested": {"a": 1, "b": 2}
        }

        _write("complex", complex_data)
        result = _read("complex")

        self.assertEqual(result, complex_data)

    def test_user_isolation(self):
        """Test that different users have isolated data."""
        # Write data as user1
        set_current_user("user1")
        _write("data", {"user": "user1"})

        # Write data as user2
        set_current_user("user2")
        _write("data", {"user": "user2"})

        # Read as user1
        set_current_user("user1")
        result1 = _read("data")

        # Read as user2
        set_current_user("user2")
        result2 = _read("data")

        self.assertEqual(result1, {"user": "user1"})
        self.assertEqual(result2, {"user": "user2"})


class TestBaseStorageEdgeCases(unittest.TestCase):
    """Edge case tests for base storage."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        import storage.base
        self.original_data_dir = storage.base.DATA_DIR
        storage.base.DATA_DIR = self.temp_dir.name
        set_current_user(None)

    def tearDown(self):
        import storage.base
        storage.base.DATA_DIR = self.original_data_dir
        set_current_user(None)
        self.temp_dir.cleanup()

    def test_empty_string_username(self):
        """Test behavior with empty string username."""
        set_current_user("")
        # Empty string is not None, so it should be used
        user = get_current_user()
        self.assertEqual(user, "")

    def test_unicode_data(self):
        """Test handling of unicode data."""
        set_current_user("testuser")
        unicode_data = {
            "emoji": "Hello 🚀",
            "chinese": "中文",
            "arabic": "العربية"
        }

        _write("unicode", unicode_data)
        result = _read("unicode")

        self.assertEqual(result, unicode_data)

    def test_large_data(self):
        """Test handling of large data."""
        set_current_user("testuser")
        large_data = {"items": list(range(10000))}

        _write("large", large_data)
        result = _read("large")

        self.assertEqual(result, large_data)


if __name__ == "__main__":
    unittest.main()
