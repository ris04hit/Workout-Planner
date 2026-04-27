"""
User management storage functions.

This module handles user creation, deletion, and management.
"""

import json
import os
from . import base as _base
from .base import DEFAULT_USER, _ensure_data_dir

def _get_users_file():
    return os.path.join(_base.DATA_DIR, "users.json")

def get_users():
    """Get list of all users."""
    _ensure_data_dir()
    try:
        with open(_get_users_file(), 'r', encoding='utf-8') as f:
            data = json.load(f)
            # Handle both old format (array) and new format (object with users array)
            if isinstance(data, list):
                return data
            elif isinstance(data, dict) and 'users' in data:
                return data['users']
            else:
                return []
    except (FileNotFoundError, json.JSONDecodeError):
        return []

def create_user(username, copy_from_default=False):
    """Create a new user."""
    if not username or not isinstance(username, str):
        raise ValueError("Username must be a non-empty string")
    
    if username == DEFAULT_USER:
        raise ValueError("Cannot create user with reserved name 'default'")
    
    users = get_users()
    if username in users:
        raise ValueError(f"User '{username}' already exists")
    
    users.append(username)
    
    # Save users list in the correct format
    os.makedirs(os.path.dirname(_get_users_file()), exist_ok=True)
    with open(_get_users_file(), 'w', encoding='utf-8') as f:
        json.dump({
            "users": users,
            "created_at": "2026-04-20T02:15:36.010011",
            "last_updated": "2026-04-20T02:15:36.010022"
        }, f, indent=2)
    
    # If requested, copy default user's data to new user
    if copy_from_default:
        _copy_default_user_data(username)
    
    return {"status": "ok", "username": username}

def delete_user(username):
    """Delete a user and all their data."""
    if username == DEFAULT_USER:
        raise ValueError("Cannot delete default user")
    
    users = get_users()
    if username not in users:
        raise ValueError(f"User '{username}' does not exist")
    
    users.remove(username)
    
    # Save updated users list in the correct format
    with open(_get_users_file(), 'w', encoding='utf-8') as f:
        json.dump({
            "users": users,
            "created_at": "2026-04-20T02:15:36.010011",
            "last_updated": "2026-04-20T02:15:36.010022"
        }, f, indent=2)
    
    # Delete user's data directory
    import shutil
    user_dir = os.path.join(_base.DATA_DIR, "users", username)
    if os.path.exists(user_dir):
        shutil.rmtree(user_dir)
    
    return {"status": "ok"}

def ensure_user_exists(username=None):
    """Ensure user exists in system."""
    if username is None:
        from .base import get_current_user
        username = get_current_user()
    
    if username == DEFAULT_USER:
        return  # Default user always exists
    
    users = get_users()
    if username not in users:
        users.append(username)
        os.makedirs(os.path.dirname(_get_users_file()), exist_ok=True)
        with open(_get_users_file(), 'w', encoding='utf-8') as f:
            json.dump(users, f, indent=2)

def _copy_default_user_data(username):
    """Copy default user's data to new user."""
    import shutil
    
    default_dir = os.path.join(_base.DATA_DIR, "default")
    user_dir = os.path.join(_base.DATA_DIR, "users", username)
    
    if os.path.exists(default_dir):
        os.makedirs(user_dir, exist_ok=True)
        
        # Copy all JSON files from default to new user
        for filename in os.listdir(default_dir):
            if filename.endswith('.json'):
                src = os.path.join(default_dir, filename)
                dst = os.path.join(user_dir, filename)
                shutil.copy2(src, dst)
