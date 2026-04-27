// =========================
// CONFIG ACTIONS
// =========================

import { state, MUSCLE_ORDER, PATTERN_ORDER } from './state.js';
import { apiGet, apiPost } from './api.js';
import { renderConfigPanel, renderConfigHistory, renderExerciseManagement } from './ui.js';
import { loadSuggestion } from './workout.js';

export async function loadConfig() {
  state.config = await apiGet('/api/config');
  renderConfigPanel();
}

export async function loadConfigHistory() {
  state.configHistory = await apiGet('/api/config/history');
  renderConfigHistory();
}

function getNum(selector, fallback = 0) {
  const el = document.querySelector(selector);
  if (!el) return fallback;
  const v = Number(el.value);
  return Number.isFinite(v) ? v : fallback;
}

function getScoringNum(field, fallback) {
  return getNum(`[data-config-scope="scoring"][data-field="${field}"]`, fallback);
}

export function buildConfigPayloadFromUI() {
  const config = {
    target_exercise_count:      Math.round(getNum('[data-config-scope="session"][data-field="target_exercise_count"]', 6)),
    max_difficulty_allowed:     Math.round(getNum('[data-config-scope="session"][data-field="max_difficulty_allowed"]', 5)),
    fatigue_decay:              getNum('[data-config-scope="session"][data-field="fatigue_decay"]', 0.85),
    sore_penalty_factor:        getNum('[data-config-scope="session"][data-field="sore_penalty_factor"]', 3.0),
    sore_block_threshold:       getNum('[data-config-scope="session"][data-field="sore_block_threshold"]', 0.6),
    fatigue_block_threshold:    getNum('[data-config-scope="session"][data-field="fatigue_block_threshold"]', 0.9),
    fatigue_block_contribution: getNum('[data-config-scope="session"][data-field="fatigue_block_contribution"]', 0.5),
    muscle_usage_limit:         getNum('[data-config-scope="session"][data-field="muscle_usage_limit"]', 0.9),
    scoring: {
      max_total_contribution:    getScoringNum('max_total_contribution', 1.3),
      scaling_exponent:          getScoringNum('scaling_exponent', 0.8),
      weekly_boost_untrained:    getScoringNum('weekly_boost_untrained', 2.0),
      weekly_boost_below_min:    getScoringNum('weekly_boost_below_min', 1.25),
      weekly_boost_below_mid:    getScoringNum('weekly_boost_below_mid', 0.5),
      priority_coeff:            getScoringNum('priority_coeff', 0.2),
      recency_penalty:           getScoringNum('recency_penalty', 1.5),
      recency_history_sessions:  Math.round(getScoringNum('recency_history_sessions', 2)),
    },
    muscle_weights:  {},
    pattern_limits:  {},
    weekly_targets:  {}
  };

  MUSCLE_ORDER.forEach(m => {
    config.muscle_weights[m] = getNum(`[data-config-scope="muscle_weights"][data-group="${m}"]`, 0);
    config.weekly_targets[m] = {
      min: getNum(`[data-config-scope="weekly_targets"][data-target="min"][data-group="${m}"]`, 0),
      mid: getNum(`[data-config-scope="weekly_targets"][data-target="mid"][data-group="${m}"]`, 0),
      max: getNum(`[data-config-scope="weekly_targets"][data-target="max"][data-group="${m}"]`, 0)
    };
  });

  PATTERN_ORDER.forEach(p => {
    config.pattern_limits[p] = Math.round(getNum(`[data-config-scope="pattern_limits"][data-group="${p}"]`, 0));
  });

  return config;
}

export async function saveConfigFromUI() {
  try {
    const payload = buildConfigPayloadFromUI();
    const response = await apiPost('/api/config', payload);
    state.config = response.config;
    renderConfigPanel();
    await loadConfigHistory();
    await loadSuggestion();
    alert('Config saved');
  } catch (e) {
    alert(e.message || 'Failed to save config');
  }
}

export async function resetConfigFromUI() {
  if (!confirm('Reset config to defaults?')) return;
  try {
    const response = await apiPost('/api/config/reset', {});
    state.config = response.config;
    renderConfigPanel();
    await loadConfigHistory();
    await loadSuggestion();
    alert('Config reset');
  } catch (e) {
    alert(e.message || 'Failed to reset config');
  }
}

export async function revertConfigFromHistory(index) {
  try {
    const response = await apiPost('/api/config/revert', { index });
    state.config = response.config;
    renderConfigPanel();
    await loadConfigHistory();
    await loadSuggestion();
    alert('Config reverted');
  } catch (e) {
    alert(e.message || 'Failed to revert config');
  }
}

