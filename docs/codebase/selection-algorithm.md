# Exercise Selection Algorithm & Configuration Reference

> Source of truth: `src/core_logic.py` · Config defaults: `data/default/config.json`

---

## Overview

The suggestion engine follows a four-stage pipeline every time "Generate Workout" is pressed:

```
STATE → SCORE → SELECT → UPDATE
```

| Stage | What happens |
|---|---|
| **STATE** | Load today's fatigue, weekly load, soreness, and exercise/family recency from workout history |
| **SCORE** | Compute a numeric score for every enabled exercise |
| **SELECT** | Greedily pick exercises that maximise total score while respecting hard limits |
| **UPDATE** | After saving a workout, persist the workout; fatigue and weekly load are recomputed from history |

---

## Stage 1 — State

### Fatigue (`fatigue`)
A `dict[muscle → float ∈ [0, 1]]`. `1.0` = fully fatigued, `0.0` = fully fresh.

- **Accumulation:** each muscle's fatigue increases by its contribution weight when a workout is saved.
  ```
  fatigue[m] = min(1.0, fatigue[m] + contribution)
  ```
- **Decay:** applied once per day (on page load):
  ```
  fatigue[m] *= fatigue_decay          # default 0.8
  ```
  After ~5 days without training a muscle, fatigue drops below 0.33.

### Weekly Load (`weekly_load`)
A `dict[muscle → float]` — cumulative muscle contributions logged **this week**. Resets every Monday. Used by the weekly boost component of the score.

### Soreness (`sore`)
A `dict[muscle → bool]` — set manually by the user via the soreness panel. A `True` entry both hard-blocks and soft-penalises exercises heavily using that muscle.

### Recency
Two maps derived from the full workout history:
- `recency`: `{ exercise_name: days_since_last_performed }`
- `family_recency`: `{ family: days_since_any_family_member_last_performed }`

They drive exact-exercise and same-family repeat penalties.

---

## Stage 2 — Scoring

Each exercise receives a scalar score. Higher = better.

### Score Formula

```
score = sublinear(readiness_sum)
      + weekly_boost
      + priority_bonus
      - exercise_recency_penalty
      - family_recency_penalty
      - soreness_penalty
```

### 2a — Contribution Capping

Before any scoring, each exercise's muscle contributions are normalised if their sum exceeds `scoring.max_total_contribution`:

```python
total = Σ contributions
if total > max_total:
    contributions[m] *= (max_total / total)   # preserves ratios
```

**Why?** Compound exercises (Squat: quads 0.8, glutes 0.6, hamstrings 0.4 → total 1.8) would otherwise dwarf isolation movements. Capping at 1.3 keeps them competitive without eliminating their natural advantage.

The UI badge shows "⚡ Contributions capped" when this fires.

### 2b — Muscle Readiness

```
readiness(m) = muscle_weight[m] × (1 − fatigue[m])²

raw_readiness = Σ  contribution[m] × readiness(m)
```

The `(1 − f)²` curve makes readiness drop sharply as fatigue approaches 1 (quadratic decay, not linear).

### 2c — Sublinear Scaling

```
scaled_readiness = raw_readiness ^ scaling_exponent    # default alpha = 0.8
```

Applying `x^0.8` (sublinear) compresses the gap between compound and isolation exercises:

| raw_readiness | alpha=1.0 (linear) | alpha=0.8 |
|---|---|---|
| 0.8 (isolation) | 0.80 | 0.84 |
| 1.5 (compound) | 1.50 | 1.38 |
| ratio | 1.88x | 1.64x |

Setting `scaling_exponent` closer to `0.5` further equalises them; `1.0` disables compression.

### 2d — Weekly Boost

```
boost = Σ contribution[m] × weekly_bonus(m)
```

| Muscle's weekly load vs target | Bonus |
|---|---|
| Never trained this week (`load == 0`) | **+2.0** |
| Below `weekly_targets[m].min` | **+1.25** |
| Between `min` and `mid` | **+0.5** |
| Above `mid` | **0.0** |

