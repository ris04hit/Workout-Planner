# Frontend Architecture

**Source:** `static/js/`

The frontend is **vanilla ES modules** — no framework, no build step. Files are loaded natively by the browser using `<script type="module">`. There is no bundler, transpiler, or virtual DOM.

---

## Module Map

```
main.js              ← Entry point
├── state.js         ← Shared mutable state
├── api.js           ← fetch wrappers
├── workout.js       ← Workout save/load/edit, soreness, suggestion
│   ├── sets.js      ← Set row add/remove/collect
│   └── ui.js        ← All DOM rendering
│       └── progress.js ← Progress display helpers
├── config.js        ← Config read/write/revert, exercise management
│   └── ui.js
├── analytics-ui.js  ← Analytics section rendering
│   └── analytics.js ← Analytics data processing
├── export-import.js ← Export/Import modal
├── user-manager.js  ← Multi-user UI (self-contained)
├── mobile.js        ← Mobile layout adjustments (self-contained)
└── accessibility.js ← Keyboard nav / ARIA (self-contained)
```

Exercise selection and scoring is done **server-side** in `src/core_logic.py`. The browser receives the already-ranked exercise list from `/api/suggest` and renders it.

---

## `state.js` — Shared State

The single source of truth for all frontend data. Every module imports `state` and reads/writes directly:

```js
export const state = {
  exercises: [],      // suggested exercises for today (from /api/suggest)
  muscles: [],        // full flat exercise list (from /api/exercises)
  config: null,       // effective config from /api/config
  configHistory: [],  // snapshots from /api/config/history
  soreness: {},       // { MUSCLE: bool }
  fatigue: {},        // { MUSCLE: float } — returned in /api/suggest response
  weeklyLoad: {},     // { MUSCLE: float } — returned in /api/suggest response
  workouts: [],       // full workout history
  ui: {
    exerciseMap: {}, // { exerciseName: { id, name } } — rendered cards
  }
};

export const MUSCLE_ORDER = [
  'QUADS','GLUTES','HAMSTRINGS','CALVES',
  'CHEST','SHOULDERS','TRICEPS',
  'LATS','BICEPS','REAR_DELTS','FOREARMS',
  'CORE'
];

export const PATTERN_ORDER = ['SQUAT','HINGE','PUSH','PULL','CORE','ACCESSORY'];
```

`MUSCLE_ORDER` controls display order in the config panel and fatigue display. `PATTERN_ORDER` controls exercise grouping order in the workout UI.

---

## `api.js` — HTTP Wrappers

```js
export async function apiGet(url)
export async function apiPost(url, data)
```

Both append the current user as `?user=...` using `localStorage.getItem('workout_current_user')`. On non-OK responses, they throw `{ status, message, payload }`.

---

## `main.js` — Initialization

`DOMContentLoaded` runs this sequence:

```
loadConfig()             → state.config
loadConfigHistory()      → state.configHistory
loadMuscles()            → state.muscles → renderWorkoutUI()
loadExerciseManagement() → renders Exercise Management section
loadSoreness()           → state.soreness
renderSorenessControls() → renders soreness toggles
loadSuggestion()         → GET /api/suggest → state.exercises, state.fatigue, state.weeklyLoad
loadHistory()            → renders History section
renderAnalyticsDashboard()
```

Event delegation for all dynamic elements:

```js
document.addEventListener('click', (e) => {
  if (e.target.matches('[data-add-set]'))       addSet(...)
  if (e.target.matches('[data-del-set]'))       remove set row
  if (e.target.matches('[data-edit]'))          editWorkout(...)
  if (e.target.matches('[data-delete]'))        deleteWorkout(...)
  if (e.target.matches('[data-revert-config]')) revertConfigFromHistory(...)
  ...
})
```

This avoids attaching/detaching listeners on every re-render.

---

## `ui.js` — Rendering

All DOM mutation lives in `ui.js`. Other modules call render functions; they never write to the DOM directly. Key functions:

| Function | What it renders |
|---|---|
| `renderSorenessControls()` | Toggle grid for each muscle |
| `renderSuggestion(exercises, scores)` | "Today's Suggestion" card with scored exercises |
| `renderWorkoutUI()` | Exercise cards grouped by pattern |
| `renderFatigueDisplay()` | Per-muscle fatigue bars |
| `renderConfigPanel()` | Config form (muscle weights, scoring params, targets) |
| `renderConfigHistory()` | Config history list with Revert buttons |
| `renderExerciseManagement()` | Exercise list with add/delete/enable |

---

## `workout.js` — Workout Flow

### `loadSuggestion()`

Calls `GET /api/suggest`, stores `state.exercises`, `state.fatigue`, `state.weeklyLoad`, then calls `renderSuggestion()` and `renderWorkoutUI()`.

### `saveWorkout()`

1. For each exercise card, reads mode select + calls `collectSets(exerciseId)`
2. If editing (`editingWorkoutId` is set): sends `PUT /api/workout/:id`
3. Otherwise: sends `POST /api/workout`
4. On success: reloads history and re-runs `loadSuggestion()`

### `editWorkout(id)`

1. Fetches history, finds the workout by id
2. Calls `renderWorkoutUI()` with the workout's exercises
3. After a 100ms delay (for DOM to settle), fills each exercise's sets from stored data

### Soreness change

```js
document.addEventListener('change', (e) => {
  state.soreness[muscle] = e.target.checked
  saveSoreness().then(() => loadSuggestion())
})
```

Soreness is saved immediately and a fresh suggestion is fetched, updating the suggestion in real time.

---

## `sets.js` — Set Management

### `addSet(exerciseId)`

Appends a new set row to the exercise's sets container:
- Mode-aware input: reps input OR time input
- Weight input
- Delete button (`data-del-set` attribute for event delegation)

### `collectSets(exerciseId)`

Reads all set rows and returns:
```js
// Reps mode:  { reps: 8, weight: 100.0 }
// Time mode:  { duration_sec: 60, weight: 0 }
```

---

## `progress.js` — Progress Display

After `loadSuggestion()`, calls `GET /api/progress/<exercise>` for each suggested exercise and renders a soft target hint (e.g. "+2.5 kg over last session") below the exercise name. Does not affect which exercises are selected.

---

## `user-manager.js` — Multi-User UI

A self-contained `UserManager` class. Responsibilities:
- On init: check for users; if none, force-show user creation modal
- Render current user badge + switcher dropdown
- Create / switch / delete users via `/api/users` endpoints
- After switching: reload the page so all state re-fetches for the new user

Current username stored in `localStorage` under `workout_current_user`, appended to every API call as `?user=username`.

---

## `analytics.js` / `analytics-ui.js` — Analytics

`analytics.js` processes raw workout history into time-series data per exercise. `analytics-ui.js` renders:
- Timeframe selector (7d / 30d / 90d / all)
- Per-exercise volume charts (canvas)
- Personal records summary

Export triggers a browser download — no server involvement.

---

## `export-import.js` — Data Transfer

**Export:** serializes `state.workouts` to JSON or CSV, downloads via a programmatic `<a>` element.

**Import:** reads a JSON file via `FileReader`, validates shape, calls `POST /api/workout` for each entry that doesn't already exist.

---

## Rendering Pattern

All render functions follow this pattern — no diffing, just replace innerHTML:

```js
export function renderFoo(data) {
  const container = document.getElementById('foo');
  if (!container) return;
  container.innerHTML = buildFooHTML(data);
}
```
