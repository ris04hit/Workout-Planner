/**
 * @jest-environment jsdom
 */

jest.mock('../../../static/js/ui.js', () => ({
  renderConfigPanel: jest.fn(),
  renderConfigHistory: jest.fn(),
  renderExerciseManagement: jest.fn(),
  renderSuggestion: jest.fn(),
  renderWorkoutUI: jest.fn(),
  renderProgressionSuggestions: jest.fn()
}));

jest.mock('../../../static/js/workout.js', () => ({
  loadSuggestion: jest.fn()
}));

import { buildConfigPayloadFromUI, buildExercisesPayloadFromUI } from '../../../static/js/config.js';
import { state, MUSCLE_ORDER, PATTERN_ORDER } from '../../../static/js/state.js';

function setupConfigDOM() {
  const sessionFields = [
    { field: 'target_exercise_count', value: '6' },
    { field: 'max_difficulty_allowed', value: '5' },
    { field: 'fatigue_decay', value: '0.85' },
    { field: 'sore_penalty_factor', value: '3.0' },
    { field: 'sore_block_threshold', value: '0.6' },
    { field: 'fatigue_block_threshold', value: '0.9' },
    { field: 'fatigue_block_contribution', value: '0.5' },
    { field: 'muscle_usage_limit', value: '0.9' },
  ];

  const muscleInputs = MUSCLE_ORDER.map(m => [
    `<input data-config-scope="muscle_weights" data-group="${m}" type="number" value="2.5">`,
    `<input data-config-scope="weekly_targets" data-target="min" data-group="${m}" type="number" value="1">`,
    `<input data-config-scope="weekly_targets" data-target="mid" data-group="${m}" type="number" value="2">`,
    `<input data-config-scope="weekly_targets" data-target="max" data-group="${m}" type="number" value="4">`,
  ].join('')).join('');

  const patternInputs = PATTERN_ORDER.map(p =>
    `<input data-config-scope="pattern_limits" data-group="${p}" type="number" value="3">`
  ).join('');

  document.body.innerHTML =
    sessionFields.map(f =>
      `<input data-config-scope="session" data-field="${f.field}" type="number" value="${f.value}">`
    ).join('') + muscleInputs + patternInputs;
}

describe('Config Module', () => {
  beforeEach(() => {
    state.config = {};
    state.ui = { exerciseMap: {} };
    document.body.innerHTML = '';
  });

  describe('buildConfigPayloadFromUI', () => {
    beforeEach(setupConfigDOM);

    test('includes all session scalar fields', () => {
      const cfg = buildConfigPayloadFromUI();
      expect(cfg.target_exercise_count).toBe(6);
      expect(cfg.max_difficulty_allowed).toBe(5);
      expect(cfg.fatigue_decay).toBeCloseTo(0.85);
      expect(cfg.sore_penalty_factor).toBeCloseTo(3.0);
      expect(cfg.sore_block_threshold).toBeCloseTo(0.6);
      expect(cfg.fatigue_block_threshold).toBeCloseTo(0.9);
      expect(cfg.fatigue_block_contribution).toBeCloseTo(0.5);
      expect(cfg.muscle_usage_limit).toBeCloseTo(0.9);
    });

    test('includes muscle_weights for all muscles', () => {
      const cfg = buildConfigPayloadFromUI();
      expect(Object.keys(cfg.muscle_weights)).toHaveLength(MUSCLE_ORDER.length);
      MUSCLE_ORDER.forEach(m => {
        expect(cfg.muscle_weights[m]).toBeCloseTo(2.5);
      });
    });

    test('includes weekly_targets with min/mid/max for all muscles', () => {
      const cfg = buildConfigPayloadFromUI();
      MUSCLE_ORDER.forEach(m => {
        expect(cfg.weekly_targets[m]).toEqual({ min: 1, mid: 2, max: 4 });
      });
    });

    test('includes pattern_limits for all patterns', () => {
      const cfg = buildConfigPayloadFromUI();
      expect(Object.keys(cfg.pattern_limits)).toHaveLength(PATTERN_ORDER.length);
      PATTERN_ORDER.forEach(p => {
        expect(cfg.pattern_limits[p]).toBe(3);
      });
    });

    test('falls back to defaults when DOM is empty', () => {
      document.body.innerHTML = '';
      const cfg = buildConfigPayloadFromUI();
      expect(cfg.target_exercise_count).toBe(6);
      expect(cfg.fatigue_decay).toBeCloseTo(0.85);
    });
  });

  describe('buildExercisesPayloadFromUI', () => {
    function setupExerciseDOM() {
      document.body.innerHTML = `
        <div class="exercise-group-section" data-pattern="PUSH">
          <h3>PUSH</h3>
          <div class="exercise-list">
            <div class="exercise-item" data-idx="0">
              <input type="checkbox" data-exercise-enable="0" checked>
              <input type="text" data-exercise-name="0" value="Bench Press">
              <input type="number" data-exercise-difficulty="0" value="3">
              <input type="number" data-exercise-priority="0" value="3">
              <input type="text" data-exercise-family="0" value="PRESS">
              <input type="text" data-exercise-muscles="0" value="CHEST:0.8, TRICEPS:0.4">
            </div>
            <div class="exercise-item" data-idx="1">
              <input type="checkbox" data-exercise-enable="1">
              <input type="text" data-exercise-name="1" value="Push-up">
              <input type="number" data-exercise-difficulty="1" value="1">
              <input type="number" data-exercise-priority="1" value="3">
              <input type="text" data-exercise-family="1" value="PRESS">
              <input type="text" data-exercise-muscles="1" value="CHEST:0.7">
            </div>
          </div>
        </div>
      `;
    }

    test('returns a flat array', () => {
      setupExerciseDOM();
      const exercises = buildExercisesPayloadFromUI();
      expect(Array.isArray(exercises)).toBe(true);
      expect(exercises).toHaveLength(2);
    });

    test('parses name, enabled, difficulty, priority, family', () => {
      setupExerciseDOM();
      const [bench] = buildExercisesPayloadFromUI();
      expect(bench.name).toBe('Bench Press');
      expect(bench.enabled).toBe(true);
      expect(bench.difficulty).toBe(3);
      expect(bench.priority).toBe(3);
      expect(bench.family).toBe('PRESS');
    });

    test('parses disabled state', () => {
      setupExerciseDOM();
      const [, pushup] = buildExercisesPayloadFromUI();
      expect(pushup.enabled).toBe(false);
    });

    test('parses muscles as object', () => {
      setupExerciseDOM();
      const [bench] = buildExercisesPayloadFromUI();
      expect(bench.muscles).toEqual({ CHEST: 0.8, TRICEPS: 0.4 });
    });

    test('reads pattern from data-pattern attribute', () => {
      setupExerciseDOM();
      buildExercisesPayloadFromUI().forEach(ex => {
        expect(ex.pattern).toBe('PUSH');
      });
    });

    test('skips items with empty name', () => {
      document.body.innerHTML = `
        <div class="exercise-group-section" data-pattern="PUSH">
          <h3>PUSH</h3>
          <div class="exercise-list">
            <div class="exercise-item" data-idx="0">
              <input type="text" data-exercise-name="0" value="  ">
            </div>
            <div class="exercise-item" data-idx="1">
              <input type="text" data-exercise-name="1" value="Valid">
            </div>
          </div>
        </div>`;
      const exercises = buildExercisesPayloadFromUI();
      expect(exercises).toHaveLength(1);
      expect(exercises[0].name).toBe('Valid');
    });
  });
});
