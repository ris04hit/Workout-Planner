# Optional Features

Potential features to add in future versions. Each point is self-contained and independent unless noted.
This file is gitignored — for personal planning only.

---

## Workout Logging Enhancements

- **Supersets** — link two exercises together so they are logged as one paired block (e.g. Bicep Curl + Tricep Pushdown alternating sets)
- **Circuits** — group N exercises into a circuit with a set count for the whole circuit
- **Rest timer** — in-UI countdown timer that auto-starts between sets; configurable default rest duration per exercise
- **RPE / effort rating** — optional RPE (Rate of Perceived Exertion, 1–10) field per set alongside reps and weight; heavier RPE weighting in volume calculations
- **Set type tags** — label sets as Warm-up, Working, Drop, Failure; Warm-up sets excluded from volume/progress calculations
- **Exercise notes per session** — free-text note field on each exercise card, saved with the workout
- **Workout notes** — top-level notes field on the whole workout (e.g. "felt tired, cut short")
- **Bodyweight exercises** — `is_bodyweight` flag per exercise; weight recorded as body weight + additional load; stored body weight used if available
- **Partial reps / assisted flag** — mark a set as partial or assisted; excluded from best-volume calculation but visible in history
- **Unilateral tracking** — separate left/right set data for exercises like single-leg press or dumbbell curl; store as `{ left: [...], right: [...] }`
- **Cardio mode** — third set mode alongside `reps`/`time`: `distance` (km/miles) + `duration`, for runs/rows/bike
- **Quick-log mode** — pre-fill last session's sets for an exercise with a single button so repeat workouts are logged in seconds

---

## Suggestion & Selection Improvements

- **Deload detection** — if total weekly contribution load drops significantly over 2+ weeks, flag a deload week in the UI
- **Overtraining warning** — flag individual muscles whose weekly load consistently exceeds `weekly_targets.<m>.max` for N weeks
- **Muscle balance warning** — alert when CHEST:LATS or QUADS:HAMSTRINGS contribution ratio is out of a configurable healthy range (e.g. 1:1 pull/push)
- **Smart co-occurrence suggestions** — when suggesting exercises, boost exercises that have historically paired well with already-selected exercises (based on co-occurrence in logged workouts)
- **Split builder** — define a named repeating multi-day split (Push/Pull/Legs, Upper/Lower, etc.); suggestion checks which split day is next
- **Program support** — 8–12 week progressive overload programs (e.g. 5/3/1, GZCLP, PHUL) with automatic weight/rep progression targets derived from the user's current best
- **Warm-up suggestion** — before the main exercise list, suggest 2 warm-up sets (e.g. 50% and 75% of last working weight) for the heaviest exercise
- **Cooldown / stretching suggestions** — append stretches relevant to the muscles most loaded in the session; sourced from the exercise list's `ACCESSORY` pattern
- **Avoid injury mode** — flag a **muscle** as injured (not just sore); hard-blocked from any exercise with contribution ≥ threshold for a configurable N days with no override
- **Temporary muscle priority boost** — UI option to temporarily raise a muscle's `muscle_weights` value for 1–4 weeks (stored with an expiry timestamp in config)
- **"Train everything" mode** — ignore weekly targets and select one exercise per pattern to give every movement pattern equal exposure; useful for deload or skill weeks
- **Same-exercise avoidance window** — per-exercise config field specifying minimum days between appearances (separate from the global `recency_history_sessions`)
- **Negative contribution support** — allow a muscle contribution of `< 0` to model antagonist inhibition (e.g. heavy pec work reducing shoulder readiness)

---

## Exercise & Contribution Management

- **Contribution map editor** — visual UI for editing the `muscles` map of an exercise; sliders 0–1 per muscle with a live preview of how the change would affect the exercise's score
- **Pattern / family editor** — expose `pattern` and `family` fields in the Exercise Management UI so the user can reassign an exercise without editing JSON
- **Exercise search & filter** — search exercises by name, filter by `pattern`, `family`, or which muscles they hit; useful when the list grows large
- **Exercise tags** — free-form tags per exercise (e.g. `#barbell`, `#cable`, `#home`) for filtering and template grouping
- **Equipment filter** — tag each exercise with required equipment (Barbell, Dumbbell, Cable, Machine, Bodyweight, Kettlebell); filter picker by what is available today
- **Exercise library / descriptions** — optional `description` and `cues` fields in `exercises.json`; displayed as a tooltip or expandable card in the workout UI
- **Exercise aliases** — `aliases: ["Pull-up", "Chin-up"]` field; progress history from all alias names merged when computing best/last
- **Per-exercise minimum rest days** — `min_rest_days` field in the exercise definition; overrides the global `recency_history_sessions` for that exercise specifically (e.g. Deadlift: 3 days)
- **Exercise import** — paste a list of exercise names + patterns and auto-populate contribution maps using a pre-built lookup table or a user-editable template
- **Reorder exercises** — drag-and-drop reordering of exercises within the exercise list; order affects tiebreaking in the selection loop

---

## Progress & Analytics

