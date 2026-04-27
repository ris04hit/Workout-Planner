"""
Unit tests for core_logic.py — exercise-based suggestion algorithm.
"""
import unittest
from core_logic import (
    get_effective_config,
    readiness,
    is_exercise_valid,
    compute_exercise_score,
    score_exercise_breakdown,
    select_workout,
    _cap_contributions,
    _apply_sublinear,
)

SQUAT = {"name": "Squat", "enabled": True, "difficulty": 3, "priority": 5,
         "pattern": "SQUAT", "family": "SQUAT", "muscles": {"QUADS": 0.8, "GLUTES": 0.6}}
BENCH = {"name": "Bench Press", "enabled": True, "difficulty": 3, "priority": 5,
         "pattern": "PUSH", "family": "PRESS", "muscles": {"CHEST": 0.8, "TRICEPS": 0.5}}
PLANK = {"name": "Plank", "enabled": True, "difficulty": 2, "priority": 5,
         "pattern": "CORE", "family": "CORE_STATIC", "muscles": {"CORE": 0.9}}
DISABLED = {"name": "Disabled", "enabled": False, "difficulty": 1, "priority": 3,
             "pattern": "ACCESSORY", "family": "TEST", "muscles": {"BICEPS": 0.9}}
EXERCISES = [SQUAT, BENCH, PLANK, DISABLED]


class TestGetEffectiveConfig(unittest.TestCase):
    def test_returns_all_keys(self):
        cfg = get_effective_config()
        for key in ("muscle_weights", "fatigue_decay", "target_exercise_count",
                    "pattern_limits", "weekly_targets", "sore_block_threshold"):
            self.assertIn(key, cfg)

    def test_overrides_applied(self):
        cfg = get_effective_config({"fatigue_decay": 0.5})
        self.assertAlmostEqual(cfg["fatigue_decay"], 0.5)

    def test_partial_muscle_weight_override(self):
        cfg = get_effective_config({"muscle_weights": {"QUADS": 99.0}})
        self.assertEqual(cfg["muscle_weights"]["QUADS"], 99.0)
        self.assertNotEqual(cfg["muscle_weights"].get("CHEST"), 99.0)

    def test_empty_stored_equals_no_stored(self):
        cfg1 = get_effective_config({})
        cfg2 = get_effective_config()
        self.assertEqual(cfg1["fatigue_decay"], cfg2["fatigue_decay"])


class TestReadiness(unittest.TestCase):
    def cfg(self): return get_effective_config()

    def test_zero_fatigue_full_readiness(self):
        w = self.cfg()["muscle_weights"]["QUADS"]
        self.assertAlmostEqual(readiness("QUADS", {}, self.cfg()), w)

    def test_full_fatigue_zero_readiness(self):
        self.assertAlmostEqual(readiness("QUADS", {"QUADS": 1.0}, self.cfg()), 0.0)

    def test_half_fatigue(self):
        w = self.cfg()["muscle_weights"]["QUADS"]
        self.assertAlmostEqual(readiness("QUADS", {"QUADS": 0.5}, self.cfg()), w * 0.25)

    def test_fatigue_clamped_above_one(self):
        self.assertAlmostEqual(readiness("QUADS", {"QUADS": 9.9}, self.cfg()), 0.0)



class TestIsExerciseValid(unittest.TestCase):
    def cfg(self): return get_effective_config()

    def test_disabled_invalid(self):
        self.assertFalse(is_exercise_valid(DISABLED, {}, {}, self.cfg()))

    def test_enabled_valid(self):
        cfg = get_effective_config({"max_difficulty_allowed": 5})
        self.assertTrue(is_exercise_valid(SQUAT, {}, {}, cfg))

    def test_max_difficulty_blocks(self):
        cfg = get_effective_config({"max_difficulty_allowed": 2})
        self.assertFalse(is_exercise_valid(SQUAT, {}, {}, cfg))  # difficulty=3

    def test_sore_blocks_high_contribution(self):
        cfg = get_effective_config({"sore_block_threshold": 0.6})
        self.assertFalse(is_exercise_valid(SQUAT, {}, {"QUADS": True}, cfg))

    def test_sore_does_not_block_low_contribution(self):
        cfg = get_effective_config({"sore_block_threshold": 0.95, "max_difficulty_allowed": 5})
        self.assertTrue(is_exercise_valid(SQUAT, {}, {"QUADS": True}, cfg))

    def test_high_fatigue_blocks(self):
        cfg = get_effective_config({"fatigue_block_threshold": 0.8,
                                    "fatigue_block_contribution": 0.5})
        self.assertFalse(is_exercise_valid(SQUAT, {"QUADS": 0.95}, {}, cfg))

    def test_moderate_fatigue_does_not_block(self):
        cfg = get_effective_config({"max_difficulty_allowed": 5})
        self.assertTrue(is_exercise_valid(SQUAT, {"QUADS": 0.3}, {}, cfg))


