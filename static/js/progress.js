// =========================
// PROGRESS
// =========================

import { apiGet } from './api.js';

export async function loadProgress(exId, exerciseName) {
  try {
    const data = await apiGet(`/api/progress/${encodeURIComponent(exerciseName)}`);

    // Set mode selector from last history (time-based vs reps-based)
    if (data.last?.sets?.length) {
      const isTimeBased = data.last.sets.some(s => s.duration_sec !== undefined);
      const modeEl = document.getElementById(`mode-${exId}`);
      if (modeEl) modeEl.value = isTimeBased ? 'time' : 'reps';
    }

    const el = document.getElementById(`progress-${exId}`);
    if (!el) return;

    if (!data.last_display && !data.best_display) {
      el.innerHTML = "No history";
      return;
    }

    let html = "";
    if (data.last_display) html += `Last: ${data.last_display}<br>`;
    if (data.best_display) html += `Best: ${data.best_display}<br>`;
    el.innerHTML = html;
  } catch (e) {
  }
}