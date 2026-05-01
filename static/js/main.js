// =========================
// ENTRY POINT
// =========================

import { state } from './state.js';
import { renderSorenessControls, renderFatigueDisplay, addCustomExerciseToWorkout, initExerciseSearch } from './ui.js';
import {
  loadConfig,
  loadConfigHistory,
  saveConfigFromUI,
  resetConfigFromUI,
  revertConfigFromHistory,
  loadExerciseManagement,
  saveExercisesFromUI,
  addExerciseToUI,
  deleteExerciseFromUI
} from './config.js';
import {
  loadMuscles,
  loadSoreness,
  saveSoreness,
  loadSuggestion,
  saveWorkout,
  loadHistory,
  editWorkout,
  deleteWorkout
} from './workout.js';
import { addSet } from './sets.js';
import { renderAnalyticsDashboard, exportAnalyticsData } from './analytics-ui.js';
import { showExportImportModal } from './export-import.js';
import './mobile.js';
import './accessibility.js';
import './user-manager.js';

// ---- Event delegation ----

document.addEventListener('click', async (e) => {
  // Use closest() so clicks on child elements of a button are still caught.

  const addSetBtn = e.target.closest('[data-add-set]');
  if (addSetBtn) { addSet(addSetBtn.getAttribute('data-add-set')); return; }

  const delSetBtn = e.target.closest('[data-del-set]');
  if (delSetBtn) { document.getElementById(delSetBtn.getAttribute('data-del-set'))?.remove(); return; }

  const editBtn = e.target.closest('[data-edit]');
  if (editBtn) { editWorkout(editBtn.getAttribute('data-edit')); return; }

  const deleteBtn = e.target.closest('[data-delete]');
  if (deleteBtn) { deleteWorkout(deleteBtn.getAttribute('data-delete')); return; }

  const revertBtn = e.target.closest('[data-revert-config]');
  if (revertBtn) { e.preventDefault(); revertConfigFromHistory(Number(revertBtn.getAttribute('data-revert-config'))); return; }

  const addExerciseBtn = e.target.closest('[data-add-exercise]');
  if (addExerciseBtn) { e.preventDefault(); addExerciseToUI(addExerciseBtn.getAttribute('data-add-exercise')); return; }

  const disableExBtn = e.target.closest('[data-disable-exercise]');
  if (disableExBtn) {
    const name = disableExBtn.getAttribute('data-disable-exercise');
    const ex = state.muscles.find(m => m.name === name);
    if (ex) {
      ex.enabled = false;
      await saveExercisesFromUI(true);
      await loadSuggestion();
    }
    return;
  }

  const deleteExerciseBtn = e.target.closest('[data-delete-exercise]');
  if (deleteExerciseBtn) {
    const idx    = deleteExerciseBtn.getAttribute('data-delete-exercise');
    const nameEl = document.querySelector(`[data-exercise-name="${idx}"]`);
    const name   = nameEl?.value?.trim() || 'this exercise';
    if (!confirm(`Remove "${name}" from the library? This cannot be undone.`)) return;
    deleteExerciseFromUI(null, idx);
    return;
  }
});

document.addEventListener('change', (e) => {
  const sorenessGroup = e.target.getAttribute('data-soreness-group');
  if (sorenessGroup) {
    state.soreness[sorenessGroup] = e.target.checked;
    saveSoreness()
      .then(() => loadSuggestion())
      .catch(() => {
        alert('Failed to update soreness');
        state.soreness[sorenessGroup] = !e.target.checked;
        renderSorenessControls();
      });
    return;
  }

  const enableIdx = e.target.getAttribute('data-exercise-enable');
  if (enableIdx !== null) {
    const item = e.target.closest('.exercise-item');
    if (item) item.classList.toggle('ex-disabled', !e.target.checked);
    saveExercisesFromUI(true).then(() => loadSuggestion());
  }
});

// ---- Init ----

window.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  await loadConfigHistory();
  await loadMuscles();
  await loadExerciseManagement();
  await loadSoreness();
  renderSorenessControls();
  await loadSuggestion();
  renderFatigueDisplay();
  initExerciseSearch();

  document.querySelector('button[onclick="loadSuggestion()"]')
    ?.addEventListener('click', loadSuggestion);

  document.querySelector('button[onclick="saveWorkout()"]')
    ?.addEventListener('click', saveWorkout);

  document.querySelector('button[onclick="saveConfigFromUI()"]')
    ?.addEventListener('click', saveConfigFromUI);

  document.querySelector('button[onclick="resetConfigFromUI()"]')
    ?.addEventListener('click', resetConfigFromUI);

  document.querySelector('button[onclick="saveExercisesFromUI()"]')
    ?.addEventListener('click', saveExercisesFromUI);

  // Load history tab if the container exists on page
  if (document.getElementById('history')) {
    await loadHistory();
  }

  // Load analytics dashboard if the container exists on page
  if (document.getElementById('analytics-dashboard')) {
    await renderAnalyticsDashboard('30days');
  }
});

// ---- Global Functions for HTML onclick handlers ----

window.exportAnalyticsData = exportAnalyticsData;
window.updateAnalyticsTimeframe = renderAnalyticsDashboard;
window.loadHistory = loadHistory;
window.saveWorkout = saveWorkout;
window.editWorkout = editWorkout;
window.deleteWorkout = deleteWorkout;
window.saveSoreness = saveSoreness;
window.loadSuggestion = loadSuggestion;
window.loadMuscles = loadMuscles;
window.addSet = addSet;
window.showExportImportModal = showExportImportModal;