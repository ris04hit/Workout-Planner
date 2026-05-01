"""
Workout data storage functions.

This module handles workout creation, retrieval, update, and deletion.
"""

import json
import os
from datetime import datetime, date
from .base import _read, _write, DATA_DIR

def get_workouts():
    """Get all workouts for current user."""
    return _read("workouts", [])

_EXERCISE_SAVE_KEYS = {'name', 'mode', 'sets'}

def _lean_exercises(exercises):
    """Keep only name/mode/sets — drop library metadata (pattern, family, muscles, etc.)."""
    return [{k: ex[k] for k in _EXERCISE_SAVE_KEYS if k in ex} for ex in exercises]


def add_workout(workout):
    """Add a new workout and update fatigue + weekly_load."""
    workouts = get_workouts()

    if 'date' not in workout:
        workout['date'] = datetime.now().strftime('%Y-%m-%d')

    for existing in workouts:
        if is_duplicate(existing, workout):
            raise ValueError(f"Workout already exists for {workout.get('date', 'unknown date')}")

    import time
    import random
    workout['id'] = f"{workout['date']}_{int(time.time() * 1000)}_{random.randint(1000, 9999)}"
    workout['exercises'] = _lean_exercises(workout.get('exercises', []))

    workouts.append(workout)
    save_all_workouts(workouts)
    return workout

def update_workout(workout_id, exercises):
    """Update exercises of an existing workout."""
    workouts = get_workouts()

    for i, workout in enumerate(workouts):
        if workout.get('id') == workout_id:
            workouts[i] = {
                'date': workout.get('date'),
                'id': workout.get('id'),
                'exercises': _lean_exercises(exercises)
            }
            save_all_workouts(workouts)
            return workouts[i]

    raise ValueError(f"Workout with ID {workout_id} not found")

def delete_workout(workout_id):
    """Delete an existing workout."""
    workouts = get_workouts()
    
    # Find and remove the workout by unique ID
    for i, workout in enumerate(workouts):
        if workout.get('id') == workout_id:
            del workouts[i]
            save_all_workouts(workouts)
            return
    
    # Fallback to date-based deletion for backward compatibility
    for i, workout in enumerate(workouts):
        if workout.get('date') == workout_id:
            del workouts[i]
            save_all_workouts(workouts)
            return
    
    raise ValueError(f"Workout with ID {workout_id} not found")

def save_all_workouts(workouts):
    """Save all workouts for current user."""
    _write("workouts", workouts)

def is_duplicate(existing, new):
    """Check if two workouts are duplicates (same date + same exercise names)."""
    if existing.get("date") != new.get("date"):
        return False
    existing_names = sorted([e["name"] for e in existing.get("exercises", [])])
    new_names = sorted([e["name"] for e in new.get("exercises", [])])
    return existing_names == new_names


def migrate_strip_exercise_meta():
    """
    One-time (idempotent) migration: strip pattern/family/muscles from every
    exercise in every workout for every user.
    """
    _STRIP = {'pattern', 'family', 'muscles', 'description', 'difficulty', 'priority', 'enabled'}

    def _process_file(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                workouts = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return
        changed = False
        for w in workouts:
            for ex in w.get('exercises', []):
                for key in list(ex.keys()):
                    if key in _STRIP:
                        del ex[key]
                        changed = True
        if changed:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(workouts, f, indent=2)

    _process_file(os.path.join(DATA_DIR, 'default', 'workouts.json'))
    users_dir = os.path.join(DATA_DIR, 'users')
    if os.path.exists(users_dir):
        for user in os.listdir(users_dir):
            _process_file(os.path.join(users_dir, user, 'workouts.json'))


def get_today_workout():
    """Return the first workout logged for today, or None."""
    today = date.today().isoformat()
    for w in get_workouts():
        if w.get("date") == today:
            return w
    return None


def get_exercise_progress(exercise_name):
    """Get progress data for a specific exercise."""
    workouts = get_workouts()[::-1]  # Latest first

    last = None
    best = None
    best_score = 0

    for w in workouts:
        for ex in w.get("exercises", []):
            if ex["name"] != exercise_name:
                continue

            # Calculate volume score: duration for time-mode, reps*weight for reps-mode
            sets = ex.get("sets", [])
            if sets and "duration_sec" in sets[0]:
                volume = sum(s.get("duration_sec", 0) for s in sets)
            else:
                volume = sum(s.get("reps", 0) * s.get("weight", 0) for s in sets)

            if volume > best_score:
                best_score = volume
                best = {
                    "date": w["date"],
                    "volume": volume,
                    "sets": ex.get("sets", [])
                }

            if last is None:
                last = {
                    "date": w["date"],
                    "volume": volume,
                    "sets": ex.get("sets", [])
                }

    # Format for display
    def format_display(data):
        if not data or not data.get("sets"):
            return None
        sets = data["sets"]
        if not sets:
            return None
        if any("duration_sec" in s for s in sets):
            top_set = max(sets, key=lambda s: s.get("duration_sec", 0))
            return f"{top_set.get('duration_sec', 0)}s × {top_set.get('weight', 0)}"
        top_set = max(sets, key=lambda s: s.get("reps", 0) * s.get("weight", 0))
        return f"{top_set.get('reps', 0)} × {top_set.get('weight', 0)}"

    return {
        "last": last,
        "best": best,
        "last_display": format_display(last),
        "best_display": format_display(best)
    }
