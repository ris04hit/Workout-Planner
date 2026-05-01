# Project Index

Quick-reference map of the entire codebase for AI assistants and developers.
When working in this repo, read the relevant section here first before exploring files.

---

## What is this project?

A **personal workout tracking web app** built with Flask + vanilla ES modules.
The server scores every exercise in the library against current fatigue, weekly load, soreness, and history, then greedily selects a balanced session. All data is stored as flat JSON files per user — no database.

---

## Most Important Files

| File | Purpose |
|---|---|
| `src/core_logic.py` | ⭐ Exercise scoring + greedy session selection; fatigue/load computed from history |
| `src/storage/base.py` | `_read` / `_write` + user context — all other storage modules build on this |
| `src/storage/workouts.py` | Workout CRUD, lean workout persistence, progress calc, metadata cleanup migration |
| `src/app.py` | Flask app factory; registers all route modules |
| `static/js/main.js` | Browser entry point; init sequence + event delegation |
| `static/js/state.js` | Single shared state object + `MUSCLE_ORDER` / `PATTERN_ORDER` |
| `static/js/ui.js` | All DOM rendering — the only file that writes to the DOM |
| `data/default/exercises.json` | Master exercise list (tracked in git) |
| `data/default/config.json` | Default algorithm config (tracked in git) |
| `conftest.py` | Adds `src/` to `sys.path` so pytest resolves imports |

---

## Documentation Map

| Question | Read this |
|---|---|
| How does the suggestion algorithm work? | `docs/codebase/suggestion-algorithm.md` |
| How are exercises scored and selected? | `docs/codebase/exercise-picker.md` |
| How is data stored, per user, what files exist? | `docs/codebase/storage.md` |
| How do the frontend JS modules fit together? | `docs/codebase/frontend.md` |
| Full project architecture and directory layout | `docs/codebase/overview.md` |
| All API endpoints, params, and response shapes | `docs/api-endpoints.md` |
| How to set up and run the project | `README.md` |
| Rules for adding new code | `docs/contributing.md` |
| What has changed in each release | `docs/changelog.md` → `docs/versions/vX.Y.Z.md` |

---

## Source Code Map

### Python — `src/`

```
src/
  app.py                  Flask app factory; registers all route modules
  __main__.py             Entry point: python -m src
  core_logic.py           Fatigue computation, exercise scoring, greedy selection
  api/
    workouts.py           /api/workout  /api/history  /api/suggest
                          /api/fatigue  /api/progress/<exercise>
    exercises.py          /api/exercises  /api/soreness
    config.py             /api/config  /api/config/history
                          /api/config/reset  /api/config/revert
    users.py              /api/users  /api/current-user
  storage/
    __init__.py           Re-exports all public storage functions
    base.py               _read / _write / user context (_current_user)
    workouts.py           Workout CRUD, lean persistence, duplicate check, progress calc
    exercises.py          Flat exercise list + soreness, default fallback
    config.py             Config save/load/history/revert/reset
    users.py              User list, create, delete
```

### JavaScript — `static/js/`

```
static/js/
  main.js                 DOMContentLoaded init, event delegation
  state.js                Shared state + MUSCLE_ORDER + PATTERN_ORDER
  api.js                  apiGet / apiPost (adds ?user= to every call)
  workout.js              saveWorkout / editWorkout / loadSuggestion / loadSoreness
  sets.js                 addSet / collectSets
  ui.js                   All DOM rendering functions
  progress.js             Progress display helpers
  config.js               Config load/save/revert from UI; exercise management
  analytics.js            Analytics data processing
  analytics-ui.js         Analytics section rendering
  export-import.js        Export JSON/CSV, import JSON
  user-manager.js         Multi-user UI (self-contained class)
  mobile.js               Mobile layout adjustments (self-contained)
  accessibility.js        Keyboard nav / ARIA support (self-contained)
```

### Tests — `tests/`

```
tests/
  conftest.py             Root conftest — adds src/ to sys.path
  src/
    test_app.py           Flask app integration tests
    test_core_logic.py    Suggestion algorithm unit tests
    api/
      test_config.py
      test_exercises.py
      test_progress.py
      test_users.py
      test_workouts.py
    storage/
      test_base.py
      test_config.py
      test_exercises.py
      test_users.py
      test_workouts.py
  static/js/
    setup.js              Jest setup (fetch mock)
    api.test.js
    config.test.js
    sets.test.js
    state.test.js
```

---

## Key Algorithm — Quick Reference

### Exercise Selection (`src/core_logic.py`)