- **Per-muscle volume chart** — cumulative weekly contribution load per muscle (sum of `sets × reps × weight × contribution`) charted over time; uses actual muscle names (QUADS, CHEST, etc.)
- **1RM estimator** — compute estimated one-rep max from any set using Epley (`weight × (1 + reps/30)`) or Brzycki; track estimated 1RM trend over time per exercise
- **Personal records dashboard** — dedicated section listing all-time best weight, volume, and reps for every exercise; filterable by pattern or muscle
- **Muscle heatmap** — body-silhouette diagram with colour intensity per muscle showing cumulative contribution load over the selected timeframe (7d / 30d / 90d)
- **Fatigue history chart** — line chart of per-muscle fatigue reconstructed from history; shows how fatigue builds and recovers over weeks
- **Weekly load vs target chart** — bar chart comparing actual weekly contribution load per muscle against `weekly_targets.min` and `weekly_targets.max`
- **Streak tracking** — count consecutive weeks where all `weekly_targets.min` values were met; show current streak and all-time best
- **Session duration tracking** — log `start_time` / `end_time` per workout (ISO timestamps); show average session duration on analytics dashboard
- **Trend analysis** — exponential moving average line on top of per-exercise progress charts to distinguish noise from real progress trend
- **Plateau detection** — alert when a specific exercise has not had a volume increase over a configurable number of sessions (e.g. no improvement in 4 sessions)
- **Weekly summary card** — auto-generated text summary each Sunday: muscles trained, total contribution load, PRs hit, volume vs previous week, sessions completed
- **Monthly volume comparison** — bar chart comparing total contribution load per muscle across the last 4 months
- **Workout frequency calendar** — GitHub-style heatmap showing days with logged workouts; colour intensity = total volume

---

## Scoring & Algorithm Tuning

- **Score inspector** — expandable per-exercise breakdown showing all score components: readiness, weekly boost, priority, recency penalty, soreness penalty; displayed inline in the suggestion UI
- **Config presets** — named configuration presets (e.g. "Strength", "Hypertrophy", "Maintenance", "Deload") that apply a full config set in one click; stored alongside user config
- **Live score preview** — when editing `muscle_weights` or `weekly_targets` in config, show a live preview of how the current exercise list would be re-ranked
- **A/B config compare** — run the suggestion algorithm against two different configs simultaneously and display results side by side
- **Fatigue sensitivity slider** — single UI control that adjusts `fatigue_decay` and `fatigue_block_threshold` together; labelled "Conservative → Aggressive recovery"
- **Contribution scaling visualiser** — show how `scoring.max_total_contribution` and `scoring.scaling_exponent` affect the score gap between compound and isolation exercises given current fatigue

---

## Data & Export

- **Cloud backup** — scheduled export to Google Drive / Dropbox / a user-specified WebDAV endpoint; configurable frequency
- **Bulk import from CSV** — import workouts from a generic CSV template (name, date, sets, reps, weight columns); useful for migrating from other apps
- **Printable workout card** — clean printer-friendly HTML view of the current session's exercises, target sets, and progression hints
- **Shareable workout link** — generate a read-only URL for a single workout or week that can be shared with a coach
- **Automatic local backup** — save a timestamped backup of `workouts.json` every N days to `data/.backups/`; configurable retention count
- **Exercise history export** — export a per-exercise CSV (date, sets, reps, weight, volume) for a single exercise; useful for charting in external tools

---

## Configuration & Customisation

- **Custom muscles** — allow the user to define muscle names beyond the 12 defaults (e.g. `NECK`, `WRISTS`, `HIP_FLEXORS`); new names automatically added to `muscle_weights`, `weekly_targets`, and soreness
- **Per-exercise contribution override** — let the user fine-tune muscle contributions on a per-user basis without editing `exercises.json`; stored separately in `config.json` as an override map
- **Theme / dark mode** — CSS variable–based dark mode toggle saved to `localStorage`; auto-detect from `prefers-color-scheme`
- **Compact mode** — denser layout for smaller screens or users who prefer less whitespace; toggle in settings
- **Unit system** — toggle between kg and lbs; all stored weights remain in kg, display conversion applied everywhere
- **Language / i18n** — externalize all UI strings to a JSON file; add support for at least one additional language

---

## User & Multi-User

- **Password protection per user** — simple PIN or bcrypt-hashed password per user; prevents other users on the same instance from accessing your data
- **User profiles** — optional metadata per user: display name, body weight, height, date of birth; used for bodyweight exercise calculations
- **Body weight log** — track body weight over time (separate from workouts); plotted on analytics dashboard; used as default `body_weight` for bodyweight exercises
- **Read-only guest access** — shareable view-only link for a user's history without exposing the full app

---

## Notifications & Reminders

- **Browser push notifications** — remind the user to log a workout if N days have passed since the last session; requires service worker
- **Rest day indicator** — show a clear "All muscles recovering — consider a rest day" message in the suggestion UI when every muscle has low readiness
- **PWA / installable app** — `manifest.json` + service worker so the app installs to the mobile home screen
- **Offline support** — service worker caches the app shell and last API responses so the UI opens without a network connection

---

## Developer / Infrastructure

- **Docker support** — `Dockerfile` + `docker-compose.yml` for one-command deployment; mounts `data/` as a volume
- **Configurable port** — read `PORT` from an environment variable instead of hardcoding 5000
- **HTTPS / reverse proxy guide** — documentation for running behind nginx with SSL via Let's Encrypt
- **Rate limiting** — `flask-limiter` on write endpoints to prevent accidental or intentional request flooding
- **Structured logging** — replace startup `print()` with Python's `logging` module; log level configurable via `LOG_LEVEL` env var
- **Health check endpoint** — `GET /api/health` returning `{ "status": "ok", "version": "..." }` for uptime monitoring
- **SQLite backend option** — optional SQLite backend using the same `storage` interface, for better concurrency, atomic writes, and query performance
- **File lock / multi-instance safety** — wrap `_write` with `fcntl.flock` / `msvcrt.locking` to prevent data corruption when multiple processes share the same `data/` directory
- **API versioning** — prefix all routes with `/api/v1/` to allow future breaking changes without breaking existing clients
- **OpenAPI / Swagger spec** — auto-generated API spec from Flask routes; serves `GET /api/docs` as a Swagger UI page
