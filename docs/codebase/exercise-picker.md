# Exercise Selection — Greedy Loop

**Source:** `src/core_logic.py` → `select_workout()`

Exercise selection is entirely **server-side**. After scoring every enabled exercise, `select_workout()` runs a greedy loop that respects four structural constraints to produce a balanced session.

---

## Where It Fits

```
GET /api/suggest
  → compute_fatigue_from_history()
  → compute_weekly_load_from_history()
  → compute_exercise_score() per exercise   ← see suggestion-algorithm.md
  → select_workout() greedy loop            ← this document
  → return selected exercises + fatigue + weekly_load
```

---

## Input

`select_workout(fatigue, weekly_load, sore, history, exercises, config)` receives:

| Param | Type | Description |
|---|---|---|
| `fatigue` | `dict[str, float]` | Per-muscle fatigue `[0, 1]` |
| `weekly_load` | `dict[str, float]` | Per-muscle cumulative load this week |
| `sore` | `dict[str, bool]` | User-toggled soreness per muscle |
| `history` | `list[dict]` | Recent workout history (for recency penalty) |
| `exercises` | `list[dict]` | Full exercise list from `exercises.json` |
| `config` | `dict` | Effective merged config |

---

## Step 1 — Score All Exercises

Every exercise in the list is passed through `compute_exercise_score()` → `readiness + weekly_boost + priority - recency - soreness_penalty`.

Exercises that fail `is_exercise_valid()` (hard-blocked) are scored as `-inf` so they sort to the bottom and are skipped first.

---

## Step 2 — Sort Descending

Exercises sorted by score, descending. Ties broken by position in `exercises.json` (earlier = preferred).

---

## Step 3 — Greedy Selection

Iterate through the sorted list. For each exercise, apply four filters in order:

### Filter A — Hard block (`is_exercise_valid`)

Skip if **any** of:
- `enabled == false`
- `difficulty > max_difficulty_allowed`
- Sore muscle with `contribution >= sore_block_threshold` (default 0.6)
- Over-fatigued muscle: `fatigue > fatigue_block_threshold` (default 0.9) AND `contribution >= fatigue_block_contribution` (default 0.5)

### Filter B — Pattern limit

```
if pattern_count[exercise.pattern] >= pattern_limits[exercise.pattern]:
    skip
```

Default limits: `SQUAT: 2, HINGE: 2, PUSH: 3, PULL: 3, CORE: 2, ACCESSORY: 3`

### Filter C — Family deduplication

```
if exercise.family in families_used:
    skip
```

Prevents two exercises from the same family (e.g. Bench Press + Incline Press, both `"PRESS"`) appearing in the same session.

### Filter D — Muscle saturation

```
primary_muscle = muscle with highest contribution in exercise
if muscle_usage[primary_muscle] >= muscle_usage_limit:
    skip
```

Default `muscle_usage_limit = 1.4`. Prevents hammering the same muscle multiple times in one session.

### Accept

If all four filters pass: add to selection, update `pattern_count`, `families_used`, `muscle_usage`.

Repeat until `target_exercise_count` exercises selected (default 4–6 depending on config).

---

## Step 4 — Fallback

If the greedy loop exhausts the exercise list without filling the target count:

1. **Relax structural constraints** (B, C, D) — rerun with only the hard block (A) active
2. If still empty: **relax the soreness hard-block** — allow sore-muscle exercises (still score-penalised)
3. Last resort: return the first enabled exercise

---

## Output

```python
[
  {
    "name": "Deadlift",
    "pattern": "HINGE",
    "family": "DEADLIFT",
    "muscles": { "HAMSTRINGS": 0.8, "GLUTES": 0.7, ... },
    "difficulty": 3,
    "priority": 5,
    "enabled": true
  },
  ...
]
```

Also returned alongside: `fatigue` dict, `weekly_load` dict, and `grouped_by_pattern` for the UI.

---

## Config Keys That Control Selection

| Key | Default | Effect |
|---|---|---|
| `target_exercise_count` | `6` | Target number of exercises to select |
| `pattern_limits` | see above | Max per movement pattern |
| `muscle_usage_limit` | `1.4` | Max accumulated contribution per muscle |
| `sore_block_threshold` | `0.6` | Contribution above which a sore muscle hard-blocks |
| `fatigue_block_threshold` | `0.9` | Fatigue level that triggers the fatigue block |
| `fatigue_block_contribution` | `0.5` | Contribution threshold for fatigue block |
| `max_difficulty_allowed` | `5` | Hard ceiling on exercise difficulty |

All values live in `data/default/config.json` and can be overridden per user.
