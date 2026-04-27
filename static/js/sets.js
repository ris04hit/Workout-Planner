// =========================
// SETS
// =========================

import { state } from './state.js';
import { apiGet } from './api.js';

function _createSetRow(exId, mode, value, weight) {
  const setId = `${exId}-set-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
  const row = document.createElement('div');
  row.id = setId;
  row.className = 'set-row';
  const v = value  || '';
  const w = weight || '';
  if (mode === 'reps') {
    row.innerHTML = `
      <label class="set-field">
        <span class="set-label">Reps</span>
        <input type="number" id="reps-${setId}" name="reps-${setId}" data-type="reps"
          value="${v}" min="1" inputmode="numeric" required>
      </label>
      <label class="set-field">
        <span class="set-label">Weight (kg)</span>
        <input type="number" id="weight-${setId}" name="weight-${setId}" data-type="weight"
          value="${w}" min="0" step="0.5" inputmode="decimal">
      </label>
      <button class="set-del-btn btn-secondary" data-del-set="${setId}" title="Remove set">✕</button>
    `;
  } else {
    row.innerHTML = `
      <label class="set-field">
        <span class="set-label">Time (sec)</span>
        <input type="number" id="time-${setId}" name="time-${setId}" data-type="time"
          value="${v}" min="1" inputmode="numeric" required>
      </label>
      <label class="set-field">
        <span class="set-label">Weight (kg)</span>
        <input type="number" id="weight-${setId}" name="weight-${setId}" data-type="weight"
          value="${w}" min="0" step="0.5" inputmode="decimal">
      </label>
      <button class="set-del-btn btn-secondary" data-del-set="${setId}" title="Remove set">✕</button>
    `;
  }
  return row;
}

function getLastAddedSet(setsDiv, mode) {
  const rows = setsDiv.children;
  if (!rows.length) return null;
  const lastRow = rows[rows.length - 1];
  const weightEl = lastRow.querySelector('[data-type="weight"]');
  const mainEl   = lastRow.querySelector(mode === 'reps' ? '[data-type="reps"]' : '[data-type="time"]');
  const value  = Number(mainEl?.value)  || 0;
  const weight = Number(weightEl?.value) || 0;
  return (value || weight) ? { value, weight } : null;
}

export async function addSet(exId) {
  const mapEntry = Object.values(state.ui.exerciseMap).find(e => e.id === exId);
  const exerciseName = mapEntry?.name ?? null;

  const mode    = document.getElementById(`mode-${exId}`).value;
  const setsDiv = document.getElementById(`sets-${exId}`);

  const last = getLastAddedSet(setsDiv, mode)
            ?? (exerciseName ? await getLastSet(exerciseName) : null);

  setsDiv.appendChild(_createSetRow(exId, mode, last?.value, last?.weight));
}

export async function preFillSetsFromHistory(exId, exerciseName) {
  try {
    const data = await apiGet(`/api/progress/${encodeURIComponent(exerciseName)}`);
    if (!data.last?.sets?.length) return;

    const sets = data.last.sets;
    const isTimeBased = sets.some(s => s.duration_sec !== undefined);
    const mode = isTimeBased ? 'time' : 'reps';

    const modeEl = document.getElementById(`mode-${exId}`);
    if (modeEl) modeEl.value = mode;

    const setsDiv = document.getElementById(`sets-${exId}`);
    if (!setsDiv) return;

    sets.forEach(set => {
      const value  = isTimeBased ? set.duration_sec : set.reps;
      const weight = set.weight || 0;
      setsDiv.appendChild(_createSetRow(exId, mode, value, weight));
    });
  } catch {
    // silently fail — card still usable without history
  }
}

export function collectSets(exId) {
  const setsDiv = document.getElementById(`sets-${exId}`);
  if (!setsDiv) return [];
  const rows = Array.from(setsDiv.children);

  const sets = rows.map(r => {
    const reps = r.querySelector('[data-type="reps"]');
    const time = r.querySelector('[data-type="time"]');
    const weight = r.querySelector('[data-type="weight"]');

    if (reps) {
      const repsValue = Number(reps.value || 0);
      const weightValue = Number(weight?.value || 0);
      
      // Only include sets with valid reps (positive integers)
      if (repsValue > 0) {
        return {
          reps: repsValue,
          weight: weightValue
        };
      }
      return null; // Skip invalid sets
    }
    
    const durationValue = Number(time?.value || 0);
    const weightValue = Number(weight?.value || 0);
    
    // Only include sets with valid duration (positive integers)
    if (durationValue > 0) {
      return {
        duration_sec: durationValue,
        weight: weightValue
      };
    }
    return null; // Skip invalid sets
  });

  // Filter out null entries (invalid sets)
  return sets.filter(set => set !== null);
}

async function getLastSet(exerciseName) {
  try {
    const data = await apiGet(`/api/progress/${encodeURIComponent(exerciseName)}`);
    if (!data.last?.sets?.length) return null;

    const sets = data.last.sets;
    const isTimeBased = sets.some(s => s.duration_sec !== undefined);

    let bestSet;
    if (isTimeBased) {
      // For time-based exercises: pick the set with the longest duration
      bestSet = sets.reduce((best, cur) =>
        (cur.duration_sec || 0) > (best.duration_sec || 0) ? cur : best
      );
    } else {
      // For reps-based exercises: pick the set with the highest volume
      bestSet = sets.reduce((best, cur) => {
        const cv = (cur.reps || 0) * (cur.weight || 0);
        const bv = (best.reps || 0) * (best.weight || 0);
        return cv > bv ? cur : best;
      });
    }

    return {
      weight: bestSet.weight || 0,
      value: bestSet.reps || bestSet.duration_sec || 0
    };
  } catch {
    return null;
  }
}