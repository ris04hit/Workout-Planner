// =========================
// WORKOUT
// =========================

import { state, isSaving, setIsSaving } from './state.js';
import { apiGet, apiPost } from './api.js';
import { renderSuggestion, renderWorkoutUI, renderWorkoutDoneUI, renderFatigueDisplay } from './ui.js';
import { addSet, collectSets } from './sets.js';

export let editingWorkoutId = null;

// ---- Soreness ----

export async function loadSoreness() {
  const currentUser = localStorage.getItem('workout_current_user');
  const url = currentUser ? `/api/soreness?user=${encodeURIComponent(currentUser)}` : '/api/soreness';
  state.soreness = await apiGet(url);
}

export async function saveSoreness() {
  const response = await apiPost('/api/soreness', state.soreness);
  state.soreness = response.soreness || state.soreness;
}

// ---- Muscles (exercise list) ----

export async function loadMuscles() {
  const currentUser = localStorage.getItem('workout_current_user');
  const url = currentUser ? `/api/exercises?user=${encodeURIComponent(currentUser)}` : '/api/exercises';
  state.muscles = await apiGet(url);
  renderWorkoutUI();
}

// ---- Suggestion ----

export async function loadSuggestion() {
  const currentUser = localStorage.getItem('workout_current_user');
  const url = currentUser ? `/api/suggest?user=${encodeURIComponent(currentUser)}` : '/api/suggest';
  const data = await apiGet(url);
  state.exercises = data.exercises || [];
  state.fatigue = data.fatigue || {};
  state.weeklyLoad = data.weekly_load || {};
  state.allScores = data.all_scores || [];
  const doneToday = data.already_done_today && !state.overrideMode;
  renderSuggestion(state.exercises, data.grouped_by_pattern || {}, state.allScores, doneToday);
  renderFatigueDisplay();

  if (doneToday) {
    renderWorkoutDoneUI();
  } else {
    renderWorkoutUI();
  }
}

// ---- Save ----

