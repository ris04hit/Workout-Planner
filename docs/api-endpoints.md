# API Reference

Base URL: `http://localhost:5000`  
All request and response bodies are JSON (`Content-Type: application/json`).  
All endpoints accept an optional `?user=<username>` query parameter to scope the request to a specific user. If omitted, the server uses the current user context (last user set via `/api/current-user`).

---

## Table of Contents

- [Users](#users)
- [Workouts](#workouts)
- [Suggestion](#suggestion)
- [Exercises & Soreness](#exercises--soreness)
- [Config](#config)
- [Progress](#progress)

---

## Users

### `GET /api/users`

Returns the list of all usernames.

**Response `200`**
```json
["alice", "bob", "default"]
```

---

### `POST /api/users`

Creates a new user. Optionally copies all data files from the `default` user.

**Request body**
```json
{
  "username": "alice",
  "copy_from_default": true
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `username` | string | ✓ | — | Must be unique, not `"default"` |
| `copy_from_default` | bool | | `false` | Copy all JSON files from `data/default/` |

**Response `200`**
```json
{ "status": "ok", "username": "alice" }
```

**Errors**

| Status | Condition |
|---|---|
| `400` | `username` missing, empty, or already exists |
| `500` | Unexpected server error |

---

### `DELETE /api/users/<username>`

Permanently deletes a user and all their data. Cannot delete `"default"`.

> ⚠️ Destructive — no confirmation. Data cannot be recovered.

**Response `200`**
```json
{ "status": "ok" }
```

**Errors**

| Status | Condition |
|---|---|
| `400` | User not found, or attempting to delete `"default"` |

---

### `GET /api/current-user`

**Response `200`**
```json
{ "current_user": "alice" }
```

---

### `POST /api/current-user`

Sets the active user in the server-side context. In practice, the frontend passes `?user=` on every request instead.

**Request body**
```json
{ "username": "alice" }
```

**Response `200`**
```json
{ "status": "ok", "current_user": "alice" }
```

---

## Workouts

### `GET /api/workout`

Returns the full workout history, oldest first.

**Response `200`**
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

---

### `GET /api/history`

Alias for `GET /api/workout`. Returns identical data.

---

### `POST /api/workout`

Saves a new workout. Rejects duplicates (same date + same exercise names).

**Request body**
```json
{
  "exercises": [
    {
      "name": "Squat",
      "mode": "reps",
      "sets": [{ "reps": 8, "weight": 100 }]
    }
  ]
}
```

**Field rules**

| Field | Type | Rules |
|---|---|---|
| `exercises` | object[] | Can be empty `[]` |
| `exercise.name` | string | Non-empty |
| `exercise.mode` | string | `"reps"` or `"time"` |
| `set.reps` | int | Positive; required when `mode == "reps"` |
| `set.duration_sec` | int | Positive; required when `mode == "time"` |
| `set.weight` | float | Non-negative; required in both modes |

**Response `200`** — the saved workout object (with generated `id` and `date`)

**Errors**

| Status | Condition |
|---|---|
| `400` | Validation failure |
| `409` | `{ "status": "duplicate", "error": "..." }` |
| `500` | Unexpected server error |

---

### `PUT /api/workout/<workout_id>`

Updates an existing workout. Preserves the original `date`.

**Request body** — same shape as `POST /api/workout`

**Response `200`** — the updated workout object

**Errors**

| Status | Condition |
|---|---|
| `400` | Validation failure or workout not found |

---

### `DELETE /api/workout/<workout_id>`

Deletes a workout by ID (falls back to date-based match for old entries).

**Response `200`**
```json
{ "status": "ok" }
```

---

## Suggestion

### `GET /api/suggest`

Computes fatigue and weekly load from workout history, scores all exercises, and returns the top selection.

**Response `200`**
```json
{
  "exercises": [
    {
      "name": "Deadlift",
      "pattern": "HINGE",
      "family": "DEADLIFT",
      "muscles": { "HAMSTRINGS": 0.8, "GLUTES": 0.7, "LATS": 0.3 },
      "difficulty": 3,
      "priority": 5,
      "enabled": true
    }
  ],
  "grouped_by_pattern": {
    "HINGE": [ ... ],
    "PUSH":  [ ... ]
  },
  "fatigue":      { "QUADS": 0.4, "HAMSTRINGS": 0.0 },
  "weekly_load":  { "QUADS": 1.6, "CHEST": 0.8 },
  "all_scores":   { "Squat": 8.2, "Deadlift": 9.1 },
  "done_today":   false
}
```

See `docs/codebase/suggestion-algorithm.md` for the full algorithm.

---

### `GET /api/fatigue`

Returns the current computed fatigue and weekly load (same values as in `/api/suggest`, without triggering a full exercise selection).

**Response `200`**
```json
{
  "fatigue":     { "QUADS": 0.4, "HAMSTRINGS": 0.0 },
  "weekly_load": { "QUADS": 1.6, "CHEST": 0.8 }
}
```

---

## Exercises & Soreness

### `GET /api/exercises`

Returns the full flat exercise list.

**Response `200`**
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

**Exercise object fields**

| Field | Type | Description |
|---|---|---|
| `name` | string | Exercise name |
| `difficulty` | int 1–5 | 1 = very easy, 5 = very hard |
| `enabled` | bool | If `false`, excluded from suggestions |
| `priority` | int 1–5 | Higher = preferred by scoring engine |
| `pattern` | string | Movement pattern: `SQUAT`, `HINGE`, `PUSH`, `PULL`, `CORE`, `ACCESSORY` |
| `family` | string | Deduplication key — at most one per family per session |
| `muscles` | object | `{ MUSCLE: contribution }` — floats in `(0, 1]` |

If no file exists for the user, the default list from `data/default/exercises.json` is returned and saved automatically.

---

### `POST /api/exercises`

Replaces the entire exercise list.

**Request body** — array, same shape as `GET` response

**Response `200`**
```json
{ "status": "ok", "exercises": [ ... ] }
```

---

### `PUT /api/exercises/<exercise_name>`

Updates a single exercise by name (URL-encoded).

**Request body** — partial or full exercise object

**Response `200`**
```json
{ "status": "ok", "exercise": { ... } }
```

**Errors**

| Status | Condition |
|---|---|
| `404` | Exercise not found |

---

### `DELETE /api/exercises/<exercise_name>`

Removes an exercise by name.

**Response `200`**
```json
{ "status": "ok" }
```

---

### `GET /api/soreness`

Returns the current soreness state for all individual muscles.

**Response `200`**
```json
{
  "QUADS": false,
  "GLUTES": false,
  "HAMSTRINGS": false,
  "CALVES": false,
  "CHEST": false,
  "SHOULDERS": false,
  "TRICEPS": false,
  "LATS": false,
  "BICEPS": false,
  "REAR_DELTS": false,
  "FOREARMS": false,
  "CORE": false
}
```

Muscles not in the stored file default to `false`. The set of muscles is derived from the exercise list — adding a new exercise with a new muscle name automatically includes it.

---

### `POST /api/soreness`

Saves the soreness state. Frontend sends the full object on every toggle.

**Request body** — same shape as `GET` response (partial allowed; missing keys unchanged)

**Response `200`**
```json
{ "soreness": { "QUADS": false, "GLUTES": true, ... } }
```

---

## Config

### `GET /api/config`

Returns the stored user config overrides merged with defaults. See `data/default/config.json` for all keys and their default values.

**Response `200`** (representative subset)
```json
{
  "muscle_weights": {
    "QUADS": 2.5, "GLUTES": 2.5, "HAMSTRINGS": 2.5, "CALVES": 1.0,
    "CHEST": 2.5, "SHOULDERS": 2.0, "TRICEPS": 1.5,
    "LATS": 2.5, "BICEPS": 1.5, "REAR_DELTS": 1.0, "FOREARMS": 1.0,
    "CORE": 2.0
  },
  "fatigue_decay": 0.85,
  "max_difficulty_allowed": 5,
  "target_exercise_count": 6,
  "pattern_limits": {
    "SQUAT": 2, "HINGE": 2, "PUSH": 3, "PULL": 3, "CORE": 2, "ACCESSORY": 3
  },
  "muscle_usage_limit": 1.4,
  "sore_block_threshold": 0.6,
  "fatigue_block_threshold": 0.9,
  "fatigue_block_contribution": 0.5,
  "sore_penalty_factor": 3.0,
  "weekly_targets": {
    "QUADS":      { "min": 2, "mid": 3, "max": 4 },
    "GLUTES":     { "min": 2, "mid": 3, "max": 4 },
    "HAMSTRINGS": { "min": 1, "mid": 2, "max": 3 },
    "CHEST":      { "min": 1, "mid": 2, "max": 3 }
  },
  "scoring": {
    "max_total_contribution": 1.3,
    "scaling_exponent": 0.8,
    "weekly_boost_untrained": 2.0,
    "weekly_boost_below_min": 1.25,
    "weekly_boost_below_mid": 0.5,
    "priority_coeff": 0.2,
    "recency_penalty": 1.5,
    "recency_history_sessions": 2
  }
}
```

**Key reference**

| Key | Description |
|---|---|
| `muscle_weights` | Per-muscle importance in readiness scoring |
| `fatigue_decay` | Daily fatigue multiplier (0.85 = 15% clears per rest day) |
| `max_difficulty_allowed` | Hard ceiling on exercise difficulty |
| `target_exercise_count` | Target exercises per session |
| `pattern_limits` | Max exercises per movement pattern per session |
| `muscle_usage_limit` | Max accumulated contribution per muscle per session |
| `sore_block_threshold` | Contribution above which a sore muscle hard-blocks |
| `fatigue_block_threshold` | Fatigue level above which fatigue block activates |
| `fatigue_block_contribution` | Contribution threshold for fatigue block |
| `sore_penalty_factor` | Score penalty multiplier for sore muscles |
| `weekly_targets.<m>.min/mid/max` | Weekly training frequency targets per muscle |
| `scoring.max_total_contribution` | Cap on total muscle contributions before scoring |
| `scoring.scaling_exponent` | Sublinear scaling exponent (`< 1` reduces compound advantage) |
| `scoring.weekly_boost_*` | Weekly boost magnitudes for untrained / below-min / below-mid |
| `scoring.priority_coeff` | Points added per unit of priority (1–5) |
| `scoring.recency_penalty` | Score reduction for recently repeated exercises |
| `scoring.recency_history_sessions` | How many recent sessions to check for recency penalty |

---

### `POST /api/config`

Saves config overrides. Partial payloads valid — missing keys fall through to defaults.

**Response `200`**
```json
{ "config": { ... } }
```

**Errors** — `400` on validation failure

---

### `POST /api/config/reset`

Resets to factory defaults (deletes stored overrides).

**Response `200`**
```json
{ "config": { ... } }
```

---

### `GET /api/config/history`

Returns config snapshots, newest first. Capped at 20 entries.

**Response `200`**
```json
[
  { "timestamp": "2024-01-15T14:30:00", "config": { ... } },
  { "timestamp": "2024-01-10T09:15:00", "config": { ... } }
]
```

---

### `POST /api/config/revert`

Reverts to a history entry by index (0 = most recent).

**Request body**
```json
{ "index": 0 }
```

**Response `200`**
```json
{ "config": { ... } }
```

**Errors** — `400` if index out of range or history empty

---

## Progress

### `GET /api/progress/<exercise_name>`

Returns last session and personal best for a named exercise.

**URL param:** `exercise_name` — exact exercise name (URL-encoded if it contains spaces)

**Response `200`**
```json
{
  "last": {
    "date": "2024-01-15",
    "volume": 800,
    "sets": [
      { "reps": 8, "weight": 100 },
      { "reps": 6, "weight": 110 }
    ]
  },
  "best": {
    "date": "2024-01-10",
    "volume": 1200,
    "sets": [
      { "reps": 10, "weight": 120 },
      { "reps": 8,  "weight": 120 }
    ]
  },
  "last_display": "8 × 100",
  "best_display": "10 × 120"
}
```

| Field | Description |
|---|---|
| `last` | Most recent session containing this exercise |
| `best` | Session with highest total volume |
| `volume` | Reps mode: `sum(reps × weight)`; Time mode: `sum(duration_sec)` |
| `*_display` | Human-readable best-set string |

All fields are `null` if the exercise has never been logged.

**Errors** — `500` on unexpected read failure

---

## Valid Muscles

All muscle names used in `muscle_weights`, `weekly_targets`, `soreness`, and exercise `muscles` maps:

| Muscle | Category |
|---|---|
| `QUADS` | Lower body |
| `GLUTES` | Lower body |
| `HAMSTRINGS` | Lower body |
| `CALVES` | Lower body |
| `CHEST` | Upper push |
| `SHOULDERS` | Upper push |
| `TRICEPS` | Upper push |
| `LATS` | Upper pull |
| `BICEPS` | Upper pull |
| `REAR_DELTS` | Upper pull |
| `FOREARMS` | Upper pull |
| `CORE` | Core |

Adding a new exercise with a muscle not in this list automatically adds it to the soreness state.

---

## Error Response Shape

```json
{ "error": "Human-readable message" }
```

With optional details for server errors:

```json
{ "error": "Failed to get progress data", "details": "list index out of range" }
```

Duplicate workout response (HTTP 409):

```json
{ "status": "duplicate", "error": "Workout already exists for 2024-01-15" }
```
