// =========================
// STATE
// =========================

export let isSaving = false;
export function setIsSaving(val) { isSaving = val; }

export const state = {
  exercises: [],    // suggested exercises for today's workout (from /api/suggest)
  muscles: [],      // full exercise list (flat) for management
  config: null,
  configHistory: [],
  soreness: {},
  fatigue: {},
  weeklyLoad: {},
  overrideMode: false,   // true when user has overridden the "already done today" lock
  ui: {
    exerciseMap: {},  // { exerciseName: { id, name } }
    skipPrefill: false // suppresses preFillSetsFromHistory when loading a specific workout for editing
  }
};

export const MUSCLE_ORDER = [
  'QUADS', 'GLUTES', 'HAMSTRINGS', 'CALVES',
  'CHEST', 'SHOULDERS', 'TRICEPS',
  'LATS', 'BICEPS', 'REAR_DELTS', 'FOREARMS',
  'CORE'
];

export const PATTERN_ORDER = ['SQUAT', 'HINGE', 'PUSH', 'PULL', 'CORE', 'ACCESSORY'];