Muscles that haven't been touched all week get a strong nudge toward inclusion.

### 2e — Priority Bonus

```
priority_bonus = priority * 0.2     # priority in {1, 2, 3, 4, 5}
```

Priority 5 gives +1.0, Priority 1 gives +0.2. Used to prefer important exercises without overwhelming readiness and recency.

### 2f — Recency Penalties

```
exercise_recency_penalty = -recency_penalty * recency_decay^days_since_exercise
family_recency_penalty   = -family_recency_penalty * recency_decay^days_since_family
```

The exact-exercise penalty discourages repeating the same movement too soon. The family penalty is smaller and discourages related substitutions, such as another press after a recent press. Exercises and families never seen in history receive no recency penalty.

### 2g — Soreness Penalty

```
soreness_penalty = -Σ contribution[m] × sore_penalty_factor   for sore muscles
```

Default `sore_penalty_factor = 3.0`. A sore quad with contribution 0.8 subtracts −2.4 from the score. Combined with the hard-block (below), soreness **dominates** the score.

### Score Priority Hierarchy (by default weights)

1. **Soreness penalty** (−2.4 for 0.8 contribution at factor 3.0) — largest single-component magnitude
2. **Muscle readiness / freshness** (sublinear compound of all muscles)
3. **Recency penalties** (largest for same-day repeats, then decay daily)
4. **Weekly boost** (up to +2.0 before contribution weighting for never-trained muscles)
5. **Priority bonus** (up to +1.0 at priority 5)

---

## Stage 3 — Selection (Greedy)

After scoring, exercises are sorted descending by score. Ties broken by position in `exercises.json` (earlier = preferred).

The selector iterates through the sorted list and applies four **soft filters** (relaxed on fallback):

### 3a — Hard Filter (always applied)

`is_exercise_valid` blocks an exercise if **any** of:

| Condition | Config key |
|---|---|
| `enabled == false` | — |
| `difficulty > max_difficulty_allowed` | `max_difficulty_allowed` |
| A sore muscle has `contribution ≥ sore_block_threshold` | `sore_block_threshold` (default 0.6) |
| An over-fatigued muscle (`fatigue > fatigue_block_threshold`) has `contribution ≥ fatigue_block_contribution` | `fatigue_block_threshold` / `fatigue_block_contribution` |

Hard-blocked exercises appear in the "All exercises" score table with a red 🚫 badge.

### 3b — Pattern Limit

At most `pattern_limits[pattern]` exercises per movement pattern per session.

```json
"pattern_limits": { "SQUAT": 2, "HINGE": 2, "PUSH": 3, "PULL": 3, "CORE": 2, "ACCESSORY": 3 }
```

### 3c — Family Deduplication

At most **one exercise per family** (e.g. only one `"PRESS"` family member: Bench Press or Overhead Press, not both). Prevents redundant stimulus.

### 3d — Muscle Usage Limit

```
primary_muscle = muscle with highest contribution in exercise
if muscle_usage[primary_muscle] >= muscle_usage_limit -> skip   # default 1.2
```

Prevents hammering the same muscle group repeatedly in a session.

### 3e — Minimum Score Threshold

During the normal pass, exercises below `scoring.min_score_threshold` are skipped. This allows the app to return fewer than `target_exercise_count` exercises instead of filling the plan with poor matches.

### 3f — Fallback

If no exercises pass all filters, the algorithm relaxes soft constraints and ignores the score threshold. Last resort: return the first enabled exercise.

---

## Stage 4 — Post-Workout Update

After a workout is saved:

```
workouts.json += { date, id, exercises: [{ name, mode, sets }] }
```

Fatigue and weekly load are not stored. The next suggestion recomputes them from `workouts.json`.

---

## Configuration Reference

All values live in `data/default/config.json`. Users can override any key via the Settings panel; overrides are merged on top of defaults at runtime.

