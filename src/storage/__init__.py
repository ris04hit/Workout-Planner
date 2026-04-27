"""
Storage module for workout tracker data management.

This package provides modular storage functionality for:
- User management
- Workout data
- Configuration
- Exercises (flat list with muscle contributions)
"""

from .base import get_current_user, set_current_user, _read, _write, DATA_DIR, DEFAULT_USER
from .users import get_users, create_user, delete_user, ensure_user_exists
from .workouts import (
    get_workouts, add_workout, update_workout, delete_workout,
    get_exercise_progress, get_today_workout
)
from .config import (
    get_config, set_config, get_config_history, reset_config, revert_config,
    get_effective_config, validate_config
)
from .exercises import (
    get_exercises, save_exercises, get_soreness, save_soreness, get_all_muscle_names
)
__all__ = [
    # Base
    'get_current_user', 'set_current_user', '_read', '_write', 'DATA_DIR', 'DEFAULT_USER',
    # Users
    'get_users', 'create_user', 'delete_user', 'ensure_user_exists',
    # Workouts
    'get_workouts', 'add_workout', 'update_workout', 'delete_workout',
    'get_exercise_progress', 'get_today_workout',
    # Config
    'get_config', 'set_config', 'get_config_history', 'reset_config', 'revert_config',
    'get_effective_config', 'validate_config',
    # Exercises & soreness
    'get_exercises', 'save_exercises', 'get_soreness', 'save_soreness', 'get_all_muscle_names',
]
