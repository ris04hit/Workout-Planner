# Storage Layer

**Source:** `src/storage/`

All persistence is flat JSON files on disk — no database. Each user gets their own directory. The storage layer presents a clean function-based API to the rest of the codebase; nothing outside `src/storage/` ever touches the filesystem directly.

---

## File Layout

```
data/
  users.json                 # gitignored — { "users": ["alice", "bob"] }
  default/                   # default user data
    exercises.json           # tracked — flat exercise list
    config.json              # tracked — default config values
    workouts.json            # gitignored — []
    soreness.json            # gitignored — {}
    config_history.json      # gitignored — []
  users/                     # gitignored
    alice/
      exercises.json
      config.json
      workouts.json
      ...
    bob/
      ...
```

Fatigue and weekly load are **not stored as files**. They are computed on demand from the full `workouts.json` history by `compute_fatigue_from_history()` and `compute_weekly_load_from_history()` in `core_logic.py`.

---

## Base Layer (`storage/base.py`)

### User context

A module-level global `_current_user` tracks the active user for the duration of each request. Every API handler sets it before calling any storage function:

```python
username = request.args.get('user') or get_current_user()
set_current_user(username)
# ... now all storage calls use this user
```

This avoids threading issues because Flask (in dev mode, single worker) processes one request at a time. **Do not call storage functions across requests without resetting the user context.**

### `_read(key, default=None)`

```python
file_path = _get_user_file_path(f"{key}.json")
# → data/default/{key}.json           for the default user
# → data/users/{username}/{key}.json  for real users

with open(file_path) as f:
    return json.load(f)
# Returns `default` on FileNotFoundError or JSONDecodeError
```

### `_write(key, data)`

```python
file_path = _get_user_file_path(f"{key}.json")
os.makedirs(os.path.dirname(file_path), exist_ok=True)
with open(file_path, 'w') as f:
    json.dump(data, f, indent=2)
```

`makedirs` is called on every write so user directories are created lazily on first write.

---

## Workout Storage (`storage/workouts.py`)

### Data shape

Saved workouts intentionally keep only logging data. Exercise-library metadata (`pattern`, `family`, `muscles`, descriptions, difficulty, priority, enabled) is not persisted in workout history. The frontend enriches history entries from the current exercise library when it needs labels, chips, or descriptions.

```json
[
  {
    "id": "2024-01-15_1705312345678_4231",
    "date": "2024-01-15",
    "exercises": [
      {
        "name": "Squat",
        "mode": "reps",
        "sets": [
          { "reps": 8, "weight": 100 },
          { "reps": 6, "weight": 110 }
        ]
      },
      {
        "name": "Plank",
        "mode": "time",
        "sets": [
          { "duration_sec": 60, "weight": 0 }
        ]
      }
    ]
  }
]
```

### ID generation

```python
workout['id'] = f"{date}_{int(time.time() * 1000)}_{random.randint(1000, 9999)}"
```

Date prefix makes IDs human-readable and sortable. The millisecond timestamp + 4-digit random suffix makes collisions essentially impossible.

### Duplicate detection

`is_duplicate(existing, new)` returns `True` if:
- Same date, AND
- Same exercise names (sorted, case-sensitive)

Raises `ValueError` if duplicate → API returns HTTP 409.

### Metadata cleanup migration

`migrate_strip_exercise_meta()` runs once at app startup and is idempotent. It scans `data/default/workouts.json` and every `data/users/<username>/workouts.json`, removing stale exercise-library metadata from old workout entries. It leaves `name`, `mode`, and `sets` intact.

### Backward-compatible deletion

`delete_workout(workout_id)` tries to match by `id` first, then falls back to matching by `date`. This supports old entries that pre-date the ID field.

### Progress calculation

`get_exercise_progress(exercise_name)` scans all workouts and returns:
- `last` — most recent session's sets
- `best` — session with highest volume
- `last_display` / `best_display` — formatted strings

Volume by set mode:
- Reps: `sum(reps × weight)`
- Time: `sum(duration_sec)`

---

## Exercise & Soreness Storage (`storage/exercises.py`)

### Exercise data shape

```json
[
  {
    "name": "Squat",
    "enabled": true,
    "difficulty": 3,
    "priority": 5,
    "pattern": "SQUAT",
    "family": "SQUAT",
    "muscles": { "QUADS": 0.8, "GLUTES": 0.6, "CORE": 0.3 }
  },
  { "name": "Deadlift", "pattern": "HINGE", "family": "DEADLIFT", ... }
]
```

Exercises are a **flat list** — not grouped by muscle. Each entry has `name`, `enabled`, `difficulty`, `priority`, `pattern`, `family`, and `muscles` (a contribution map, floats in `(0, 1]`).

`get_exercises()` falls back to `_load_default_exercises()` if no user file exists, which reads `data/default/exercises.json` and saves a copy into the user's directory.

`get_all_muscle_names()` derives the set of all unique muscle keys across all exercises — used to normalise soreness state.

### Soreness data shape

```json
{ "QUADS": false, "GLUTES": true, "CHEST": false, ... }
```

`get_soreness()` normalises the stored dict against all muscle names from the exercise list. Adding a new exercise with a new muscle automatically adds it to soreness state on next read.

---

## Config Storage (`storage/config.py`)

Only the user's **overrides** are stored. `get_config()` returns `{}` when no overrides exist. The full effective config is computed at request time by `get_effective_config()` in `core_logic.py`, which deep-merges stored overrides over the defaults from `data/default/config.json`.

### Config history

Every save appends a snapshot to `config_history.json`:

```json
[
  {
    "timestamp": "2024-01-15T14:30:00",
    "config": { ... full config at that point ... }
  }
]
```

Capped at 20 entries (oldest discarded). Reverting overwrites the config and appends another history entry.

---

## User Management (`storage/users.py`)

`data/users.json` structure:

```json
{ "users": ["alice", "bob"] }
```

`create_user(username, copy_from_default=False)` — creates the user entry and optionally copies all JSON files from `data/default/` as the starting point. Raises `ValueError` if the username already exists or is `"default"`.

`delete_user(username)` — removes the user from the list and deletes their directory recursively. Cannot delete `"default"`.

---

## Storage Module Exports (`storage/__init__.py`)

Everything needed by the API layer is re-exported from the package `__init__`:

```python
from .base import get_current_user, set_current_user, _read, _write, DATA_DIR, DEFAULT_USER
from .workouts import get_workouts, add_workout, update_workout, delete_workout,
                      get_exercise_progress, get_today_workout
from .exercises import get_exercises, save_exercises, get_soreness, save_soreness,
                       get_all_muscle_names
from .config import get_config, set_config, get_config_history, reset_config,
                    revert_config, get_effective_config, validate_config
from .users import get_users, create_user, delete_user, ensure_user_exists
```

API handlers import from `storage` as a package: `from storage import get_workouts, add_workout`.

---

## Error Handling Conventions

- `_read` returns `default` on any file error — caller chooses the default (`[]`, `{}`, etc.)
- Storage functions raise `ValueError` for domain errors (not-found, duplicate, invalid input)
- The API layer catches `ValueError` → HTTP 400 or 409, bare `Exception` → HTTP 500