class TestComputeExerciseScore(unittest.TestCase):
    def cfg(self): return get_effective_config()

    def test_fresh_scores_higher_than_tired(self):
        s_fresh = compute_exercise_score(SQUAT, {}, {}, {}, [], self.cfg())
        s_tired = compute_exercise_score(SQUAT, {"QUADS": 0.9, "GLUTES": 0.9}, {}, {}, [], self.cfg())
        self.assertGreater(s_fresh, s_tired)

    def test_sore_reduces_score(self):
        s_normal = compute_exercise_score(SQUAT, {}, {}, {}, [], self.cfg())
        s_sore   = compute_exercise_score(SQUAT, {}, {}, {"QUADS": True}, [], self.cfg())
        self.assertGreater(s_normal, s_sore)

    def test_repetition_penalty(self):
        s_fresh    = compute_exercise_score(SQUAT, {}, {}, {}, [], self.cfg())
        s_repeated = compute_exercise_score(SQUAT, {}, {}, {}, ["Squat"], self.cfg())
        self.assertGreater(s_fresh, s_repeated)

    def test_higher_priority_increases_score(self):
        low_p  = compute_exercise_score({**SQUAT, "priority": 1}, {}, {}, {}, [], self.cfg())
        high_p = compute_exercise_score({**SQUAT, "priority": 5}, {}, {}, {}, [], self.cfg())
        self.assertGreater(high_p, low_p)