export async function saveWorkout() {
  if (isSaving) return;
  setIsSaving(true);

  const saveBtn = document.querySelector('button[onclick="saveWorkout()"]');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerText = 'Saving...';
  }

  try {
    const exercises = [];

    for (const entry of Object.values(state.ui.exerciseMap)) {
      const mode = document.getElementById(`mode-${entry.id}`)?.value || 'reps';
      const sets = collectSets(entry.id);
      exercises.push({ name: entry.name, mode, sets });
    }

    let res;
    if (editingWorkoutId) {
      const r = await fetch(`/api/workout/${editingWorkoutId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercises })
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update workout');
      }
      res = await r.json();
    } else {
      try {
        res = await apiPost('/api/workout', { exercises, force: state.overrideMode || undefined });
      } catch (error) {
        alert(`Error saving workout: ${error.message || 'Unknown error'}`);
        return;
      }
    }

    if (res && res.status === 'duplicate') {
      alert('Workout already saved for today');
      return;
    }

    state.overrideMode = false;
    await loadSuggestion();
  } catch (e) {
    if (e.status === 409 && e.payload?.status === 'already_done') {
      alert('Workout already logged for today. Use the Override button to log another.');
      state.overrideMode = false;
      await loadSuggestion();
    } else {
      alert(e.message || 'Failed to save workout');
    }
  } finally {
    setIsSaving(false);
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerText = 'Mark Workout Complete';
    }
  }
}

// ---- History ----

export async function loadHistory() {
  const currentUser = localStorage.getItem('workout_current_user');
  const url = currentUser ? `/api/history?user=${encodeURIComponent(currentUser)}` : '/api/history';
  const history = await apiGet(url);
  const container = document.getElementById('history');
  container.innerHTML = '';

  if (!history.length) {
    container.innerHTML = '<p>No workouts yet</p>';
    return;
  }

  history.slice().reverse().forEach((w, i) => {
    const enriched = (w.exercises || []).map(ex => {
      const lib = (state.muscles || []).find(m => m.name === ex.name);
      return lib ? { ...lib, ...ex } : ex;
    });
    const exCount  = enriched.length;
    const setCount = enriched.reduce((n, ex) => n + (ex.sets || []).length, 0);
    const meta = `${exCount} exercise${exCount !== 1 ? 's' : ''}` +
                 (setCount ? ` · ${setCount} set${setCount !== 1 ? 's' : ''}` : '');

    const summary = document.createElement('summary');
    summary.className = 'history-summary';
    summary.innerHTML = `
      <span class="history-date">${w.date}</span>
      <span class="history-meta">${meta}</span>
    `;

    const body = document.createElement('div');
    body.className = 'history-body';

    const actions = document.createElement('div');
    actions.className = 'history-actions';
    actions.innerHTML = `
      <button data-edit="${w.id || w.date}">Edit</button>
      <button data-delete="${w.id || w.date}" class="danger">Delete</button>
    `;
    body.appendChild(actions);

    enriched.forEach(ex => {
      const setsHtml = (ex.sets || []).map(s =>
        s.reps !== undefined
          ? `<div class="history-set">${s.reps} reps @ ${s.weight ?? 0} kg</div>`
          : `<div class="history-set">${s.duration_sec}s @ ${s.weight ?? 0} kg</div>`
      ).join('');
      const exDiv = document.createElement('div');
      exDiv.className = 'history-exercise';
      exDiv.innerHTML = `
        <div class="history-exercise-header">
          <b class="history-exercise-name">${ex.name}</b>
          ${ex.pattern ? `<span class="group-role-label">${ex.pattern}</span>` : ''}
        </div>
        ${setsHtml}
      `;
      body.appendChild(exDiv);
    });

    const item = document.createElement('details');
    item.className = 'history-item';
    if (i === 0) item.setAttribute('open', '');
    item.appendChild(summary);
    item.appendChild(body);
    container.appendChild(item);
  });
}

export async function editWorkout(id) {
  const currentUser = localStorage.getItem('workout_current_user');
  const url = currentUser ? `/api/history?user=${encodeURIComponent(currentUser)}` : '/api/history';
  const history = await apiGet(url);
  const workout = history.find(w => w.id === id || w.date === id);
  if (!workout) return;

  editingWorkoutId = id;
  // Merge library data (description, etc.) into history exercises so instructions are visible
  state.exercises = (workout.exercises || []).map(ex => {
    const libEx = (state.muscles || []).find(m => m.name === ex.name);
    return libEx ? { ...libEx, ...ex } : ex;
  });

  state.ui.skipPrefill = true;
  renderSuggestion(state.exercises, {});
  renderWorkoutUI();
  state.ui.skipPrefill = false;

  // Open the Log Workout card and scroll to it so the user sees the edit
  const logCard = document.getElementById('workout')?.closest('details');
  if (logCard) logCard.open = true;
  document.getElementById('workout')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  setTimeout(async () => {
    for (const ex of workout.exercises) {
      const entry = state.ui.exerciseMap[ex.name];
      if (!entry) continue;

      const setsDiv = document.getElementById(`sets-${entry.id}`);
      if (!setsDiv) continue;

      const isTimeBased = (ex.sets || []).some(s => s.duration_sec !== undefined);
      const modeEl = document.getElementById(`mode-${entry.id}`);
      if (modeEl) modeEl.value = isTimeBased ? 'time' : 'reps';

      for (let i = 0; i < (ex.sets || []).length; i++) {
        const s = ex.sets[i];
        await addSet(entry.id);
        await new Promise(resolve => setTimeout(resolve, 30));
        const rows = setsDiv.children;
        const lastRow = rows[rows.length - 1];
        if (!lastRow) continue;
        if (s.reps !== undefined) {
          const el = lastRow.querySelector('[data-type="reps"]');
          if (el) el.value = s.reps;
        } else {
          const el = lastRow.querySelector('[data-type="time"]');
          if (el) el.value = s.duration_sec;
        }
        const wEl = lastRow.querySelector('[data-type="weight"]');
        if (wEl) wEl.value = s.weight ?? '';
      }
    }

    // Open all exercise cards so the pre-filled sets are visible when editing
    document.querySelectorAll('#workout details.exercise').forEach(d => { d.open = true; });
  }, 50);
}

export async function deleteWorkout(id) {
  if (!confirm('Are you sure you want to delete this workout?')) return;
  try {
    const res = await fetch(`/api/workout/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    alert('Workout deleted');
    loadHistory();
  } catch {
    alert('Failed to delete workout');
  }
}
