# Workout Planner

A personal workout tracking app with an intelligent exercise suggestion engine, per-user data isolation, exercise progression tracking, and a fully configurable exercise library.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Setup](#setup)
3. [Running the App](#running-the-app)
4. [Running Tests](#running-tests)
5. [UI Guide](#ui-guide)
   - [First Launch — Create a User](#first-launch--create-a-user)
   - [Workout Builder](#workout-builder)
   - [Workout Logging](#workout-logging)
   - [Config](#config)
   - [Exercise Library](#exercise-library)
   - [History](#history)
   - [Analytics & Progress](#analytics--progress)
6. [Multi-User Support](#multi-user-support)
7. [Data Storage](#data-storage)

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.10+ | [python.org](https://python.org) |
| Node.js | 18+ (LTS) | [nodejs.org](https://nodejs.org) — only needed for JS tests |
| Git Bash / WSL | any | Required to run `.sh` scripts on Windows |

---

## Setup

Run **once** from the project root directory.

**Step 1 — Clone the repo (if not done already)**
```bash
git clone <repo-url>
cd workout
```

**Step 2 — Run the setup script**
```bash
bash scripts/setup.sh
```

This will:
- Detect your Python installation and create a `venv/` virtual environment
- Install all Python dependencies from `requirements.txt`
- Install Node.js dependencies via `npm install` (if Node is available)
- Create the `data/` directory structure with the correct default config and exercise files

> The script is **idempotent** — safe to re-run. It skips anything that already exists.

**Step 3 — Verify setup (optional)**
```bash
# Python tests
python -m pytest tests/ -q

# JS tests (requires Node.js)
npm test
```

---

## Running the App

```bash
bash scripts/run.sh
```

Or manually:
```bash
# Windows (Git Bash)
source venv/Scripts/activate

# macOS / Linux
source venv/bin/activate

python -m src
```

The app starts at **http://localhost:5000** — open it in your browser.

To stop: press `Ctrl+C` in the terminal.

---

## Running Tests

### Python tests
```bash
python -m pytest tests/ -q
```

### Python tests with detail
```bash
python -m pytest tests/ -v --tb=short
```

### JavaScript tests
```bash
npm test
```

### Specific test file
```bash
python -m pytest tests/src/api/test_workouts.py -v
```

---

## UI Guide

### First Launch — Create a User

On first launch, the app detects no users exist and shows a **"Create User"** modal.

1. Type a username (e.g. `john`)
2. Click **Create** — all your data will be stored under this name
3. The app loads fully with your user selected

> To switch users later, use the **user switcher** at the top of the page.

---

### Workout Builder

The **Workout Builder** section is collapsible (click the heading to expand/collapse).

**Step 1 — Mark soreness**
- The **Soreness** panel shows a toggle for each muscle
- Toggle any muscle that is currently sore — the algorithm will penalise or block exercises that heavily load sore muscles

**Step 2 — Generate today's suggestion**
- Click **Generate Workout**
- The server scores every enabled exercise against your fatigue, weekly load, soreness, and history, then greedily selects a balanced session
- The result shows:
  - **Suggested exercises** — the selected set with individual scores
  - **Fatigue display** — current per-muscle fatigue and weekly load
  - **Score breakdown** — why each exercise was or was not selected

**Step 3 — Accept or re-generate**
- If you are happy with the suggestion, scroll down to **Workout Logging** to log sets
- Click **Generate Workout** again at any time (scores are deterministic for the same state)

---

### Workout Logging

**Step 1 — Review the suggested exercises**
- The workout area shows exercise cards for the selected session
- Exercise cards are collapsible; collapsed cards show a set-count badge after sets are added

**Step 2 — Log each exercise**
- Each exercise card has a mode selector: **Reps** or **Time**
- For **Reps mode**: enter reps and weight (kg) per set
- For **Time mode**: enter duration (seconds) and weight (kg) per set
- Click **+ Add Set** to add more sets
- Click **✕** next to a set row to remove it

**Step 3 — Save the workout**
- Click **Save Workout**
- The app saves the workout with today's date; fatigue and weekly load are recomputed from history on the next suggestion
- Workout history stores only exercise name, mode, and sets; current exercise-library metadata is re-applied when displaying or editing past workouts

**Editing a past workout**
- Go to the **History** section
- Click **Edit** next to any past workout
- The workout loads back into the Workout Logging section — make changes and click **Save Workout**

---

### Config

Expand the **Config** section to tune the suggestion algorithm.

**Muscle weights** — per-muscle importance multiplier; higher weight = muscle is more urgently suggested

**Weekly targets** — `min` / `mid` / `max` sessions per week per muscle; drives the weekly boost factor in scoring

**Scoring parameters**
| Setting | Description |
|---|---|
| `fatigue_decay` | Daily fatigue decay factor (0–1); higher = faster recovery |
| `max_difficulty_allowed` | Filters out exercises above this difficulty (1–5 scale) |
| `target_exercise_count` | How many exercises to include per session |
| `pattern_limits` | Max exercises per movement pattern (SQUAT, HINGE, PUSH, PULL, CORE, ACCESSORY) |
| `muscle_usage_limit` | Stop adding exercises once this fraction of a muscle's capacity is committed |
| `sore_block_threshold` | Contribution fraction above which a sore muscle blocks an exercise |
| `fatigue_block_threshold` | Fatigue level above which a muscle blocks further exercises |
| `fatigue_block_contribution` | Contribution fraction required before fatigue can hard-block an exercise |
| `recency_penalty` | Score penalty when the exact exercise was performed recently |
| `family_recency_penalty` | Smaller score penalty when another exercise from the same family was performed recently |
| `recency_decay` | Per-day decay for exercise and family repeat penalties |
| `min_score_threshold` | Normal-pass score floor; low-scoring exercises are skipped unless fallback is needed |

**Saving config**
1. Adjust values in the form
2. Click **Save Config**
3. The new config is applied immediately; a snapshot is saved to **Config History**

**Reverting config**
- The **Config History** panel lists all past configs with timestamps
- Click **Revert** next to any entry to restore that exact config

**Resetting to defaults**
- Click **Reset Defaults** to restore all values to `data/default/config.json`

---

### Exercise Library

Expand the **Exercise Library** section to customise your exercise list.

Each exercise has:
- **Name** — unique identifier used in workout logs
- **Pattern** — movement category (`SQUAT`, `HINGE`, `PUSH`, `PULL`, `CORE`, `ACCESSORY`)
- **Family** — deduplication group (only one exercise per family per session)
- **Difficulty** — 1–5 scale; exercises above `max_difficulty_allowed` are filtered out
- **Priority** — 1–5 scoring bonus; higher priority exercises score higher when fatigue is equal
- **Muscles** — contribution map `{ MUSCLE: float }` where `float ∈ (0, 1]`
- **Enabled** — toggle to include/exclude from suggestions without deleting

**Add an exercise**
1. Click **+ Add Exercise**
2. Fill in all fields; the muscles map drives the fatigue and scoring calculations
3. Click **Save Exercises**

**Remove an exercise**
1. Click **✕** next to an exercise name
2. Click **Save Exercises**

**Enable / disable**
- Use the toggle next to each exercise — disabled exercises are kept in the library but never suggested
- Suggested exercises also include a **Disable** button for quickly removing an exercise from future suggestions

> Changes refresh suggestions immediately.

---

### History

Expand the **History** section to view all logged workouts.

- Workouts are listed newest first
- Each entry is collapsible and shows: **date**, exercise count, set count, and all **exercises with sets**
- Click **Edit** to load a past workout into the Workout Logging section
- Click **Delete** to permanently remove a workout

**Export / Import**
- Click **Export/Import** to open the data transfer modal
- **Export JSON** — downloads all workout data as a JSON file
- **Export CSV** — downloads a flat CSV suitable for spreadsheets
- **Import** — upload a JSON export to restore data (duplicate dates are skipped)

---

### Analytics & Progress

Expand the **Analytics & Progress** section to track your progress over time.

- Select a **timeframe**: 7 days, 30 days, 90 days, or All Time
- Charts show per-exercise volume and weight progression over time
- The dashboard highlights personal records

**Exporting analytics**
- **Export JSON** — full analytics dataset
- **Export CSV** — tabular format for spreadsheets

---

## Multi-User Support

The app supports multiple independent users on the same instance.

- Each user has a completely isolated data store: workouts, config, exercises, soreness, history
- The active user is shown in the **user panel** at the top of the page
- Click the user name to open the **User Manager**:
  - Switch between users
  - Create new users (optionally copying config from `default`)
  - Delete users

The current user is persisted in `localStorage` so your browser remembers who you are between sessions.

---

## Data Storage

All data lives in the `data/` directory:

```
data/
  users.json              # list of usernames (gitignored)
  default/                # seed data for new users
    exercises.json        # default exercise library (tracked in git)
    config.json           # default algorithm config (tracked in git)
    workouts.json         # (empty — gitignored)
    soreness.json         # (empty — gitignored)
    config_history.json   # (empty — gitignored)
  users/<username>/       # one directory per user (gitignored)
    exercises.json
    config.json
    workouts.json
    soreness.json
    config_history.json
```

> `data/users/` and `data/users.json` are **gitignored** — your personal workout data never gets committed.
