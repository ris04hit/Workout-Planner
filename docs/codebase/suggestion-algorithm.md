# Exercise-Based Suggestion Algorithm

**Source:** `src/core_logic.py`
**Entry point:** `select_workout(fatigue, weekly_load, sore, recency, exercises, config, family_recency)`

The suggestion engine answers: *"Given muscle fatigue, soreness, and weekly load, which exercises should I do today?"*

---

## Muscle Taxonomy

12 individual muscles:

| Group | Muscles |
|---|---|
| Lower body | QUADS, GLUTES, HAMSTRINGS, CALVES |
| Upper push | CHEST, SHOULDERS, TRICEPS |
| Upper pull | LATS, BICEPS, REAR_DELTS, FOREARMS |
| Core | CORE |

---

## Exercise Data Model

Each exercise in `data/default/exercises.json` has:

```json
{
  "name": "Squat",
  "enabled": true,
  "difficulty": 3,
  "priority": 5,
  "pattern": "SQUAT",
  "family": "SQUAT",
  "muscles": { "QUADS": 0.8, "GLUTES": 0.6, "CORE": 0.3 }
}
```

- **pattern** — movement category: `SQUAT`, `HINGE`, `PUSH`, `PULL`, `CORE`, `ACCESSORY`
- **family** — deduplication key (at most one exercise per family per session)
- **muscles** — contribution map: float in `(0, 1]` per muscle

---

## State Computation

Fatigue and weekly load are **not stored as files**. They are recomputed from the full workout history on every `GET /api/suggest` call:

| Function | What it computes |
|---|---|
| `compute_fatigue_from_history(workouts, config, today, exercise_defs)` | Per-muscle fatigue `[0, 1]` by replaying all workouts and applying daily decay between sessions |
| `compute_weekly_load_from_history(workouts, today, exercise_defs)` | Sum of muscle contributions from workouts in the rolling 7-day window |

This means fatigue always reflects the exact workout history — no stale file state.

---

## Algorithm Flow

```
GET /api/suggest
  → compute_fatigue_from_history()     — build fatigue dict from history
  → compute_weekly_load_from_history() — build weekly_load dict from history
  → get_soreness()                     — load user's sore muscle flags
  → build recency maps                 — exercise and family days since last performed
  → select_workout(fatigue, weekly_load, sore, recency, exercises, config, family_recency)
       → is_exercise_valid()           — hard filter per exercise
       → compute_exercise_score()      — numeric score per exercise
       → greedy selection loop         — pattern limits, family dedup, muscle saturation
```

---

## Readiness

```
readiness(muscle) = weight[muscle] × (1 − fatigue[muscle])²
```

A fully fatigued muscle contributes zero readiness. Weight is configurable via `muscle_weights` in config.

---

## Hard Constraints (`is_exercise_valid`)

An exercise is blocked if **any** of:

1. `enabled == false`
2. `difficulty > max_difficulty_allowed`
3. Any muscle with `contribution >= sore_block_threshold` is sore
4. Any muscle with `contribution >= fatigue_block_contribution` has `fatigue > fatigue_block_threshold`

---

## Scoring (`compute_exercise_score`)

```
score = sum(c * readiness(m))                                      # readiness-weighted contribution
      + sum(c * weekly_bonus(m))                                   # frequency boost
      + priority * priority_coeff                                  # priority factor
      - recency_penalty * recency_decay^days_since_exercise        # exact exercise repeat penalty
      - family_recency_penalty * recency_decay^days_since_family   # same-family repeat penalty
      - sum(c * sore_penalty_factor for sore muscles)              # soft soreness penalty
```

The recency penalties are **continuous** and cover the **full workout history**. The exact-exercise penalty is largest when the same exercise was done today (`days = 0`, full `recency_penalty`) and decays exponentially toward zero. The family penalty applies the same decay to the most recent exercise in the same `family`. Exercises and families never done receive zero penalty. `recency_decay` (default `0.65`) controls how fast both penalties fade per day.

**Weekly bonus** (per muscle):

| Condition | Bonus |
|---|---|
| Never trained this week (`load == 0`) | `weekly_boost_untrained` (default +2.0) |
| Below `weekly_targets[m].min` | `weekly_boost_below_min` (default +1.25) |
| Between `min` and `mid` | `weekly_boost_below_mid` (default +0.5) |
| At/above `mid` | 0.0 |

---

## Selection Loop (`select_workout`)

Greedy loop over exercises sorted by score (descending):

1. Check **hard filter** (`is_exercise_valid`) — skip if blocked
2. Check **pattern limit** — skip if `pattern_count[pattern] >= pattern_limits[pattern]`
3. Check **family deduplication** — skip if `family` already selected
4. Check **muscle saturation** — skip if primary muscle's `muscle_usage >= muscle_usage_limit`
5. Check **minimum score threshold** — skip if score is below `scoring.min_score_threshold`
6. Accept — update `pattern_count`, `families_used`, `muscle_usage`
7. Repeat until `target_exercise_count` reached

**Fallback:** if no exercises pass all filters, relax structural constraints and ignore `min_score_threshold`. Last resort: return the first enabled exercise.

---

## Fatigue Decay (inside `compute_fatigue_from_history`)

When replaying workout history, fatigue decays between workout days:

```
fatigue[m] *= fatigue_decay ^ days_between    (default decay 0.8/day)
```

After accumulating contributions from a workout:

```
fatigue[m] = min(1.0, fatigue[m] + contribution[m])
```

---

## Configuration Merging

`get_effective_config(stored_config)` deep-merges the stored user overrides over the defaults loaded from `data/default/config.json`. `data/default/config.json` is the single source of truth — there is no `DEFAULT_CONFIG` dict in code.

---

## Worked Example

Starting state: no history, no soreness.

| Exercise | Pattern | Readiness | Weekly boost | Priority | Total |
|---|---|---|---|---|---|
| Deadlift | HINGE | ~4.6 | +2.0 | +1.0 | **~7.6** |
| Squat | SQUAT | ~4.1 | +2.0 | +1.0 | **~7.1** |
| Bench Press | PUSH | ~3.9 | +2.0 | +1.0 | **~6.9** |
| … | … | … | … | … | … |

Output is grouped by pattern: HINGE, SQUAT, PUSH, PULL, CORE, ACCESSORY.
