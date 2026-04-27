# Contributing & Code Rules

Rules, conventions, and patterns for adding new code to this project.
Every person (or AI) making changes must follow these rules to keep the codebase consistent.

---

## Table of Contents

1. [Mandatory Checklist — What to Update](#mandatory-checklist)
2. [Project Structure Rules](#project-structure-rules)
3. [Python Rules](#python-rules)
4. [JavaScript Rules](#javascript-rules)
5. [Testing Rules](#testing-rules)
6. [Documentation Rules](#documentation-rules)
7. [Git Rules](#git-rules)
8. [Naming Conventions](#naming-conventions)

---

## Mandatory Checklist

Every time you add a feature, fix a bug, or refactor code, work through this list:

### Adding a new storage key (new JSON file)

- [ ] Add `get_<key>()` and `save_<key>()` functions in a `src/storage/<domain>.py` file
- [ ] Export the new functions from `src/storage/__init__.py` and add them to `__all__`
- [ ] If it is a gitignored runtime file, add it to `scripts/init_default_data.py`
- [ ] If it is a tracked default file, add it to `data/default/` and commit it
- [ ] Document the data shape in `docs/codebase/storage.md`

### Adding a new API endpoint

- [ ] Add the route handler in the appropriate `src/api/<domain>.py` file inside `register_*_routes(app)`
- [ ] Register new domains in `src/app.py` if a new `api/` file was created
- [ ] Document the endpoint (method, path, request body, response, errors) in `docs/api-endpoints.md`
- [ ] Add the endpoint to the quick-reference table in `INDEX.md`
- [ ] Add Python tests in `tests/src/api/test_<domain>.py`

### Adding a new JavaScript module

- [ ] Create `static/js/<module>.js` as an ES module (`export function ...`)
- [ ] Import it in `main.js` if it needs to run at startup or participate in event delegation
- [ ] If it adds state, add the field to `state.js` and document it with a comment
- [ ] If it renders DOM, all rendering must go through `ui.js` or a dedicated `*-ui.js` file
- [ ] Add Jest tests in `tests/static/js/<module>.test.js`

### Adding a new config field

- [ ] Add the field and its default value directly to `data/default/config.json`
- [ ] Update `get_effective_config()` in `src/core_logic.py` to merge the new field into the `merged` dict
- [ ] Document the field in `docs/api-endpoints.md` under `GET /api/config`
- [ ] Update `docs/codebase/suggestion-algorithm.md` if the field affects scoring

### Adding a new muscle

- [ ] Add the muscle name to `data/default/config.json` under `muscle_weights` and `weekly_targets`
- [ ] Add at least one exercise referencing the new muscle to `data/default/exercises.json`
- [ ] Add the muscle to `MUSCLE_ORDER` in `static/js/state.js`
- [ ] Update `docs/api-endpoints.md` "Valid Muscles" section

### Any change (always)

- [ ] Add an entry to the current version file in `docs/versions/vX.Y.Z.md`
- [ ] If the version file doesn't exist yet, create it from the template and add a row to `docs/changelog.md`

---

## Project Structure Rules

1. **One concern per file.** Each `src/api/` file handles one domain; each `src/storage/` file handles one data type.

2. **Storage is the only layer that touches files.** No `open()`, `json.load()`, or `json.dump()` outside `src/storage/`. API handlers call storage functions only.

3. **API handlers do not contain business logic.** Scoring, pairing, and data transformations belong in `src/core_logic.py` or a dedicated logic module. API files handle HTTP plumbing only: parse request → call logic/storage → return JSON.

4. **`ui.js` is the only file that writes to the DOM** (outside of self-contained modules like `user-manager.js`, `mobile.js`, `accessibility.js`). Other modules call render functions from `ui.js`; they never call `document.getElementById(...).innerHTML = ...` directly.

5. **State mutations always go through `state.js`.** No module should store its own local copy of data that belongs in the shared state. Import `state` and mutate it directly.

6. **Test files mirror source paths.** A function in `src/storage/workouts.py` → test in `tests/src/storage/test_workouts.py`. A JS module `static/js/analytics.js` → test in `tests/static/js/analytics.test.js`.

---

## Python Rules

### File headers

Every Python file must begin with a module docstring:
```python
"""
Short description of what this module does.
"""
```

### API route registration pattern

All routes live inside a `register_<domain>_routes(app)` function — never at module level:

```python
def register_workout_routes(app):
    @app.route("/api/workout", methods=["GET", "POST"])
    def workout():
        ...
```

This ensures the app only registers routes when explicitly told to, making testing easier.

### User context — set it first

Every API route handler that accesses storage must set the user context before any storage call:

```python
username = request.args.get('user') or get_current_user()
if username:
    set_current_user(username)
```

Never call a storage function before this block.

### Error handling

- Raise `ValueError` for domain errors (not found, duplicate, invalid input)
- API handlers catch `ValueError` → HTTP 400 or 409
- API handlers catch bare `Exception` → HTTP 500
- Never swallow exceptions silently in storage functions
- Never use `print()` or `traceback.print_exc()` for debugging — use proper error returns

```python
try:
    result = do_thing()
    return jsonify(result)
except ValueError as e:
    return jsonify({"error": str(e)}), 400
except Exception as e:
    return jsonify({"error": "Operation failed"}), 500
```

### Imports

- Standard library → third-party → local imports, in that order, separated by blank lines
- Always import from the `storage` package: `from storage import get_workouts`
- Never import `_read` or `_write` outside of `src/storage/` files

### No debug output

No `print()` statements anywhere in `src/`. The startup messages in `src/__main__.py` are the only exception.

---

## JavaScript Rules

### Module structure

Every JS file must begin with a section header comment:
```js
// =========================
// MODULE NAME
// =========================
```

### ES module pattern

All functions that are used by other modules must be exported:
```js
export function myFunction() { ... }
```

No global variables. No `window.myVar = ...` except for the explicit `window.*` assignments in `main.js` (required for HTML `onclick=` handlers).

### API calls

Always use `apiGet` and `apiPost` from `api.js`. Never use `fetch` directly:

```js
import { apiGet, apiPost } from './api.js';

const data = await apiGet('/api/config');
await apiPost('/api/config', payload);
```

`apiGet`/`apiPost` automatically append `?user=<username>` to every request.

### State access

Read and write `state` directly — do not copy it into local variables that persist across calls:

```js
// Correct
import { state } from './state.js';
state.config = await apiGet('/api/config');

// Wrong — stale reference
const config = state.config;  // don't store this across async calls
```

### Rendering

- Render functions live in `ui.js` (or a dedicated `*-ui.js` for complex sections)
- Render functions always guard against missing containers: `if (!container) return;`
- Render functions use `innerHTML` replacement — no incremental DOM diffing
- Render functions are synchronous — they read from `state`, not from the network

```js
export function renderFoo() {
  const container = document.getElementById('foo');
  if (!container) return;
  container.innerHTML = buildFooHTML(state.fooData);
}
```

### Event handling

- Attach persistent listeners in `main.js` via event delegation on `document`
- Use `data-*` attributes on elements to carry identifiers, not inline `onclick=`
- One-time init listeners (e.g. button clicks) are attached in the `DOMContentLoaded` block in `main.js`

### No console output

No `console.log`, `console.warn`, or `console.error` in `static/js/`. The browser console must be silent during normal operation.

### Async/await

Always use `async/await` — never raw `.then()` chains in new code. Handle errors with `try/catch`.

---

## Testing Rules

### Python — pytest

- One test file per source file, mirroring the source path
- Each test function name describes exactly what it tests: `test_add_workout_rejects_duplicate`
- Use `pytest.fixture` for shared setup (Flask test client, temp data directory)
- Every new storage function needs at least: a happy-path test and an error/edge-case test
- Every new API endpoint needs at least: success case, validation error case, not-found case

### JavaScript — Jest

- One test file per source file in `tests/static/js/`
- Mock `state` and `api.js` — tests must not make real HTTP calls
- Test pure functions (scoring, filtering, set collection) exhaustively
- For UI-touching code, use `jsdom` (configured in `package.json`)

### What must never be deleted or weakened

- Never delete a test to make a test suite pass
- Never change a test assertion to match wrong behaviour — fix the code instead
- Never use `pytest.mark.skip` or `test.skip` without a comment explaining why

### Running tests

```bash
# Python
python -m pytest tests/ -q

# JavaScript
npm test

# Single file
python -m pytest tests/src/api/test_workouts.py -v
```

---

## Documentation Rules

| When you... | Update these docs |
|---|---|
| Add an API endpoint | `docs/api-endpoints.md`, `INDEX.md` (API table) |
| Add a storage key / file | `docs/codebase/storage.md` |
| Change the suggestion algorithm | `docs/codebase/suggestion-algorithm.md` |
| Change the exercise picker | `docs/codebase/exercise-picker.md` |
| Add a JS module | `docs/codebase/frontend.md` (module map), `INDEX.md` (source map) |
| Add a config field | `docs/api-endpoints.md` (config reference table) |
| Add a muscle group | `docs/api-endpoints.md` (valid groups table), suggestion/picker docs |
| Add a new source file | `docs/codebase/overview.md` (directory tree), `INDEX.md` (source map) |
| Release any version | `docs/versions/vX.Y.Z.md` (create), `docs/changelog.md` (add row) |
| Change setup steps | `README.md`, `scripts/setup.sh` |

**Rule:** Never leave a doc pointing to a function, file, or endpoint that no longer exists. Fix the doc in the same commit.

Note: `docs/optional-features.md`, `docs/bugs.md`, and `docs/testing-user.md` are private notes excluded from git.

---

## Git Rules

### Commit message format

```
<type>: <short description>

Types: feat, fix, refactor, test, docs, chore
```

Examples:
```
feat: add weekly target boost to suggestion scoring
fix: prevent duplicate workout on rapid double-save
refactor: extract set collection into sets.js
docs: add exercise picker algorithm deep-dive
test: add missing edge cases for config revert
chore: update setup.sh with new data/default files
```

### Branch / release flow

1. Work on features in commits on `main` (small project — no feature branches required)
2. When a release is ready: create `docs/versions/vX.Y.Z.md`, add row to `docs/changelog.md`, tag the commit `vX.Y.Z`

### What never goes in git

See `.gitignore`. Key items:
- `data/users/` — real user workout data
- `data/users.json` — user list
- `venv/` — virtual environment
- `node_modules/`
- `docs/optional-features.md`, `docs/bugs.md`, `docs/testing-user.md` — private notes

---

## Naming Conventions

### Python

| Thing | Convention | Example |
|---|---|---|
| Files | `snake_case.py` | `core_logic.py` |
| Functions | `snake_case` | `get_exercise_progress` |
| Constants | `UPPER_SNAKE_CASE` | `MUSCLE_ORDER`, `PATTERN_ORDER` |
| Classes | `PascalCase` | (none currently) |
| Private helpers | leading underscore | `_read`, `_write`, `_load_default_exercises` |
| Route handlers | descriptive verb noun | `suggest`, `update_workout_endpoint` |

### JavaScript

| Thing | Convention | Example |
|---|---|---|
| Files | `kebab-case.js` | `analytics-ui.js` |
| Functions | `camelCase` | `loadSuggestion`, `renderConfigPanel` |
| Constants | `UPPER_SNAKE_CASE` | `SCORING_WEIGHTS`, `GROUP_ORDER` |
| Classes | `PascalCase` | `UserManager` |
| `data-*` attributes | `kebab-case` | `data-add-set`, `data-edit` |
| State fields | `camelCase` | `state.primaryCount`, `state.pickerState` |

### Muscles and patterns

Always `UPPER_SNAKE_CASE` strings: `QUADS`, `GLUTES`, `REAR_DELTS`, `HAMSTRINGS`, etc.
These are identifiers that appear in both Python and JavaScript — keep them identical in both.

### API endpoints

- Lowercase, hyphenated paths: `/api/current-user`, `/api/fatigue`
- Resource collections: `/api/users`, `/api/exercises`
- Specific resources: `/api/workout/<id>`, `/api/users/<username>`, `/api/exercises/<name>`
- Actions on resources: `/api/config/reset`, `/api/config/revert`
