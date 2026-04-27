"""
Base storage utilities and user management functions.

This module provides core storage functionality including:
- File I/O operations
- User context management
- Common utilities
"""

import json
import os
from datetime import datetime, date

DATA_DIR = "data"
DEFAULT_USER = "default"

# Users file (contains actual users, gitignored)
USERS_FILE = os.path.join(DATA_DIR, "users.json")

# Global user context
_current_user = None

def get_current_user():
    """Get current user from request or default"""
    global _current_user
    if _current_user is not None:
        return _current_user
    
    # Try to get user from request context (would need to be set by Flask)
    try:
        from flask import request
        user = request.args.get('user') or request.args.get('username') or request.headers.get('X-User')
        if user:
            _current_user = user
            return user
    except:
        pass
    
    # Fallback to default user
    _current_user = DEFAULT_USER
    return DEFAULT_USER

def set_current_user(username):
    """Set current user context"""
    global _current_user
    _current_user = username

def _get_user_file_path(filename):
    """Get file path for current user's data"""
    user = get_current_user()
    if user == DEFAULT_USER:
        # Default user uses shared files in data/default/
        return os.path.join(DATA_DIR, "default", filename)
    else:
        # Other users use personal files in data/users/{username}/
        user_dir = os.path.join(DATA_DIR, "users", user)
        os.makedirs(user_dir, exist_ok=True)
        return os.path.join(user_dir, filename)

def _read(key, default=None):
    """Read data from file for current user"""
    file_path = _get_user_file_path(f"{key}.json")
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default

def _write(key, data):
    """Write data to file for current user"""
    file_path = _get_user_file_path(f"{key}.json")
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

def _ensure_data_dir():
    """Ensure data directory structure exists"""
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(os.path.join(DATA_DIR, "default"), exist_ok=True)
    os.makedirs(os.path.join(DATA_DIR, "users"), exist_ok=True)
