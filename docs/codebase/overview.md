# Codebase Overview

## Architecture

The app is a **Flask single-page application**. The server renders one HTML page and exposes a REST API; all UI interaction after that is driven by vanilla ES modules in the browser.

```
Browser (ES Modules)
    │
    │  HTTP / JSON
    ▼
Flask Server  (src/)
    │
    │  Python function calls
    ▼
Storage Layer  (src/storage/)
    │
    │  JSON file I/O
    ▼
data/  (one directory per user)
```

---

## Directory Structure

```
workout/
├── src/                        # All Python server code
│   ├── app.py                  # Flask app factory, route registration
│   ├── __main__.py             # Entry point: python -m src
│   ├── core_logic.py           # Exercise suggestion + fatigue algorithm
│   ├── api/                    # Route handlers (one file per domain)
│   │   ├── workouts.py         # /api/workout, /api/suggest, /api/history,
│   │   │                       # /api/fatigue, /api/progress/<exercise>
│   │   ├── exercises.py        # /api/exercises, /api/soreness
│   │   ├── config.py           # /api/config, /api/config/history
│   │   └── users.py            # /api/users, /api/current-user
│   └── storage/                # Data access layer
│       ├── __init__.py         # Re-exports all public functions
│       ├── base.py             # _read / _write, user context
│       ├── workouts.py         # Workout CRUD + progress
│       ├── exercises.py        # Exercise list + soreness
│       ├── config.py           # Config + history
│       └── users.py            # User management
│
├── static/
│   ├── style.css
│   └── js/                     # Frontend ES modules
│       ├── main.js             # App entry point, event wiring
│       ├── state.js            # Single shared state object
│       ├── api.js              # fetch wrappers (apiGet / apiPost)
│       ├── workout.js          # Save/load/edit workouts, soreness, suggestion
│       ├── ui.js               # All DOM rendering
│       ├── config.js           # Config read/write, exercise management
│       ├── sets.js             # Set row management
│       ├── progress.js         # Progress display helpers
│       ├── analytics.js        # Analytics data processing
│       ├── analytics-ui.js     # Analytics rendering
│       ├── export-import.js    # Export/import modal
│       ├── user-manager.js     # Multi-user UI
│       ├── mobile.js           # Mobile responsiveness
│       └── accessibility.js    # Keyboard / ARIA support
│
├── templates/
│   └── index.html              # Single HTML page
│
├── data/
│   ├── default/                # Tracked in git — seed data
│   │   ├── exercises.json      # Default exercise list
│   │   ├── config.json         # Default configuration
│   │   └── users/<username>/       # Per-user data (gitignored)
│
├── tests/
│   ├── src/
│   │   ├── api/                # Tests for src/api/
│   │   ├── storage/            # Tests for src/storage/
│   │   ├── test_app.py
│   │   └── test_core_logic.py
│   └── static/js/              # Jest tests for static/js/
│
├── scripts/
│   ├── setup.sh                # One-time environment setup
│   ├── init_default_data.py    # Creates gitignored runtime files
│   └── run.sh                  # Start the server
│
├── conftest.py                 # Adds src/ to sys.path for pytest
├── requirements.txt
└── package.json
```

---

## Request Lifecycle

1. Browser loads `GET /` → Flask serves `templates/index.html`
2. HTML loads `static/js/main.js` as an ES module
3. `main.js` runs `DOMContentLoaded`:
   - Loads config, exercise list, soreness
   - Calls `/api/suggest` → renders today's suggested workout
   - Calls `/api/history` → renders workout log
4. User interactions call API endpoints; responses update `state.js` and re-render via `ui.js`

---

## State Management

All frontend state lives in a single object in `state.js`:

```js
state = {
  exercises: [],      // suggested exercises for today (from /api/suggest)
  muscles: [],        // full flat exercise list (from /api/exercises)
  soreness: {},       // { MUSCLE: bool } — per individual muscle
  fatigue: {},        // { MUSCLE: float } — from /api/suggest response
  weeklyLoad: {},     // { MUSCLE: float } — from /api/suggest response
  config: null,       // effective config from /api/config
  configHistory: [],  // snapshots from /api/config/history
  workouts: [],       // full workout history
  ui: {
    exerciseMap: {},  // { exerciseName: { id, name } } — rendered exercise cards
  }
}
```

There is no reactive framework — functions read/write `state` directly and call render functions explicitly.

---

## Data Storage Model

Each user's data is stored as flat JSON files in `data/users/<username>/`. The `default` user uses `data/default/`.

| File | Tracked in git | Content |
|---|---|---|
| `exercises.json` | ✓ | Flat exercise list with muscle contributions |
| `config.json` | ✓ | User config overrides (merged over defaults at runtime) |
| `workouts.json` | — | Array of all logged workouts |
| `soreness.json` | — | Per-muscle soreness flags |
| `config_history.json` | — | Array of past config snapshots |

Fatigue and weekly load are **not stored** — they are computed on demand from the full workout history by `compute_fatigue_from_history()` and `compute_weekly_load_from_history()` in `core_logic.py`.

Workout entries store only logging data: exercise `name`, `mode`, and `sets`. Exercise-library metadata is loaded from `exercises.json` when history or edit screens need pattern labels, muscle chips, or descriptions.

The `_read(key, default)` / `_write(key, data)` functions in `src/storage/base.py` handle all file I/O, resolving paths based on `_current_user` (a module-level global set by each API handler before any storage call).

---

## Adding a New Feature

See `docs/contributing.md` for the full rules. In short:
1. Add a storage function in `src/storage/`
2. Add an API route in `src/api/`
3. Register the route in `src/app.py`
4. Add a JS module or extend an existing one in `static/js/`
5. Update `state.js` if new state is needed
6. Add tests in `tests/src/api/` and `tests/static/js/`
7. Update `docs/api-endpoints.md`