```
compute_fatigue_from_history(workouts, config, today, exercise_defs)
  → { MUSCLE: fatigue_float }   # replayed from full history with daily decay

compute_weekly_load_from_history(workouts, today, exercise_defs)
  → { MUSCLE: load_float }      # rolling 7-day contribution sum

select_workout(fatigue, weekly_load, soreness, recency, exercises, config, family_recency)
  → selected exercise list; /api/suggest also returns all_scores and already_done_today
```

Score per exercise:
```
readiness = (sum(contribution[m] * muscle_weight[m] * (1 - fatigue[m])^2)) ^ scaling_exponent
score     = readiness
          + sum(contribution[m] * weekly_bonus[m])
          + priority_coeff * priority
          - recency_penalty * recency_decay^days_since_exercise
          - family_recency_penalty * recency_decay^days_since_family
          - sum(contribution[m] * sore_penalty_factor for sore muscles)
```

Hard filters (any one blocks the exercise):
- Disabled exercise, difficulty above limit, or any muscle above fatigue/sore threshold
- Pattern limit reached (`pattern_limits`)
- Family already selected (deduplication)
- Muscle saturation (`muscle_usage_limit`)
- Score below `scoring.min_score_threshold` during the normal pass

→ Full explanation: `docs/codebase/suggestion-algorithm.md` and `docs/codebase/exercise-picker.md`

---

## Data Model — Quick Reference

All data lives in `data/`. Per-user directories are gitignored.

```
data/
  users.json                    { "users": ["alice"] }         # gitignored
  default/
    exercises.json              flat exercise list             # tracked
    config.json                 default algorithm config       # tracked
    workouts.json               []                             # gitignored
    soreness.json               {}                             # gitignored
    config_history.json         []                             # gitignored
  users/<username>/             one directory per real user    # gitignored
    exercises.json
    config.json
    workouts.json
    soreness.json
    config_history.json
```

Exercise shape:
```json
{ "name": "Squat", "enabled": true, "difficulty": 3, "priority": 5,
  "pattern": "SQUAT", "family": "SQUAT",
  "muscles": { "QUADS": 0.8, "GLUTES": 0.6, "CORE": 0.3 } }
```

Set shapes:
- Reps mode: `{ reps: int, weight: float }`
- Time mode: `{ duration_sec: int, weight: float }`

---

## API — Quick Reference

All endpoints accept `?user=<username>`. Full details in `docs/api-endpoints.md`.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/suggest` | Score + select exercises → suggestion + fatigue + scores |
| `GET` | `/api/fatigue` | Computed fatigue + weekly load only |
| `GET` | `/api/workout` | Get all workouts |
| `POST` | `/api/workout` | Save a new workout |
| `PUT` | `/api/workout/<id>` | Update a workout |
| `DELETE` | `/api/workout/<id>` | Delete a workout |
| `GET` | `/api/history` | Alias for GET /api/workout |
| `GET` | `/api/exercises` | Get flat exercise list |
| `POST` | `/api/exercises` | Replace full exercise list |
| `PUT` | `/api/exercises/<name>` | Update single exercise |
| `DELETE` | `/api/exercises/<name>` | Remove exercise |
| `GET` | `/api/soreness` | Get per-muscle soreness |
| `POST` | `/api/soreness` | Save soreness state |
| `GET` | `/api/config` | Get merged config (defaults + overrides) |
| `POST` | `/api/config` | Save config overrides |
| `POST` | `/api/config/reset` | Reset to factory defaults |
| `GET` | `/api/config/history` | Get config change history |
| `POST` | `/api/config/revert` | Revert to a history entry |
| `GET` | `/api/progress/<name>` | Exercise progress — last + personal best |
| `GET` | `/api/users` | List all users |
| `POST` | `/api/users` | Create a user |
| `DELETE` | `/api/users/<username>` | Delete a user |
| `GET` | `/api/current-user` | Get active user |
| `POST` | `/api/current-user` | Set active user |

---

## Running Things

```bash
# Setup (once)
bash scripts/setup.sh

# Run app
bash scripts/run.sh
# → http://localhost:5000

# Python tests
python -m pytest tests/ -q

# JavaScript tests
npm test
```

---

## Rules for Changes

Before adding any new code, read `docs/contributing.md`.  
The short version:
1. New storage key → add functions in `src/storage/<domain>.py`, export from `__init__.py`
2. New API endpoint → add route in `src/api/<domain>.py`, register in `src/app.py`, document in `docs/api-endpoints.md`
3. New JS module → add to `static/js/`, import in `main.js` if needed, add tests in `tests/static/js/`
4. New config field → add to `data/default/config.json` and update `get_effective_config()` in `src/core_logic.py`
5. Any change → update `docs/versions/vX.Y.Z.md` and `docs/changelog.md`
