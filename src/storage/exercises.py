"""
Exercise and soreness storage functions.

Exercises are stored as a flat list (not grouped by muscle).
Each exercise has: name, enabled, difficulty, priority, pattern, family, muscles.

Soreness is stored per individual muscle (QUADS, GLUTES, LATS, etc.),
not per training group.
"""

import json
import os
from .base import _read, _write

_DEFAULT_EXERCISES_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data", "default", "exercises.json"
)


def _load_default_exercises() -> list:
    """Load default exercise list from data/default/exercises.json."""
    try:
        with open(_DEFAULT_EXERCISES_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        raise RuntimeError(
            f"Default exercises not found or invalid at {_DEFAULT_EXERCISES_PATH}. "
            "Run scripts/setup.sh to initialise the data directory."
        )


def get_exercises() -> list:
    """Get the exercise list for the current user (flat list of exercise dicts)."""
    exercises = _read("exercises")
    if exercises is None:
        exercises = _load_default_exercises()
        save_exercises(exercises)
    return exercises


def save_exercises(exercises: list) -> None:
    """Save the exercise list for the current user."""
    _write("exercises", exercises)


def get_all_muscle_names() -> list:
    """Return the sorted list of all unique muscle names from the exercise list."""
    exercises = get_exercises()
    muscles = set()
    for ex in exercises:
        muscles.update(ex.get("muscles", {}).keys())
    return sorted(muscles)


def get_soreness() -> dict:
    """
    Get per-muscle soreness for the current user.
    Keys are individual muscle names (QUADS, LATS, CHEST, …).
    Missing muscles default to False.
    """
    saved = _read("soreness", {})
    all_muscles = get_all_muscle_names()
    return {m: bool(saved.get(m, False)) for m in all_muscles}


def save_soreness(data: dict) -> None:
    """Save per-muscle soreness for the current user."""
    _write("soreness", data)