export async function loadExerciseManagement() {
  state.muscles = await apiGet('/api/exercises');
  renderExerciseManagement();
}

export function buildExercisesPayloadFromUI() {
  const exercises = [];
  const items = document.querySelectorAll('[data-idx]');

  items.forEach(item => {
    const idx = item.getAttribute('data-idx');
    const nameEl    = document.querySelector(`[data-exercise-name="${idx}"]`);
    const enableEl  = document.querySelector(`[data-exercise-enable="${idx}"]`);
    const diffEl    = document.querySelector(`[data-exercise-difficulty="${idx}"]`);
    const prioEl    = document.querySelector(`[data-exercise-priority="${idx}"]`);
    const familyEl  = document.querySelector(`[data-exercise-family="${idx}"]`);
    const musclesEl = document.querySelector(`[data-exercise-muscles="${idx}"]`);

    if (!nameEl || !nameEl.value.trim()) return;

    const muscles = {};
    (musclesEl?.value || '').split(',').forEach(part => {
      const [m, c] = part.trim().split(':');
      if (m && c) muscles[m.trim().toUpperCase()] = Number(c.trim());
    });

    // Read pattern from data-pattern attribute set by renderExerciseManagement
    const section = item.closest('.exercise-group-section');
    const pattern = (section?.getAttribute('data-pattern') || 'ACCESSORY').toUpperCase();

    exercises.push({
      name:       nameEl.value.trim(),
      enabled:    enableEl ? enableEl.checked : true,
      difficulty: diffEl   ? Math.min(5, Math.max(1, Math.round(Number(diffEl.value)))) : 1,
      priority:   prioEl   ? Math.min(3, Math.max(1, Math.round(Number(prioEl.value)))) : 2,
      pattern,
      family:     familyEl ? familyEl.value.trim().toUpperCase() : '',
      muscles
    });
  });

  return exercises;
}

export async function saveExercisesFromUI(silent = false) {
  try {
    const payload = buildExercisesPayloadFromUI();
    await fetch('/api/exercises', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    state.muscles = payload;
    if (!silent) renderExerciseManagement();
    if (!silent) alert('Exercises saved');
  } catch (e) {
    alert(e.message || 'Failed to save exercises');
  }
}

export function addExerciseToUI(pattern) {
  const section = [...document.querySelectorAll('.exercise-group-section')]
    .find(s => s.getAttribute('data-pattern') === pattern);
  if (!section) return;

  const list = section.querySelector('.exercise-list');
  if (!list) return;

  const idx = document.querySelectorAll('[data-idx]').length;
  const div = document.createElement('div');
  div.className = 'exercise-item';
  div.setAttribute('data-idx', idx);
  div.innerHTML = `
    <div class="exercise-row exercise-main-row">
      <label class="ex-toggle" title="Enable / disable this exercise">
        <input type="checkbox" data-exercise-enable="${idx}" checked>
      </label>
      <input type="text" class="ex-name-input" data-exercise-name="${idx}" value="" placeholder="Exercise name">
      <div class="ex-num-pair">
        <label title="Difficulty (1=easy, 5=hard)">
          <span class="ex-field-label">Diff</span>
          <input type="number" min="1" max="5" data-exercise-difficulty="${idx}" value="1">
        </label>
        <label title="Priority (1=rarely, 5=always prefer)">
          <span class="ex-field-label">Prio</span>
          <input type="number" min="1" max="5" data-exercise-priority="${idx}" value="3">
        </label>
      </div>
      <button data-delete-exercise="${idx}" class="ex-delete-btn" title="Remove exercise">✕</button>
    </div>
    <div class="exercise-row exercise-detail-row">
      <label class="ex-detail-field" title="Family groups exercises sharing the same movement. Only one per family per session.">
        <span class="ex-field-label">Family</span>
        <input type="text" data-exercise-family="${idx}" value="" placeholder="e.g. PRESS">
      </label>
      <label class="ex-detail-field ex-muscles-field" title="Format: MUSCLE:amount, … e.g. CHEST:0.8, TRICEPS:0.4">
        <span class="ex-field-label">Muscles</span>
        <input type="text" data-exercise-muscles="${idx}" value="" placeholder="CHEST:0.8, TRICEPS:0.4">
      </label>
    </div>
  `;
  list.appendChild(div);
}

export function deleteExerciseFromUI(group, idx) {
  const item = document.querySelector(`[data-idx="${idx}"]`);
  if (item) item.remove();
}
