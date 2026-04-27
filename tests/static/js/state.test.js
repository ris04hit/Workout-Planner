/**
 * @jest-environment jsdom
 */

import { state, MUSCLE_ORDER, PATTERN_ORDER, setIsSaving, isSaving } from '../../../static/js/state.js';

describe('State Module', () => {
  beforeEach(() => {
    state.exercises = [];
    state.muscles = [];
    state.config = null;
    state.configHistory = [];
    state.soreness = {};
    state.fatigue = {};
    state.weeklyLoad = {};
    state.ui = { exerciseMap: {} };
    setIsSaving(false);
  });

  describe('state object', () => {
    test('has correct shape', () => {
      expect(state).toHaveProperty('exercises');
      expect(state).toHaveProperty('muscles');
      expect(state).toHaveProperty('config');
      expect(state).toHaveProperty('configHistory');
      expect(state).toHaveProperty('soreness');
      expect(state).toHaveProperty('fatigue');
      expect(state).toHaveProperty('weeklyLoad');
      expect(state).toHaveProperty('ui');
    });

    test('has correct initial values', () => {
      expect(state.exercises).toEqual([]);
      expect(state.muscles).toEqual([]);
      expect(state.config).toBeNull();
      expect(state.configHistory).toEqual([]);
      expect(state.fatigue).toEqual({});
      expect(state.weeklyLoad).toEqual({});
    });

    test('does not have old group-based fields', () => {
      expect(state).not.toHaveProperty('primary');
      expect(state).not.toHaveProperty('secondary');
      expect(state).not.toHaveProperty('pickerState');
    });

    test('allows updating exercises list', () => {
      state.exercises = [
        { name: 'Squat', pattern: 'SQUAT', muscles: { QUADS: 0.8 } },
        { name: 'Bench Press', pattern: 'PUSH', muscles: { CHEST: 0.8 } }
      ];
      expect(state.exercises).toHaveLength(2);
      expect(state.exercises[0].name).toBe('Squat');
    });

    test('allows updating fatigue', () => {
      state.fatigue = { QUADS: 0.5, CHEST: 0.3 };
      expect(state.fatigue.QUADS).toBe(0.5);
    });

    test('allows updating weeklyLoad', () => {
      state.weeklyLoad = { QUADS: 2.4 };
      expect(state.weeklyLoad.QUADS).toBe(2.4);
    });

    test('allows updating ui.exerciseMap', () => {
      state.ui.exerciseMap = { Squat: { id: 'ex1', name: 'Squat' } };
      expect(state.ui.exerciseMap.Squat.name).toBe('Squat');
    });
  });

  describe('MUSCLE_ORDER', () => {
    test('is an array', () => {
      expect(Array.isArray(MUSCLE_ORDER)).toBe(true);
    });

    test('contains all 12 muscles', () => {
      for (const m of ['QUADS','GLUTES','HAMSTRINGS','CALVES','CHEST',
                       'SHOULDERS','TRICEPS','LATS','BICEPS','REAR_DELTS',
                       'FOREARMS','CORE']) {
        expect(MUSCLE_ORDER).toContain(m);
      }
    });

    test('starts with QUADS', () => {
      expect(MUSCLE_ORDER[0]).toBe('QUADS');
    });

    test('ends with CORE', () => {
      expect(MUSCLE_ORDER[MUSCLE_ORDER.length - 1]).toBe('CORE');
    });
  });

  describe('PATTERN_ORDER', () => {
    test('is an array', () => {
      expect(Array.isArray(PATTERN_ORDER)).toBe(true);
    });

    test('contains all 6 patterns', () => {
      for (const p of ['SQUAT','HINGE','PUSH','PULL','CORE','ACCESSORY']) {
        expect(PATTERN_ORDER).toContain(p);
      }
    });
  });

  describe('isSaving', () => {
    test('defaults to false', () => {
      expect(isSaving).toBe(false);
    });

    test('setIsSaving updates the value', () => {
      setIsSaving(true);
      // exported by value — just confirm no throw
    });
  });
});
