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
| **STATE** | Load today's fatigue, weekly load, soreness, and recent workout history |
| **SCORE** | Compute a numeric score for every enabled exercise |
| **SELECT** | Greedily pick exercises that maximise total score while respecting hard limits |
| **UPDATE** | After saving a workout, write back new fatigue and weekly-load values |

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
  fatigue[m] *= fatigue_decay          # default 0.85
  ```
  After ~5 days without training a muscle, fatigue drops below 0.44.

### Weekly Load (`weekly_load`)
A `dict[muscle → float]` — cumulative muscle contributions logged **this week**. Resets every Monday. Used by the weekly boost component of the score.

### Soreness (`sore`)
A `dict[muscle → bool]` — set manually by the user via the soreness panel. A `True` entry both hard-blocks and soft-penalises exercises heavily using that muscle.

### History
A list of exercise names logged **in the last session**. Used for the recency penalty.

---

## Stage 2 — Scoring

Each exercise receives a scalar score. Higher = better.

### Score Formula

```
score = sublinear(readiness_sum)
      + weekly_boost
      + priority_bonus
      - recency_penalty
      - soreness_penalty
```

### 2a — Contribution Capping

Before any scoring, each exercise's muscle contributions are normalised if their sum exceeds `scoring.max_total_contribution`:

```python
total = Σ contributions
if total > max_total:
    contributions[m] *= (max_total / total)   # preserves ratios
```

**Why?** Compound exercises (Squat: quads 0.8, glutes 0.6, hamstrings 0.4 → total 1.8) would otherwise dwarf isolation movements. Capping at 1.5 keeps them competitive without eliminating their natural advantage.

The UI badge shows "⚡ Contributions capped" when this fires.

### 2b — Muscle Readiness

```
readiness(m) = muscle_weight[m] × (1 − fatigue[m])²

raw_readiness = Σ  contribution[m] × readiness(m)
```

The `(1 − f)²` curve makes readiness drop sharply as fatigue approaches 1 (quadratic decay, not linear).

### 2c — Sublinear Scaling

```
scaled_readiness = raw_readiness ^ scaling_exponent    # default α = 0.85
```

Applying `x^0.85` (sublinear) compresses the gap between compound and isolation exercises:

| raw_readiness | α=1.0 (linear) | α=0.85 |
|---|---|---|
| 0.8 (isolation) | 0.80 | 0.83 |
| 1.5 (compound) | 1.50 | 1.43 |
| ratio | 1.88× | 1.72× |

Setting `scaling_exponent` closer to `0.5` further equalises them; `1.0` disables compression.

### 2d — Weekly Boost

```
boost = Σ contribution[m] × weekly_bonus(m)
```

| Muscle's weekly load vs target | Bonus |
|---|---|
| Never trained this week (`load == 0`) | **+3.0** |
| Below `weekly_targets[m].min` | **+2.0** |
| Between `min` and `mid` | **+1.0** |
| Above `mid` | **0.0** |

Muscles that haven't been touched all week get a strong nudge toward inclusion.

### 2e — Priority Bonus

```
priority_bonus = priority × 0.5     # priority ∈ {1, 2, 3, 4, 5}
```

Priority 5 → +2.5, Priority 1 → +0.5. Used to always-prefer certain exercises.

### 2f — Recency Penalty

```
recency_penalty = -2.0   if exercise was in the last session
                = 0.0    otherwise
```

Discourages logging the exact same exercise back-to-back across consecutive days.

### 2g — Soreness Penalty

```
soreness_penalty = -Σ contribution[m] × sore_penalty_factor   for sore muscles
```

Default `sore_penalty_factor = 3.0`. A sore quad with contribution 0.8 subtracts −2.4 from the score. Combined with the hard-block (below), soreness **dominates** the score.

### Score Priority Hierarchy (by default weights)

1. **Soreness penalty** (−2.4 for 0.8 contribution at factor 3.0) — largest single-component magnitude
2. **Muscle readiness / freshness** (sublinear compound of all muscles)
3. **Recency penalty** (−2.0 flat for same-day repeat)
4. **Weekly boost** (up to +3.0 for never-trained muscle)
5. **Priority bonus** (up to +2.5 at priority 5)

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
if muscle_usage[primary_muscle] >= muscle_usage_limit → skip   # default 1.4
```

Prevents hammering the same muscle group repeatedly in a session.

### 3e — Fallback

If no exercises pass all filters (e.g. everything is sore), the algorithm relaxes all soft constraints and ignores soreness hard-blocks, using score penalties to deprioritise poor choices. Last resort: return the first enabled exercise.

---

## Stage 4 — Post-Workout Update

After a workout is saved:

```
fatigue[m]     = min(1.0,  fatigue[m]     + contribution[m])
weekly_load[m] =           weekly_load[m] + contribution[m]
```

Fatigue persists across sessions; weekly_load resets each Monday.

---

## Configuration Reference

All values live in `data/default/config.json`. Users can override any key via the Settings panel; overrides are merged on top of defaults at runtime.

### Scalar keys

| Key | Default | Description |
|---|---|---|
| `fatigue_decay` | `0.85` | Daily fatigue multiplier. `0.85` means 15% of fatigue clears per rest day. |
| `max_difficulty_allowed` | `5` | Hard ceiling on exercise difficulty (1–5). |
| `target_exercise_count` | `4` | Target number of exercises to select per session. |
| `muscle_usage_limit` | `1.4` | Max accumulated contribution for a muscle's primary role in one session. |
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

- `min` — below this → +2.0 weekly boost
- `mid` — below this → +1.0 weekly boost
- At/above `mid` → +0.0 boost (sufficiently trained)

### `scoring`

Controls compound vs. isolation balance.

| Key | Default | Description |
|---|---|---|
| `max_total_contribution` | `1.5` | Cap applied to total muscle contributions before scoring. |
| `scaling_exponent` | `0.85` | Exponent for sublinear readiness scaling (`< 1` compresses compound advantage). |

---

## Worked Example

**Setup:** Quads moderately fatigued (0.4), not sore. Squat last session.

```
Squat muscles: { QUADS: 0.8, GLUTES: 0.6 }  → total 1.4, no capping

readiness(QUADS) = 2.5 × (1 − 0.4)² = 2.5 × 0.36 = 0.90
readiness(GLUTES)= 2.5 × (1 − 0.0)² = 2.5 × 1.00 = 2.50

raw_readiness = 0.8×0.90 + 0.6×2.50 = 0.72 + 1.50 = 2.22
scaled        = 2.22 ^ 0.85 ≈ 1.98

weekly_boost  = 0.8×2.0 + 0.6×2.0 = 1.60 + 1.20 = 2.80   # both under min
priority      = 5 × 0.5 = 2.50
recency       = -2.00   # was in last session
soreness      = 0.00

total ≈ 1.98 + 2.80 + 2.50 − 2.00 = 5.28
```