class TestSelectWorkout(unittest.TestCase):
    def cfg(self, **kw): return get_effective_config({"target_exercise_count": 3, **kw})

    def test_returns_list(self):
        self.assertIsInstance(select_workout({}, {}, {}, [], EXERCISES, self.cfg()), list)

    def test_up_to_target(self):
        result = select_workout({}, {}, {}, [], EXERCISES, self.cfg())
        self.assertLessEqual(len(result), 3)

    def test_disabled_not_selected(self):
        result = select_workout({}, {}, {}, [], EXERCISES, self.cfg())
        self.assertNotIn("Disabled", [e["name"] for e in result])

    def test_fallback_returns_something(self):
        sore = {m: True for m in ("QUADS", "GLUTES", "CHEST", "TRICEPS", "CORE")}
        result = select_workout({}, {}, sore, [], EXERCISES, self.cfg())
        self.assertGreater(len(result), 0)

    def test_pattern_limit_respected(self):
        many = [
            {"name": f"Push{i}", "enabled": True, "difficulty": 1, "priority": 5,
             "pattern": "PUSH", "family": f"F{i}", "muscles": {"CHEST": 0.5}}
            for i in range(10)
        ]
        cfg = get_effective_config({"target_exercise_count": 10, "pattern_limits": {"PUSH": 2}})
        result = select_workout({}, {}, {}, [], many, cfg)
        self.assertLessEqual(sum(1 for e in result if e["pattern"] == "PUSH"), 2)

    def test_family_deduplication(self):
        two_press = [
            {"name": "Bench", "enabled": True, "difficulty": 2, "priority": 5,
             "pattern": "PUSH", "family": "PRESS", "muscles": {"CHEST": 0.8}},
            {"name": "Dumbbell Press", "enabled": True, "difficulty": 2, "priority": 4,
             "pattern": "PUSH", "family": "PRESS", "muscles": {"CHEST": 0.7}},
        ]
        cfg = get_effective_config({"target_exercise_count": 5})
        result = select_workout({}, {}, {}, [], two_press, cfg)
        press = [e["name"] for e in result if e["family"] == "PRESS"]
        self.assertLessEqual(len(press), 1)


    def test_ordering_tiebreaker(self):
        """When two exercises have identical scores and no history, list order wins."""
        identical = [
            {"name": "A", "enabled": True, "difficulty": 2, "priority": 3,
             "pattern": "PUSH", "family": "FA", "muscles": {"CHEST": 0.8}},
            {"name": "B", "enabled": True, "difficulty": 2, "priority": 3,
             "pattern": "PUSH", "family": "FB", "muscles": {"CHEST": 0.8}},
        ]
        cfg = get_effective_config({"target_exercise_count": 1, "pattern_limits": {"PUSH": 1}})
        result = select_workout({}, {}, {}, [], identical, cfg)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["name"], "A", "First exercise should win on equal score")

    def test_recency_tiebreaker(self):
        """When two exercises have identical scores, prefer the one done less recently."""
        identical = [
            {"name": "A", "enabled": True, "difficulty": 2, "priority": 3,
             "pattern": "PUSH", "family": "FA", "muscles": {"CHEST": 0.8}},
            {"name": "B", "enabled": True, "difficulty": 2, "priority": 3,
             "pattern": "PUSH", "family": "FB", "muscles": {"CHEST": 0.8}},
        ]
        cfg = get_effective_config({"target_exercise_count": 1, "pattern_limits": {"PUSH": 1}})
        # A was done 1 day ago, B was done 10 days ago — B should win the tie
        last_done = {"A": 1, "B": 10}
        result = select_workout({}, {}, {}, [], identical, cfg, last_done_days=last_done)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["name"], "B", "Less recently done exercise should win tie")

    def test_recency_never_done_beats_recently_done(self):
        """An exercise never done in history should beat one done recently on tied scores."""
        identical = [
            {"name": "A", "enabled": True, "difficulty": 2, "priority": 3,
             "pattern": "PUSH", "family": "FA", "muscles": {"CHEST": 0.8}},
            {"name": "B", "enabled": True, "difficulty": 2, "priority": 3,
             "pattern": "PUSH", "family": "FB", "muscles": {"CHEST": 0.8}},
        ]
        cfg = get_effective_config({"target_exercise_count": 1, "pattern_limits": {"PUSH": 1}})
        # A done recently; B never done — B should win
        result = select_workout({}, {}, {}, [], identical, cfg, last_done_days={"A": 2})
        self.assertEqual(result[0]["name"], "B", "Never-done exercise should beat recently done on tie")


class TestCapContributions(unittest.TestCase):
    def test_no_cap_when_under_limit(self):
        muscles = {"QUADS": 0.8, "GLUTES": 0.6}  # total 1.4 <= 1.5
        self.assertEqual(_cap_contributions(muscles, 1.5), muscles)

    def test_exact_limit_not_capped(self):
        muscles = {"QUADS": 1.5}
        self.assertEqual(_cap_contributions(muscles, 1.5), muscles)

    def test_cap_scales_total_down(self):
        muscles = {"CHEST": 0.8, "TRICEPS": 0.5, "SHOULDERS": 0.3}  # total 1.6 > 1.5
        result = _cap_contributions(muscles, 1.5)
        self.assertAlmostEqual(sum(result.values()), 1.5, places=5)

    def test_cap_preserves_ratios(self):
        muscles = {"CHEST": 0.8, "TRICEPS": 0.4}  # total 1.2, but let's use limit 0.6
        result = _cap_contributions(muscles, 0.6)
        self.assertAlmostEqual(result["CHEST"] / result["TRICEPS"],
                               muscles["CHEST"] / muscles["TRICEPS"], places=5)

    def test_empty_muscles_returns_empty(self):
        self.assertEqual(_cap_contributions({}, 1.5), {})


class TestApplySublinear(unittest.TestCase):
    def test_zero_returns_zero(self):
        self.assertAlmostEqual(_apply_sublinear(0.0, 0.85), 0.0)

    def test_one_returns_one(self):
        self.assertAlmostEqual(_apply_sublinear(1.0, 0.85), 1.0)

    def test_correct_power(self):
        self.assertAlmostEqual(_apply_sublinear(4.0, 0.85), 4.0 ** 0.85, places=5)

    def test_compresses_ratio(self):
        # Sublinear scaling reduces gap between large and small values
        ratio_raw = 10.0 / 2.0
        ratio_scaled = _apply_sublinear(10.0, 0.85) / _apply_sublinear(2.0, 0.85)
        self.assertLess(ratio_scaled, ratio_raw)


