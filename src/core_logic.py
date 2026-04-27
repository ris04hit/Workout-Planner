"""
core_logic.py — Exercise-based workout suggestion algorithm.

STATE → SCORE → SELECT → UPDATE
"""

import json
import os
from datetime import date, timedelta
from typing import Dict, List, Optional

# ---------------------------------------------------------------------------
# Default config loader
# ---------------------------------------------------------------------------

_DEFAULT_CONFIG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data", "default", "config.json"
)


def _load_default_config() -> dict:
    """Load default configuration from data/default/config.json."""
    try:
        with open(_DEFAULT_CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        raise RuntimeError(
            f"Default config not found or invalid at {_DEFAULT_CONFIG_PATH}. "
            "Run scripts/setup.sh to initialise the data directory."
        )


# ---------------------------------------------------------------------------
# Config merging
# ---------------------------------------------------------------------------

def get_effective_config(stored: Optional[dict] = None) -> dict:
    """
    Merge user-stored overrides over the defaults from data/default/config.json.
    All keys are optional in stored — missing keys fall through to defaults.
    """
    defaults = _load_default_config()

    merged = {
        "muscle_weights":            {**defaults["muscle_weights"]},
        "fatigue_decay":             defaults["fatigue_decay"],
        "max_difficulty_allowed":    defaults["max_difficulty_allowed"],
        "target_exercise_count":     defaults["target_exercise_count"],
        "pattern_limits":            {**defaults["pattern_limits"]},
        "muscle_usage_limit":        defaults["muscle_usage_limit"],
        "sore_block_threshold":      defaults["sore_block_threshold"],
        "fatigue_block_threshold":   defaults["fatigue_block_threshold"],
        "fatigue_block_contribution":defaults["fatigue_block_contribution"],
        "sore_penalty_factor":       defaults["sore_penalty_factor"],
        "scoring":                   {**defaults["scoring"]},
        "weekly_targets": {
            m: {**t} for m, t in defaults["weekly_targets"].items()
        },
    }

    if not stored:
        return merged

    for scalar in (
        "fatigue_decay", "max_difficulty_allowed", "target_exercise_count",
        "muscle_usage_limit", "sore_block_threshold", "fatigue_block_threshold",
        "fatigue_block_contribution", "sore_penalty_factor"
    ):
        if scalar in stored:
            merged[scalar] = stored[scalar]

    for mapping in ("muscle_weights", "pattern_limits"):
        if isinstance(stored.get(mapping), dict):
            merged[mapping].update(stored[mapping])

    if isinstance(stored.get("weekly_targets"), dict):
        for muscle, target in stored["weekly_targets"].items():
            if muscle in merged["weekly_targets"] and isinstance(target, dict):
                merged["weekly_targets"][muscle].update(target)

    if isinstance(stored.get("scoring"), dict):
        merged["scoring"].update(stored["scoring"])

    return merged


# ---------------------------------------------------------------------------
# Fatigue helpers
# ---------------------------------------------------------------------------

def readiness(muscle: str, fatigue: Dict[str, float], config: dict) -> float:
    """Readiness of a muscle: weight × (1 − fatigue)²."""
    w = config["muscle_weights"].get(muscle, 1.0)
    f = min(1.0, max(0.0, fatigue.get(muscle, 0.0)))
    return w * (1.0 - f) ** 2


def compute_fatigue_from_history(
    workouts: List[dict],
    config: dict,
    today: date = None,
    exercise_defs: List[dict] = None
) -> Dict[str, float]:
    """
    Derive current per-muscle fatigue entirely from workout history.

    If exercise_defs is provided, muscle contributions are looked up from the
    current exercise definitions (by name) rather than the values stored in the
    workout record.  This ensures changes to muscle weights take effect
    immediately.  Falls back to the stored value if an exercise is not found.

    Algorithm:
      - Walk workouts in chronological order.
      - Between consecutive workout dates apply compound daily decay.
      - Add each workout's muscle contributions (clamped to 1.0).
      - After the last workout, decay forward to today.
    """
    if today is None:
        today = date.today()

    decay = config["fatigue_decay"]
    fatigue: Dict[str, float] = {}
    last_date: date = None

    def_by_name: Dict[str, dict] = (
        {e["name"]: e.get("muscles", {}) for e in exercise_defs if "name" in e}
        if exercise_defs else {}
    )

    for w in sorted(workouts, key=lambda x: x.get("date", "")):
        try:
            workout_date = date.fromisoformat(w["date"])
        except (KeyError, ValueError):
            continue

        if last_date is not None and workout_date > last_date:
            days = (workout_date - last_date).days
            factor = decay ** days
            fatigue = {m: v * factor for m, v in fatigue.items()}

        for ex in w.get("exercises", []):
            muscles = def_by_name.get(ex.get("name", "")) or ex.get("muscles", {})
            for muscle, contribution in muscles.items():
                fatigue[muscle] = min(1.0, fatigue.get(muscle, 0.0) + contribution)

        last_date = workout_date

    if last_date is not None and today > last_date:
        days = (today - last_date).days
        factor = decay ** days
        fatigue = {m: v * factor for m, v in fatigue.items()}

    return fatigue


def compute_weekly_load_from_history(
    workouts: List[dict],
    today: date = None,
    exercise_defs: List[dict] = None
) -> Dict[str, float]:
    """
    Derive rolling 7-day muscle load entirely from workout history.

    If exercise_defs is provided, muscle contributions are looked up from the
    current exercise definitions rather than the stored workout values.
    """
    if today is None:
        today = date.today()

    cutoff = today - timedelta(days=7)
    load: Dict[str, float] = {}

    def_by_name: Dict[str, dict] = (
        {e["name"]: e.get("muscles", {}) for e in exercise_defs if "name" in e}
        if exercise_defs else {}
    )

    for w in workouts:
        try:
            workout_date = date.fromisoformat(w["date"])
        except (KeyError, ValueError):
            continue
        if workout_date <= cutoff:
            continue
        for ex in w.get("exercises", []):
            muscles = def_by_name.get(ex.get("name", "")) or ex.get("muscles", {})
            for muscle, contribution in muscles.items():
                load[muscle] = load.get(muscle, 0.0) + contribution

    return load


# ---------------------------------------------------------------------------
# Hard constraints
# ---------------------------------------------------------------------------

def is_exercise_valid(
    exercise: dict,
    fatigue: Dict[str, float],
    sore: Dict[str, bool],
    config: dict
) -> bool:
    """
    Return False if any hard constraint is violated:
    - exercise is disabled
    - difficulty exceeds max allowed
    - a sore muscle has contribution >= sore_block_threshold
    - an extremely fatigued muscle has contribution >= fatigue_block_contribution
    """
    if not exercise.get("enabled", True):
        return False

    if exercise.get("difficulty", 1) > config["max_difficulty_allowed"]:
        return False

    sore_thresh = config["sore_block_threshold"]
    fatigue_thresh = config["fatigue_block_threshold"]
    fatigue_contrib = config["fatigue_block_contribution"]

    for muscle, c in exercise.get("muscles", {}).items():
        if sore.get(muscle, False) and c >= sore_thresh:
            return False
        if fatigue.get(muscle, 0.0) > fatigue_thresh and c >= fatigue_contrib:
            return False

    return True


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def _cap_contributions(muscles: Dict[str, float], max_total: float) -> Dict[str, float]:
    """
    Scale contributions proportionally so their sum ≤ max_total.
    Preserves muscle ratios; returns original dict if already within limit.
    """
    total = sum(muscles.values())
    if total <= max_total or total == 0:
        return muscles
    scale = max_total / total
    return {m: c * scale for m, c in muscles.items()}


def _apply_sublinear(x: float, alpha: float) -> float:
    """Apply x^alpha sublinear scaling (x ≥ 0 guaranteed for readiness sums)."""
    return x ** alpha if x > 0 else 0.0


def _weekly_bonus(muscle: str, weekly_load: Dict[str, float], config: dict) -> float:
    """Return weekly boost based on how much a muscle has been trained this week."""
    load = weekly_load.get(muscle, 0.0)
    target = config["weekly_targets"].get(muscle)
    if target is None:
        return 0.0
    s = config["scoring"]
    if load == 0:
        return s["weekly_boost_untrained"]
    if load < target["min"]:
        return s["weekly_boost_below_min"]
    if load < target.get("mid", (target["min"] + target["max"]) / 2):
        return s["weekly_boost_below_mid"]
    return 0.0


def score_exercise_breakdown(
    exercise: dict,
    fatigue: Dict[str, float],
    weekly_load: Dict[str, float],
    sore: Dict[str, bool],
    history: List[str],
    config: dict
) -> dict:
    """
    Return score components and total for display purposes.

    Keys: total, readiness, weekly_boost, priority, recency_penalty,
          soreness_penalty, contribution_capped
    """
    scoring_cfg  = config["scoring"]
    max_total    = scoring_cfg["max_total_contribution"]
    alpha        = scoring_cfg["scaling_exponent"]

    raw_muscles  = exercise.get("muscles", {})
    muscles      = _cap_contributions(raw_muscles, max_total)
    capped       = sum(raw_muscles.values()) > max_total

    raw_readiness   = sum(c * readiness(m, fatigue, config) for m, c in muscles.items())
    scaled_readiness = _apply_sublinear(raw_readiness, alpha)
    weekly_boost    = sum(c * _weekly_bonus(m, weekly_load, config) for m, c in muscles.items())
    priority_bonus  = exercise.get("priority", 3) * scoring_cfg["priority_coeff"]
    recency_penalty = -scoring_cfg["recency_penalty"] if exercise.get("name") in history else 0.0
    sore_penalty    = -sum(
        c * config["sore_penalty_factor"]
        for m, c in muscles.items() if sore.get(m, False)
    )
    total = scaled_readiness + weekly_boost + priority_bonus + recency_penalty + sore_penalty
    return {
        "total":                round(total, 2),
        "readiness":            round(scaled_readiness, 2),
        "weekly_boost":         round(weekly_boost, 2),
        "priority":             round(priority_bonus, 2),
        "recency_penalty":      round(recency_penalty, 2),
        "soreness_penalty":     round(sore_penalty, 2),
        "contribution_capped":  capped,
    }


def compute_exercise_score(
    exercise: dict,
    fatigue: Dict[str, float],
    weekly_load: Dict[str, float],
    sore: Dict[str, bool],
    history: List[str],
    config: dict
) -> float:
    """
    Score an exercise. Higher is better.

    Pipeline:
    1. Cap total contribution to max_total_contribution (preserves ratios)
    2. raw_readiness = Σ c × readiness(m)
    3. scaled_readiness = raw_readiness ^ scaling_exponent  (sublinear)
    4. Add weekly boost, priority, recency and soreness penalties linearly
    """
    scoring_cfg  = config["scoring"]
    max_total    = scoring_cfg["max_total_contribution"]
    alpha        = scoring_cfg["scaling_exponent"]

    muscles = _cap_contributions(exercise.get("muscles", {}), max_total)

    raw_readiness = sum(c * readiness(m, fatigue, config) for m, c in muscles.items())
    score = _apply_sublinear(raw_readiness, alpha)

    for muscle, c in muscles.items():
        score += c * _weekly_bonus(muscle, weekly_load, config)
        if sore.get(muscle, False):
            score -= c * config["sore_penalty_factor"]

    score += exercise.get("priority", 3) * scoring_cfg["priority_coeff"]

    if exercise.get("name") in history:
        score -= scoring_cfg["recency_penalty"]

    return score


# ---------------------------------------------------------------------------
# Selection
# ---------------------------------------------------------------------------

def _adjusted_score(
    exercise: dict,
    muscle_usage: Dict[str, float],
    fatigue: Dict[str, float],
    config: dict
) -> float:
    """Score adjusted for already-accumulated muscle usage (diminishing returns)."""
    scoring_cfg = config["scoring"]
    max_total   = scoring_cfg["max_total_contribution"]
    muscles     = _cap_contributions(exercise.get("muscles", {}), max_total)
    total = sum(
        c * readiness(m, fatigue, config) * (1.0 - min(1.0, muscle_usage.get(m, 0.0)))
        for m, c in muscles.items()
    )
    return total


def select_workout(
    fatigue: Dict[str, float],
    weekly_load: Dict[str, float],
    sore: Dict[str, bool],
    history: List[str],
    exercises: List[dict],
    config: Optional[dict] = None,
    last_done_days: Optional[Dict[str, int]] = None,
) -> List[dict]:
    """
    Select a set of exercises for today's workout.

    Algorithm:
    1. Filter to valid exercises.
    2. Score each exercise.
    3. Greedy selection loop:
       - Check pattern limit.
       - Check family deduplication.
       - Check muscle_usage_limit.
       - Accept exercise, update muscle_usage and pattern_count.
    4. Fallback: relax constraints if no workout produced.

    Tiebreaking (equal score):
      1. Prefer exercise done least recently (larger days_since_last_done).
         Exercises never done are treated as done infinitely long ago.
      2. Final fallback: original list position (first in config wins).

    Returns list of selected exercise dicts (with original fields).
    """
    config = get_effective_config(config)
    _last_done = last_done_days or {}
    _NEVER_DONE = 36500  # sentinel: ~100 years, always beats any real recency

    def _run(exercises_pool, relax: bool = False) -> List[dict]:
        valid = [e for e in exercises_pool if is_exercise_valid(e, fatigue, sore, config)]

        scored = [e for _, e in sorted(
            enumerate(valid),
            key=lambda ie: (
                -compute_exercise_score(ie[1], fatigue, weekly_load, sore, history, config),
                -_last_done.get(ie[1]["name"], _NEVER_DONE),  # prefer least recent
                ie[0]  # final fallback: list position
            )
        )]

        workout: List[dict] = []
        muscle_usage: Dict[str, float] = {}
        pattern_count: Dict[str, int] = {}
        families_used: set = set()
        target = config["target_exercise_count"]
        pattern_limits = config["pattern_limits"]
        muscle_usage_limit = config["muscle_usage_limit"]

        for ex in scored:
            if len(workout) >= target:
                break

            pattern = ex.get("pattern", "ACCESSORY")
            family = ex.get("family", ex["name"])

            # Pattern limit
            if not relax:
                limit = pattern_limits.get(pattern, 99)
                if pattern_count.get(pattern, 0) >= limit:
                    continue

            # Family deduplication (at most one per family)
            if not relax and family in families_used:
                continue

            # Muscle usage limit — skip if all primary muscles already saturated
            muscles = ex.get("muscles", {})
            if not relax and muscles:
                primary_muscle = max(muscles, key=muscles.get)
                if muscle_usage.get(primary_muscle, 0.0) >= muscle_usage_limit:
                    continue

            # Accept
            workout.append(ex)
            pattern_count[pattern] = pattern_count.get(pattern, 0) + 1
            families_used.add(family)
            for muscle, c in muscles.items():
                muscle_usage[muscle] = muscle_usage.get(muscle, 0.0) + c

        return workout

    # Normal pass
    result = _run(exercises)

    # Fallback: relax all constraints, include sore-blocked exercises as penalised
    if not result:
        sore_relaxed = {m: False for m in sore}
        valid_all = [e for e in exercises if e.get("enabled", True)]
        result = _run(valid_all, relax=True)

    # Last resort: return first enabled exercise
    if not result:
        for ex in exercises:
            if ex.get("enabled", True):
                return [ex]

    return result


# ---------------------------------------------------------------------------
# Example run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

    _MUSCLES_PATH = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data", "default", "exercises.json"
    )
    with open(_MUSCLES_PATH, encoding="utf-8") as f:
        exercises = json.load(f)

    fatigue = {}
    weekly_load = {}
    sore = {}
    history = []

    config = get_effective_config()
    result = select_workout(fatigue, weekly_load, sore, history, exercises, config)

    print(f"Selected {len(result)} exercises:")
    for ex in result:
        score = compute_exercise_score(ex, fatigue, weekly_load, sore, history, config)
        print(f"  [{ex['pattern']:10s}] {ex['name']:25s}  score={score:.2f}")