### Scalar keys

| Key | Default | Description |
|---|---|---|
| `fatigue_decay` | `0.8` | Daily fatigue multiplier. `0.8` means 20% of fatigue clears per rest day. |
| `max_difficulty_allowed` | `2` | Hard ceiling on exercise difficulty (1–5). |
| `target_exercise_count` | `4` | Target number of exercises to select per session. |
| `muscle_usage_limit` | `1.2` | Max accumulated contribution for a muscle's primary role in one session. |
| `sore_block_threshold` | `0.6` | Contribution threshold above which a sore muscle hard-blocks an exercise. |
| `fatigue_block_threshold` | `0.9` | Fatigue level above which the fatigue block activates. |
| `fatigue_block_contribution` | `0.5` | Contribution threshold for the fatigue block. |
| `sore_penalty_factor` | `3.0` | Score multiplier for soreness penalty component. |

### `muscle_weights`

How important each muscle's freshness is relative to others when computing readiness. Higher weight = that muscle drives scores more strongly.

```json
"muscle_weights": { "QUADS": 2.5, "GLUTES": 2.5, "LATS": 2.5, ... }
```

### `pattern_limits`

Maximum exercises per movement pattern per session.

```json
"pattern_limits": { "SQUAT": 2, "HINGE": 2, "PUSH": 3, "PULL": 3, "CORE": 2, "ACCESSORY": 3 }
```

### `weekly_targets`

Per-muscle training frequency targets (in sets/contributions per week).

```json
"QUADS": { "min": 2, "mid": 3, "max": 4 }
```

- `min` - below this uses `weekly_boost_below_min`
- `mid` - below this uses `weekly_boost_below_mid`
- At/above `mid` uses +0.0 boost (sufficiently trained)

### `scoring`

Controls compound vs. isolation balance.

| Key | Default | Description |
|---|---|---|
| `max_total_contribution` | `1.3` | Cap applied to total muscle contributions before scoring. |
| `scaling_exponent` | `0.8` | Exponent for sublinear readiness scaling (`< 1` compresses compound advantage). |
| `weekly_boost_untrained` | `2.0` | Bonus multiplier for muscles not trained in the rolling weekly window. |
| `weekly_boost_below_min` | `1.25` | Bonus multiplier for muscles below the weekly minimum target. |
| `weekly_boost_below_mid` | `0.5` | Bonus multiplier for muscles below the weekly mid target. |
| `priority_coeff` | `0.2` | Points added per exercise priority level. |
| `recency_penalty` | `2.5` | Exact-exercise repeat penalty before decay. |
| `family_recency_penalty` | `1.0` | Same-family repeat penalty before decay. |
| `recency_decay` | `0.65` | Per-day multiplier for exercise and family repeat penalties. |
| `min_score_threshold` | `1.0` | Normal-pass score floor. |

---

## Worked Example

**Setup:** Quads moderately fatigued (0.4), not sore. Squat was last done yesterday.

```
Squat muscles: { QUADS: 0.8, GLUTES: 0.6 }  → total 1.4, capped to 1.3
effective contributions ≈ { QUADS: 0.74, GLUTES: 0.56 }

readiness(QUADS) = 2.5 × (1 − 0.4)² = 2.5 × 0.36 = 0.90
readiness(GLUTES)= 2.5 × (1 − 0.0)² = 2.5 × 1.00 = 2.50

raw_readiness = 0.74×0.90 + 0.56×2.50 ≈ 2.06
scaled        = 2.06 ^ 0.8 ≈ 1.78

weekly_boost  = 0.74×2.0 + 0.56×2.0 ≈ 2.60   # both untrained this week
priority      = 5 × 0.2 = 1.00
recency       = -2.5 × 0.65^1 = -1.63
family        = -1.0 × 0.65^1 = -0.65
soreness      = 0.00

total ≈ 1.78 + 2.60 + 1.00 - 1.63 - 0.65 = 3.10
```