class TestScoreExerciseBreakdown(unittest.TestCase):
    def cfg(self): return get_effective_config()

    def test_returns_all_keys(self):
        bd = score_exercise_breakdown(SQUAT, {}, {}, {}, [], self.cfg())
        for key in ("total", "readiness", "weekly_boost", "priority",
                    "recency_penalty", "soreness_penalty", "contribution_capped"):
            self.assertIn(key, bd)

    def test_readiness_positive_when_fresh(self):
        bd = score_exercise_breakdown(SQUAT, {}, {}, {}, [], self.cfg())
        self.assertGreater(bd["readiness"], 0)

    def test_recency_penalty_when_in_history(self):
        cfg = self.cfg()
        expected = -cfg["scoring"]["recency_penalty"]
        bd = score_exercise_breakdown(SQUAT, {}, {}, {}, ["Squat"], cfg)
        self.assertAlmostEqual(bd["recency_penalty"], expected)

    def test_recency_zero_when_not_in_history(self):
        bd = score_exercise_breakdown(SQUAT, {}, {}, {}, [], self.cfg())
        self.assertAlmostEqual(bd["recency_penalty"], 0.0)

    def test_soreness_penalty_negative_when_sore(self):
        bd = score_exercise_breakdown(SQUAT, {}, {}, {"QUADS": True}, [], self.cfg())
        self.assertLess(bd["soreness_penalty"], 0)

    def test_contribution_capped_true_when_over_limit(self):
        heavy = {**SQUAT, "muscles": {"CHEST": 0.8, "TRICEPS": 0.5, "SHOULDERS": 0.3}}  # 1.6
        bd = score_exercise_breakdown(heavy, {}, {}, {}, [], self.cfg())
        self.assertTrue(bd["contribution_capped"])

    def test_contribution_capped_false_when_under_limit(self):
        # PLANK has only CORE: 0.9 — safely below any default max_total_contribution
        bd = score_exercise_breakdown(PLANK, {}, {}, {}, [], self.cfg())
        self.assertFalse(bd["contribution_capped"])

    def test_total_equals_sum_of_components(self):
        bd = score_exercise_breakdown(SQUAT, {}, {}, {}, [], self.cfg())
        expected = (bd["readiness"] + bd["weekly_boost"] + bd["priority"]
                    + bd["recency_penalty"] + bd["soreness_penalty"])
        self.assertAlmostEqual(bd["total"], expected, places=1)


class TestScoringConfig(unittest.TestCase):
    def test_scoring_section_present_in_effective_config(self):
        cfg = get_effective_config()
        self.assertIn("scoring", cfg)
        self.assertIn("max_total_contribution", cfg["scoring"])
        self.assertIn("scaling_exponent", cfg["scoring"])

    def test_scoring_override_merged(self):
        cfg = get_effective_config({"scoring": {"scaling_exponent": 0.5}})
        self.assertAlmostEqual(cfg["scoring"]["scaling_exponent"], 0.5)
        self.assertIn("max_total_contribution", cfg["scoring"])  # default still present

    def test_lower_alpha_reduces_compound_advantage(self):
        compound  = {"name": "C", "enabled": True, "difficulty": 2, "priority": 3,
                     "pattern": "PUSH", "family": "F",
                     "muscles": {"CHEST": 0.8, "TRICEPS": 0.5, "SHOULDERS": 0.3}}
        isolation = {"name": "I", "enabled": True, "difficulty": 2, "priority": 3,
                     "pattern": "PUSH", "family": "F2",
                     "muscles": {"BICEPS": 0.8}}
        cfg_linear    = get_effective_config({"scoring": {"scaling_exponent": 1.0}})
        cfg_sublinear = get_effective_config({"scoring": {"scaling_exponent": 0.5}})
        ratio_linear    = (compute_exercise_score(compound,  {}, {}, {}, [], cfg_linear) /
                           compute_exercise_score(isolation, {}, {}, {}, [], cfg_linear))
        ratio_sublinear = (compute_exercise_score(compound,  {}, {}, {}, [], cfg_sublinear) /
                           compute_exercise_score(isolation, {}, {}, {}, [], cfg_sublinear))
        self.assertLess(ratio_sublinear, ratio_linear)


if __name__ == "__main__":
    unittest.main()
