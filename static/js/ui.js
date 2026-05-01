// =========================
// UI BUILDERS
// =========================

import { state, MUSCLE_ORDER, PATTERN_ORDER } from './state.js';
import { loadProgress } from './progress.js';
import { addSet, preFillSetsFromHistory } from './sets.js';

// ── Shared label maps ────────────────────────────────────────────
const MUSCLE_LABELS = {
  QUADS: 'Quads', GLUTES: 'Glutes', HAMSTRINGS: 'Hamstrings', CALVES: 'Calves',
  CHEST: 'Chest', SHOULDERS: 'Shoulders', TRICEPS: 'Triceps',
  LATS: 'Lats', BICEPS: 'Biceps', REAR_DELTS: 'Rear Delts',
  FOREARMS: 'Forearms', CORE: 'Core'
};

const PATTERN_LABELS = {
  SQUAT: 'Squat', HINGE: 'Hinge / Deadlift', PUSH: 'Push',
  PULL: 'Pull', CORE: 'Core', ACCESSORY: 'Accessory'
};

// ── Shared: coloured muscle chip HTML ──────────────────────────
function muscleChip(key, contribution) {
  const label = MUSCLE_LABELS[key] || key;
  const cls   = contribution >= 0.6 ? 'muscle-chip-primary'
              : contribution >= 0.3 ? 'muscle-chip-secondary'
              : 'muscle-chip-minor';
  const role  = contribution >= 0.6 ? 'Primary'
              : contribution >= 0.3 ? 'Secondary'
              : 'Minor';
  return `<span class="muscle-chip ${cls}" title="${label} · ${role} (weight ${contribution})">${label}</span>`;
}

function muscleChipsHtml(muscles) {
  return Object.entries(muscles || {})
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => muscleChip(k, v))
    .join('');
}

function _descriptionHtml(desc) {
  if (!desc) return '';
  const section = (title, items, tag) => {
    if (!items?.length) return '';
    const inner = items.map(s => `<${tag}>${s}</${tag}>`).join('');
    return `<div class="ex-desc-block">
      <span class="ex-desc-label">${title}</span>
      <${tag === 'li' ? 'ol' : 'ul'} class="ex-desc-list">${inner}</${tag === 'li' ? 'ol' : 'ul'}>
    </div>`;
  };
  return `<details class="ex-desc-section">
    <summary class="ex-desc-toggle">How to do it</summary>
    <div class="ex-desc-body">
      ${section('Steps', desc.steps, 'li')}
      ${section('Breathing', desc.breathing, 'li')}
      ${section('Be careful about', desc.careful_about, 'li')}
    </div>
  </details>`;
}

// ── Suggestion ──────────────────────────────────────────────────

export function renderSuggestion(exercises, groupedByPattern, allScores = [], doneToday = false) {
  const el = document.getElementById('suggestion');
  if (!el) return;

  const meta = document.getElementById('suggestion-meta');

  if (doneToday) {
    el.innerHTML = '<p class="muted-text suggestion-done-note">Workout complete — current scores &amp; fatigue shown below.</p>';
    if (meta) meta.innerHTML = 'Today\'s workout is done.';
    _renderAllScoresSection(el, allScores);
    return;
  }

  if (!exercises || exercises.length === 0) {
    el.innerHTML = '<p class="muted-text">No exercises available. Check soreness or difficulty settings.</p>';
    if (meta) meta.innerHTML = '';
    _renderAllScoresSection(el, allScores);
    return;
  }

  const allPatterns = [
    ...PATTERN_ORDER.filter(p => groupedByPattern[p]?.length),
    ...Object.keys(groupedByPattern).filter(p => !PATTERN_ORDER.includes(p) && groupedByPattern[p]?.length)
  ];

  // Determine score range for colour-coding
  const scoreValues = exercises.map(e => e._score).filter(s => s != null);
  const maxScore  = scoreValues.length ? Math.max(...scoreValues) : 1;
  const minScore  = scoreValues.length ? Math.min(...scoreValues) : 0;
  const scoreRange = maxScore - minScore || 1;

  function _scoreTier(score) {
    if (score == null) return '';
    const pct = (score - minScore) / scoreRange;
    if (pct >= 0.60) return 'score-tier-high';
    // Clamp to mid for suggested exercises — all were selected by the algorithm
    // so the lowest-ranked is still "good", not "bad". Red would be misleading.
    return 'score-tier-mid';
  }

  function _scoreDetailsHtml(ex) {
    const bd = ex._score_breakdown;
    if (!bd) return '';
    const tier = _scoreTier(ex._score);
    const tierLabel = tier === 'score-tier-high' ? 'Best pick' : 'Good';
    const rows = [
      ['Muscle readiness',     bd.readiness],
      ['Weekly boost',         bd.weekly_boost],
      ['Priority bonus',       bd.priority],
      ['Recency penalty',      bd.recency_penalty],
      ['Family recency',       bd.family_recency_penalty],
      ['Soreness penalty',     bd.soreness_penalty],
    ].map(([label, val]) => {
      if (!val) return '';
      const cls = val > 0 ? 'score-row-pos' : 'score-row-neg';
      return `<div class="score-row ${cls}"><span>${label}</span><span>${val > 0 ? '+' : ''}${val}</span></div>`;
    }).join('');
    const capNote = bd.contribution_capped
      ? `<div class="score-row score-row-note" title="Total muscle contribution exceeded max_total_contribution and was scaled down">⚡ Contributions capped</div>`
      : '';
    return `
      <details class="score-details">
        <summary class="score-badge ${tier}" title="${tierLabel}">${ex._score ?? '—'} · ${tierLabel}</summary>
        <div class="score-breakdown">${capNote}${rows}</div>
      </details>`;
  }

  el.innerHTML = allPatterns.map(p => {
    const rows = groupedByPattern[p].map(ex => {
      const diff = ex.difficulty ?? '';
      const diffBadge = diff ? `<span class="diff-badge diff-${diff}" title="Difficulty ${diff}/5">Diff ${diff}</span>` : '';
      return `
      <div class="suggestion-exercise-row">
        <div class="suggestion-exercise-top">
          <span class="suggestion-exercise-name">${ex.name}${diffBadge}</span>
          <div class="suggestion-exercise-actions">
            ${_scoreDetailsHtml(ex)}
            <button class="suggestion-disable-btn" data-disable-exercise="${ex.name}" title="Disable this exercise so it won't be suggested again">Disable</button>
          </div>
        </div>
        <div class="exercise-muscle-tags">${muscleChipsHtml(ex.muscles)}</div>
        ${_descriptionHtml(ex.description)}
      </div>`;
    });
    return `
      <div class="suggestion-pattern-card">
        <div class="suggestion-pattern-label">${PATTERN_LABELS[p] || p}</div>
        ${rows.join('')}
      </div>`;
  }).join('');

  if (meta) meta.innerHTML =
    `${exercises.length} exercise${exercises.length !== 1 ? 's' : ''} selected — based on muscle readiness &amp; weekly balance.`;

  // --- All exercises score table (collapsible) ---
  _renderAllScoresSection(el, allScores);
}

function _renderAllScoresSection(container, allScores) {
  const prev = container.querySelector('.all-scores-section');
  if (prev) prev.remove();
  if (!allScores?.length) return;

  // Group by pattern in PATTERN_ORDER
  const byPattern = {};
  allScores.forEach(ex => {
    const p = ex.pattern || 'ACCESSORY';
    if (!byPattern[p]) byPattern[p] = [];
    byPattern[p].push(ex);
  });

  const orderedPatterns = [
    ...PATTERN_ORDER.filter(p => byPattern[p]?.length),
    ...Object.keys(byPattern).filter(p => !PATTERN_ORDER.includes(p) && byPattern[p]?.length)
  ];

  const SCORE_COMPONENTS = [
    { key: 'readiness',              label: 'Readiness',       title: 'Muscle freshness: weight × (1−fatigue)²' },
    { key: 'weekly_boost',           label: 'Weekly',          title: 'Boost when muscle has not met weekly target' },
    { key: 'priority',               label: 'Priority',        title: 'exercise.priority (1–3) × priority_coeff' },
    { key: 'recency_penalty',        label: 'Recency',         title: 'Penalty for this exact exercise being done recently' },
    { key: 'family_recency_penalty', label: 'Family recency',  title: 'Penalty for a same-family exercise being done recently' },
    { key: 'soreness_penalty',       label: 'Soreness',        title: 'Soft penalty: −contribution × sore_penalty_factor per sore muscle' },
  ];

  const patternBlocks = orderedPatterns.map(p => {
    const rows = byPattern[p].map(ex => {
      const bd = ex._score_breakdown || {};
      const statusMark = ex._selected
        ? '<span class="all-score-selected-mark" title="Selected for today">✓</span>'
        : ex._blocked
          ? '<span class="all-score-blocked-mark" title="Hard-blocked (sore/fatigue/difficulty constraint)">⊘</span>'
          : '';
      const chips = SCORE_COMPONENTS.map(({ key, label, title }) => {
        const v = bd[key] ?? 0;
        if (!v) return `<span class="all-score-chip zero" title="${title}">${label}: —</span>`;
        const cls = v > 0 ? 'pos' : 'neg';
        return `<span class="all-score-chip ${cls}" title="${title}">${label}: ${v > 0 ? '+' : ''}${v}</span>`;
      }).join('');
      const rowCls = ex._selected ? 'all-score-row--selected' : ex._blocked ? 'all-score-row--blocked' : '';
      const d = ex.difficulty ?? '';
      const dBadge = d ? `<span class="diff-badge diff-${d}" title="Difficulty ${d}/5">Diff ${d}</span>` : '';
      return `
        <div class="all-score-row ${rowCls}">
          <div class="all-score-name">${statusMark}${ex.name}${dBadge}</div>
          <div class="all-score-chips">${chips}</div>
          <div class="all-score-total ${ex._blocked ? 'blocked' : ex._score >= 0 ? 'pos' : 'neg'}">
            ${ex._blocked ? '⊘' : (ex._score >= 0 ? '+' : '') + ex._score}
          </div>
        </div>`;
    }).join('');
    return `
      <div class="all-scores-pattern-group">
        <div class="all-scores-pattern-label">${PATTERN_LABELS[p] || p}</div>
        ${rows}
      </div>`;
  }).join('');

  const notSelected = allScores.filter(e => !e._selected && !e._blocked).length;
  const blocked     = allScores.filter(e => e._blocked).length;
  const section = document.createElement('details');
  section.className = 'all-scores-section';
  section.innerHTML = `
    <summary class="all-scores-summary">
      All exercises &amp; scores
      <span class="all-scores-count">${allScores.length} total · ${notSelected} not selected · ${blocked > 0 ? `${blocked} blocked` : ''}</span>
    </summary>
    <div class="all-scores-legend">
      <span class="legend-item selected">✓ selected</span>
      <span class="legend-item blocked">⊘ hard-blocked (sore/fatigue/difficulty)</span>
      <span class="legend-item muted">Penalties only shown when non-zero · Scores sum all trained muscles — compound exercises naturally rank higher than isolations</span>
    </div>
    <div class="all-scores-body">${patternBlocks}</div>
  `;
  container.appendChild(section);
}

// ---- Fatigue display ----

export function renderFatigueDisplay() {
  const container = document.getElementById('fatigue-display');
  if (!container) return;

  const fatigue = state.fatigue || {};
  const muscles = MUSCLE_ORDER.filter(m => fatigue[m] !== undefined);

  if (!muscles.length) {
    container.innerHTML = '<p class="muted-text">No fatigue data yet.</p>';
    return;
  }

  const bars = muscles.map(m => {
    const val = Math.round((fatigue[m] || 0) * 100);
    const cls = val >= 80 ? 'fatigue-high' : val >= 40 ? 'fatigue-mid' : 'fatigue-low';
    const label = MUSCLE_LABELS[m] || m;
    return `
      <div class="fatigue-row">
        <span class="fatigue-label">${label}</span>
        <div class="fatigue-bar-wrap">
          <div class="fatigue-bar ${cls}" style="width:${val}%"></div>
        </div>
        <span class="fatigue-value ${cls}">${val}%</span>
      </div>
    `;
  }).join('');

  container.innerHTML = `<div class="fatigue-grid">${bars}</div>`;
}

// ---- Soreness ----

export function renderSorenessControls() {
  const container = document.getElementById('soreness');
  if (!container) return;

  const muscles = Object.keys(state.soreness || {}).sort();
  container.innerHTML = muscles.map(muscle => {
    const label = MUSCLE_LABELS[muscle] || muscle;
    return `
    <label class="toggle-chip">
      <input
        type="checkbox"
        id="soreness-${muscle}"
        name="soreness-${muscle}"
        data-soreness-group="${muscle}"
        ${state.soreness[muscle] ? 'checked' : ''}
      >
      <span>${label}</span>
    </label>
  `;
  }).join('');
}

// ---- Config panel ----

export function renderConfigPanel() {
  const container = document.getElementById('config-panel');
  if (!container || !state.config) return;

  const cfg = state.config;
  const muscleWeights = cfg.muscle_weights || {};
  const weeklyTargets = cfg.weekly_targets || {};
  const patternLimits = cfg.pattern_limits || {};
  const scoring = cfg.scoring || {};

  const MUSCLE_LABELS = {
    QUADS: 'Quads', GLUTES: 'Glutes', HAMSTRINGS: 'Hamstrings', CALVES: 'Calves',
    CHEST: 'Chest', SHOULDERS: 'Shoulders', TRICEPS: 'Triceps',
    LATS: 'Lats', BICEPS: 'Biceps', REAR_DELTS: 'Rear Delts',
    FOREARMS: 'Forearms', CORE: 'Core'
  };

  const PATTERN_LABELS = {
    SQUAT: 'Squat', HINGE: 'Hinge / Deadlift', PUSH: 'Push',
    PULL: 'Pull', CORE: 'Core', ACCESSORY: 'Accessory'
  };

  const muscleRows = MUSCLE_ORDER.map(m => {
    const w  = muscleWeights[m] ?? '';
    const wt = weeklyTargets[m] || {};
    return `
      <tr>
        <td class="muscle-name-cell">${MUSCLE_LABELS[m] || m}</td>
        <td><input type="number" id="mw-${m}" step="0.1" min="0" max="10"
              data-config-scope="muscle_weights" data-group="${m}" value="${w}"
              title="How important this muscle's freshness is when scoring exercises"></td>
        <td><input type="number" id="wt-min-${m}" step="1" min="0"
              data-config-scope="weekly_targets" data-target="min" data-group="${m}" value="${wt.min ?? ''}"
              title="Minimum times to train this muscle per week"></td>
        <td><input type="number" id="wt-mid-${m}" step="1" min="0"
              data-config-scope="weekly_targets" data-target="mid" data-group="${m}" value="${wt.mid ?? ''}"
              title="Ideal / target times per week"></td>
        <td><input type="number" id="wt-max-${m}" step="1" min="0"
              data-config-scope="weekly_targets" data-target="max" data-group="${m}" value="${wt.max ?? ''}"
              title="Maximum before this muscle is considered over-trained"></td>
      </tr>
    `;
  }).join('');

  const patternRows = PATTERN_ORDER.map(p => {
    const lim = patternLimits[p] ?? '';
    return `
      <tr>
        <td>${PATTERN_LABELS[p] || p}</td>
        <td><input type="number" id="pl-${p}" step="1" min="0" max="10"
              data-config-scope="pattern_limits" data-group="${p}" value="${lim}"
              title="Max ${PATTERN_LABELS[p] || p} exercises in one session"></td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="config-grid">

      <details class="config-section" open>
        <summary><h3>Workout Generation</h3></summary>
        <div class="config-field">
          <div class="config-field-label">
            <span class="config-field-name">Exercises per Session</span>
            <span class="config-field-desc">How many exercises to suggest each day.</span>
          </div>
          <input type="number" id="target-exercise-count" min="1" max="20"
            data-config-scope="session" data-field="target_exercise_count"
            value="${cfg.target_exercise_count ?? 6}">
        </div>
        <div class="config-field">
          <div class="config-field-label">
            <span class="config-field-name">Max Exercise Difficulty (1–5)</span>
            <span class="config-field-desc">Exercises harder than this are never suggested. Set to 5 to allow all.</span>
          </div>
          <input type="number" id="max-difficulty" min="1" max="5"
            data-config-scope="session" data-field="max_difficulty_allowed"
            value="${cfg.max_difficulty_allowed ?? 5}">
        </div>
      </details>

      <details class="config-section" open>
        <summary><h3>Fatigue &amp; Recovery</h3></summary>
        <div class="config-field">
          <div class="config-field-label">
            <span class="config-field-name">Daily Fatigue Recovery Rate</span>
            <span class="config-field-desc">How much fatigue clears overnight. 0.85 = 15% cleared per day; 1.0 = full reset daily.</span>
          </div>
          <input type="number" id="fatigue-decay" min="0.01" max="1" step="0.01"
            data-config-scope="session" data-field="fatigue_decay"
            value="${cfg.fatigue_decay ?? 0.85}">
        </div>
        <div class="config-field">
          <div class="config-field-label">
            <span class="config-field-name">Fatigue Block Level (0–1)</span>
            <span class="config-field-desc">Exercises are blocked for a muscle when its fatigue exceeds this. 0.9 = only block when nearly maxed out.</span>
          </div>
          <input type="number" id="fatigue-block-level" min="0" max="1" step="0.05"
            data-config-scope="session" data-field="fatigue_block_threshold"
            value="${cfg.fatigue_block_threshold ?? 0.9}">
        </div>
        <div class="config-field">
          <div class="config-field-label">
            <span class="config-field-name">Fatigue Block — Min Muscle Involvement (0–1)</span>
            <span class="config-field-desc">A fatigued muscle only blocks exercises where it contributes ≥ this amount. 0.5 = ignore if muscle is &lt;50% involved.</span>
          </div>
          <input type="number" id="fatigue-block-contrib" min="0" max="1" step="0.05"
            data-config-scope="session" data-field="fatigue_block_contribution"
            value="${cfg.fatigue_block_contribution ?? 0.5}">
        </div>
        <div class="config-field">
          <div class="config-field-label">
            <span class="config-field-name">Same-Session Muscle Cap (0–2)</span>
            <span class="config-field-desc">Max total involvement a single muscle accumulates in one session. Stops stacking too many exercises on the same muscle.</span>
          </div>
          <input type="number" id="muscle-usage-limit" min="0" max="2" step="0.05"
            data-config-scope="session" data-field="muscle_usage_limit"
            value="${cfg.muscle_usage_limit ?? 0.9}">
        </div>
      </details>

      <details class="config-section">
        <summary><h3>Soreness Handling</h3></summary>
        <div class="config-field">
          <div class="config-field-label">
            <span class="config-field-name">Soreness Block — Min Muscle Involvement (0–1)</span>
            <span class="config-field-desc">Exercises are fully skipped for a sore muscle when its involvement ≥ this. 0.6 = block if ≥60% involved. Lower = stricter.</span>
          </div>
          <input type="number" id="sore-block" min="0" max="1" step="0.05"
            data-config-scope="session" data-field="sore_block_threshold"
            value="${cfg.sore_block_threshold ?? 0.6}">
        </div>
        <div class="config-field">
          <div class="config-field-label">
            <span class="config-field-name">Soreness Score Penalty</span>
            <span class="config-field-desc">Score reduction for exercises that lightly involve a sore muscle. Higher = sore muscles avoided more in ranking.</span>
          </div>
          <input type="number" id="sore-penalty" min="0" step="0.1"
            data-config-scope="session" data-field="sore_penalty_factor"
            value="${cfg.sore_penalty_factor ?? 3.0}">
        </div>
      </details>

      <details class="config-section">
        <summary><h3>Scoring Parameters</h3></summary>
        <div class="config-field">
          <div class="config-field-label">
            <span class="config-field-name">Max Contribution Cap</span>
            <span class="config-field-desc">Total muscle contribution capped per exercise before scoring. Prevents compound exercises from dominating by having too many muscles.</span>
          </div>
          <input type="number" id="scoring-max-contribution" min="0.1" max="5" step="0.05"
            data-config-scope="scoring" data-field="max_total_contribution"
            value="${scoring.max_total_contribution ?? 1.3}">
        </div>
        <div class="config-field">
          <div class="config-field-label">
            <span class="config-field-name">Compound Curve Exponent (0–1)</span>
            <span class="config-field-desc">Sublinear scaling for readiness score. Lower = flatter curve, smaller gap between compound and isolation exercises.</span>
          </div>
          <input type="number" id="scoring-exponent" min="0.1" max="1" step="0.01"
            data-config-scope="scoring" data-field="scaling_exponent"
            value="${scoring.scaling_exponent ?? 0.8}">
        </div>
        <div class="config-field">
          <div class="config-field-label">
            <span class="config-field-name">Untrained Muscle Boost</span>
            <span class="config-field-desc">Score bonus added per unit of muscle involvement when a muscle has not been trained at all this week.</span>
          </div>
          <input type="number" id="scoring-boost-untrained" min="0" step="0.05"
            data-config-scope="scoring" data-field="weekly_boost_untrained"
            value="${scoring.weekly_boost_untrained ?? 2.0}">
        </div>
        <div class="config-field">
          <div class="config-field-label">
            <span class="config-field-name">Below-Minimum Boost</span>
            <span class="config-field-desc">Score bonus when a muscle is below its weekly minimum training target.</span>
          </div>
          <input type="number" id="scoring-boost-below-min" min="0" step="0.05"
            data-config-scope="scoring" data-field="weekly_boost_below_min"
            value="${scoring.weekly_boost_below_min ?? 1.25}">
        </div>
        <div class="config-field">
          <div class="config-field-label">
            <span class="config-field-name">Below-Goal Boost</span>
            <span class="config-field-desc">Score bonus when a muscle is below its weekly goal (mid-target) but above the minimum.</span>
          </div>
          <input type="number" id="scoring-boost-below-mid" min="0" step="0.05"
            data-config-scope="scoring" data-field="weekly_boost_below_mid"
            value="${scoring.weekly_boost_below_mid ?? 0.5}">
        </div>
        <div class="config-field">
          <div class="config-field-label">
            <span class="config-field-name">Priority Multiplier</span>
            <span class="config-field-desc">Score points added per exercise priority level (1–3). Higher = priority setting matters more in ranking.</span>
          </div>
          <input type="number" id="scoring-priority-coeff" min="0" step="0.01"
            data-config-scope="scoring" data-field="priority_coeff"
            value="${scoring.priority_coeff ?? 0.2}">
        </div>
        <div class="config-field">
          <div class="config-field-label">
            <span class="config-field-name">Repeat Penalty</span>
            <span class="config-field-desc">Score reduction when this exact exercise was done recently. Prevents repeating the same exercise.</span>
          </div>
          <input type="number" id="scoring-recency-penalty" min="0" step="0.1"
            data-config-scope="scoring" data-field="recency_penalty"
            value="${scoring.recency_penalty ?? 1.5}">
        </div>
        <div class="config-field">
          <div class="config-field-label">
            <span class="config-field-name">Family Repeat Penalty</span>
            <span class="config-field-desc">Score reduction when a different exercise from the same movement family was done recently (e.g. Bench Press penalises Overhead Press). Typically lower than Repeat Penalty.</span>
          </div>
          <input type="number" id="scoring-family-recency-penalty" min="0" step="0.1"
            data-config-scope="scoring" data-field="family_recency_penalty"
            value="${scoring.family_recency_penalty ?? 1.0}">
        </div>
        <div class="config-field">
          <div class="config-field-label">
            <span class="config-field-name">Repeat Penalty Decay (per day)</span>
            <span class="config-field-desc">How fast both repeat penalties fade. 0.75 = 25% less penalty each day. Applies to both exercise and family penalties.</span>
          </div>
          <input type="number" id="scoring-recency-decay" min="0.01" max="1" step="0.01"
            data-config-scope="scoring" data-field="recency_decay"
            value="${scoring.recency_decay ?? 0.75}">
        </div>
        <div class="config-field">
          <div class="config-field-label">
            <span class="config-field-name">Min Score Threshold</span>
            <span class="config-field-desc">Exercises scoring below this are dropped from the suggestion. Fewer than ${scoring.target_exercise_count ?? 4} exercises may be returned. 0 = no threshold (always suggest up to the max).</span>
          </div>
          <input type="number" id="scoring-min-score-threshold" min="0" step="0.1"
            data-config-scope="scoring" data-field="min_score_threshold"
            value="${scoring.min_score_threshold ?? 0}">
        </div>
      </details>

      <details class="config-section">
        <summary><h3>Movement Pattern Limits</h3></summary>
        <p class="config-help">Maximum exercises per movement category in a single session. Prevents e.g. doing 5 push exercises in one day.</p>
        <div class="config-table-wrap">
          <table class="config-table">
            <thead><tr><th>Movement Pattern</th><th>Max per Session</th></tr></thead>
            <tbody>${patternRows}</tbody>
          </table>
        </div>
      </details>

      <details class="config-section config-section-full">
        <summary><h3>Per-Muscle Priority &amp; Weekly Targets</h3></summary>
        <p class="config-help">
          <strong>Priority Weight</strong> — how much this muscle's freshness boosts an exercise's score. Higher = prioritised more when fresh.<br>
          <strong>Weekly Targets</strong> — how many times per week the algorithm tries to train this muscle (Min / Goal / Max).
        </p>
        <div class="config-table-wrap">
          <table class="config-table">
            <thead>
              <tr>
                <th>Muscle</th>
                <th title="Higher = more important when this muscle is fresh">Priority Weight</th>
                <th title="Train at least this many times per week">Weekly Min</th>
                <th title="Ideal weekly training count">Weekly Goal</th>
                <th title="Cap — avoid training more than this per week">Weekly Max</th>
              </tr>
            </thead>
            <tbody>${muscleRows}</tbody>
          </table>
        </div>
      </details>

    </div>
  `;
}

// ---- Config history ----

export function renderConfigHistory() {
  const container = document.getElementById('config-history');
  if (!container) return;

  if (!state.configHistory.length) {
    container.innerHTML = '<p class="muted-text">No config history yet.</p>';
    return;
  }

  container.innerHTML = state.configHistory
    .slice()
    .reverse()
    .map((entry, reverseIndex) => {
      const originalIndex = state.configHistory.length - 1 - reverseIndex;
      const timestamp = _formatTimestamp(entry.timestamp);
      const prev = originalIndex > 0 ? state.configHistory[originalIndex - 1].config : null;
      const summary = _summarizeConfigEntry(entry.config || {}, prev);
      return `
        <details class="config-history-item" ${reverseIndex === 0 ? 'open' : ''}>
          <summary class="config-history-summary">
            <div>
              <strong>${timestamp}</strong>
              ${reverseIndex === 0 ? '<span class="history-badge">Latest</span>' : ''}
              <div class="muted-text">${summary.title}</div>
            </div>
          </summary>
          <div class="config-history-body">
            <ul class="config-history-list">
              ${summary.lines.map(l => `<li>${l}</li>`).join('')}
            </ul>
            <button data-revert-config="${originalIndex}" class="secondary">Revert</button>
          </div>
        </details>
      `;
    })
    .join('');
}

// ---- Exercise management ----

export function renderExerciseManagement() {
  const container = document.getElementById('exercise-management');
  if (!container || !state.muscles) return;

  const exercises = Array.isArray(state.muscles) ? state.muscles : [];

  if (!exercises.length) {
    container.innerHTML = '<p class="muted-text">No exercises loaded.</p>';
    return;
  }

  const grouped = {};
  exercises.forEach((ex, idx) => {
    const p = ex.pattern || 'ACCESSORY';
    if (!grouped[p]) grouped[p] = [];
    grouped[p].push({ ...ex, _idx: idx });
  });

  const sections = [...PATTERN_ORDER, ...Object.keys(grouped).filter(p => !PATTERN_ORDER.includes(p))]
    .filter(p => grouped[p]?.length)
    .map(pattern => {
      const items = grouped[pattern].map(ex => {
        const idx = ex._idx;
        const musclesStr = Object.entries(ex.muscles || {})
          .sort((a, b) => b[1] - a[1])
          .map(([m, c]) => `${m}:${c}`)
          .join(', ');
        const chipsHtml = muscleChipsHtml(ex.muscles);
        const enabledClass = ex.enabled !== false ? '' : ' ex-disabled';
        return `
          <div class="exercise-item${enabledClass}" data-idx="${idx}">
            <div class="exercise-row exercise-main-row">
              <label class="ex-toggle" title="Enable / disable this exercise">
                <input type="checkbox" data-exercise-enable="${idx}" ${ex.enabled !== false ? 'checked' : ''}>
              </label>
              <input type="text" class="ex-name-input" data-exercise-name="${idx}"
                value="${ex.name || ''}" placeholder="Exercise name">
              <div class="ex-num-pair">
                <label title="Difficulty: how hard this exercise is (1 = easy, 5 = very hard). Exercises above the configured max difficulty are never suggested.">
                  <span class="ex-field-label">Diff</span>
                  <input type="number" min="1" max="5" data-exercise-difficulty="${idx}" value="${ex.difficulty || 1}">
                </label>
                <label title="Priority: how often this exercise should be preferred (1 = low, 3 = high).">
                  <span class="ex-field-label">Prio</span>
                  <input type="number" min="1" max="3" data-exercise-priority="${idx}" value="${ex.priority || 2}">
                </label>
              </div>
              <button data-delete-exercise="${idx}" class="ex-delete-btn" title="Remove exercise">✕</button>
            </div>
            <div class="exercise-row exercise-detail-row">
              <label class="ex-detail-field" title="Family groups exercises that share the same movement (e.g. PRESS, ROW, SQUAT). Only one exercise per family is suggested per session.">
                <span class="ex-field-label">Family</span>
                <input type="text" data-exercise-family="${idx}" value="${ex.family || ''}" placeholder="e.g. PRESS">
              </label>
              <label class="ex-detail-field ex-muscles-field" title="Which muscles this exercise trains and how much (0–1). Format: MUSCLE:amount, … e.g. CHEST:0.8, TRICEPS:0.4">
                <span class="ex-field-label">Muscles</span>
                <input type="text" data-exercise-muscles="${idx}" value="${musclesStr}" placeholder="CHEST:0.8, TRICEPS:0.4">
              </label>
            </div>
            ${chipsHtml ? `<div class="exercise-muscle-preview">${chipsHtml}</div>` : ''}
          </div>
        `;
      }).join('');

      return `
        <details class="exercise-group-section" open data-pattern="${pattern}">
          <summary class="exercise-group-header">
            <h3>${PATTERN_LABELS[pattern] || pattern}</h3>
            <button data-add-exercise="${pattern}" class="ex-add-btn">+ Add</button>
          </summary>
          <div class="exercise-list">${items}</div>
        </details>
      `;
    }).join('');

  container.innerHTML = sections;
}

// ---- Workout done banner ----

export function renderWorkoutDoneUI() {
  const container = document.getElementById('workout');
  if (!container) return;

  container.innerHTML = `
    <div class="workout-done-banner">
      <div class="workout-done-icon">✅</div>
      <div class="workout-done-text">
        <strong>Today's workout is complete!</strong>
        <span>Great work. Come back tomorrow.</span>
      </div>
    </div>
    <div class="workout-done-actions">
      <button class="btn-secondary" id="override-workout-btn">
        ⚠️ Override — Log Another Workout Today
      </button>
    </div>
  `;

  document.getElementById('override-workout-btn')?.addEventListener('click', () => {
    state.overrideMode = true;
    renderWorkoutUI();
    const saveBtn = document.querySelector('button[onclick="saveWorkout()"]');
    if (saveBtn) saveBtn.textContent = 'Mark Workout Complete (Override)';
  });
}

// ---- Workout UI ----

export function renderWorkoutUI() {
  const container = document.getElementById('workout');
  if (!container) return;
  container.innerHTML = '';
  state.ui.exerciseMap = {};

  const exercises = state.exercises || [];
  if (!exercises.length) {
    container.innerHTML = '<p class="muted-text">Press "⚡ Generate Workout" to load today\'s exercises.</p>';
    return;
  }

  const grouped = {};
  exercises.forEach(ex => {
    const p = ex.pattern || 'ACCESSORY';
    if (!grouped[p]) grouped[p] = [];
    grouped[p].push(ex);
  });

  const orderedPatterns = [...PATTERN_ORDER, ...Object.keys(grouped).filter(p => !PATTERN_ORDER.includes(p))]
    .filter(p => grouped[p]?.length);

  orderedPatterns.forEach(pattern => {
    const gDiv = document.createElement('details');
    gDiv.className = 'workout-pattern-group';
    gDiv.setAttribute('open', '');
    gDiv.setAttribute('data-pattern', pattern);
    gDiv.innerHTML = `<summary class="workout-pattern-header">${PATTERN_LABELS[pattern] || pattern}</summary>`;

    grouped[pattern].forEach(ex => {
      gDiv.appendChild(_buildExerciseCard(ex));
    });

    container.appendChild(gDiv);
  });

}

function _buildExerciseCard(ex, { openByDefault = false } = {}) {
  const exId = `${ex.name.replace(/\s+/g, '_')}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  state.ui.exerciseMap[ex.name] = {
    id: exId, name: ex.name,
    pattern: ex.pattern || 'ACCESSORY',
    family: ex.family || '',
    muscles: ex.muscles || {}
  };

  // Remove button — stopPropagation so it does not toggle the <details>
  const removeBtn = document.createElement('button');
  removeBtn.className = 'exercise-remove-btn';
  removeBtn.title = 'Remove from this session';
  removeBtn.textContent = '× Remove';
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exDiv.remove();
    delete state.ui.exerciseMap[ex.name];
  });

  // Set count badge — shown when card is collapsed
  const setBadge = document.createElement('span');
  setBadge.className = 'exercise-set-badge';
  setBadge.hidden = true;

  function _refreshBadge() {
    const setsDiv = document.getElementById(`sets-${exId}`);
    const count = setsDiv ? setsDiv.children.length : 0;
    if (count > 0) {
      setBadge.textContent = `${count} set${count !== 1 ? 's' : ''}`;
      setBadge.hidden = false;
    } else {
      setBadge.hidden = true;
    }
  }

  // Summary right: badge + remove
  const summaryRight = document.createElement('div');
  summaryRight.className = 'exercise-summary-right';
  summaryRight.appendChild(setBadge);
  summaryRight.appendChild(removeBtn);

  // Summary left: name + chips
  const chipsHtml = muscleChipsHtml(ex.muscles);
  const summaryLeft = document.createElement('div');
  summaryLeft.className = 'exercise-summary-left';
  summaryLeft.innerHTML = `
    <div class="exercise-title">${ex.name}</div>
    ${chipsHtml ? `<div class="exercise-muscle-tags">${chipsHtml}</div>` : ''}
  `;

  const summary = document.createElement('summary');
  summary.className = 'exercise-summary';
  summary.appendChild(summaryLeft);
  summary.appendChild(summaryRight);

  // Card body: progress + description + mode selector + sets
  const descHtml = _descriptionHtml(ex.description);
  const body = document.createElement('div');
  body.className = 'exercise-body';
  body.innerHTML = `
    <div id="progress-${exId}" class="exercise-progress-note"></div>
    ${descHtml}
    <div class="exercise-mode-row">
      <label style="font-size:13px;font-weight:600;color:var(--text-muted)">Mode:
        <select id="mode-${exId}" style="margin-left:6px">
          <option value="reps">Reps</option>
          <option value="time">Time</option>
        </select>
      </label>
      <button class="btn-secondary" data-add-set="${exId}" style="padding:5px 12px;font-size:12px">+ Add Set</button>
    </div>
    <div id="sets-${exId}" class="sets-container"></div>
  `;

  const exDiv = document.createElement('details');
  exDiv.className = 'exercise';
  exDiv.setAttribute('data-ex-id', exId);
  if (openByDefault) exDiv.setAttribute('open', '');
  exDiv.appendChild(summary);
  exDiv.appendChild(body);

  // Refresh badge whenever the card is collapsed
  exDiv.addEventListener('toggle', () => { if (!exDiv.open) _refreshBadge(); });

  // After prefill resolves, show the badge if sets were pre-filled
  // Skip when editWorkout is loading a specific workout (sets are filled manually there)
  if (!state.ui.skipPrefill) {
    preFillSetsFromHistory(exId, ex.name).then(_refreshBadge);
  }
  loadProgress(exId, ex.name);
  return exDiv;
}

export function initExerciseSearch() {
  const input    = document.getElementById('custom-ex-name');
  const dropdown = document.getElementById('custom-ex-dropdown');
  const addBtn   = document.getElementById('add-custom-ex-btn');
  if (!input || !dropdown) return;

  let focusedIdx = -1;

  function _items() {
    return Array.from(dropdown.querySelectorAll('[role="option"]'));
  }

  function _setFocused(idx) {
    const items = _items();
    items.forEach((el, i) => el.classList.toggle('ex-search-item--focused', i === idx));
    focusedIdx = idx;
  }

  function _showDropdown(query) {
    const q = (query || '').toLowerCase().trim();
    const matches = (state.muscles || [])
      .filter(e => !state.ui.exerciseMap[e.name] && (q === '' || e.name.toLowerCase().includes(q)))
      .slice(0, 10);

    if (!matches.length) { _hideDropdown(); return; }

    dropdown.innerHTML = matches.map(e => {
      const patLabel = PATTERN_LABELS[e.pattern] || e.pattern || '';
      const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const hi = q ? e.name.replace(new RegExp(`(${safeQ})`, 'gi'), '<mark>$1</mark>') : e.name;
      return `<div class="ex-search-item" role="option" data-ex-name="${e.name}">
        <span class="ex-search-item-name">${hi}</span>
        ${patLabel ? `<span class="ex-search-item-tag">${patLabel}</span>` : ''}
      </div>`;
    }).join('');

    focusedIdx = -1;
    dropdown.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function _hideDropdown() {
    dropdown.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    focusedIdx = -1;
  }

  function _select(name) {
    const trimmed = name?.trim();
    if (!trimmed) return;
    input.value = trimmed;
    _hideDropdown();
    input.focus();
  }

  function _commit() {
    const trimmed = input.value?.trim();
    if (!trimmed) return;
    addCustomExerciseToWorkout(trimmed);
    input.value = '';
    _hideDropdown();
    input.focus();
  }

  input.addEventListener('input', () => _showDropdown(input.value));
  input.addEventListener('focus', () => _showDropdown(input.value));

  input.addEventListener('keydown', e => {
    const items = _items();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _setFocused(Math.min(focusedIdx + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _setFocused(Math.max(focusedIdx - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const focused = items[focusedIdx];
      if (focused) _select(focused.getAttribute('data-ex-name'));
      else _commit();
    } else if (e.key === 'Escape') {
      _hideDropdown();
    }
  });

  dropdown.addEventListener('mousedown', e => {
    const item = e.target.closest('[data-ex-name]');
    if (item) { e.preventDefault(); _select(item.getAttribute('data-ex-name')); }
  });

  dropdown.addEventListener('mousemove', e => {
    const item = e.target.closest('[data-ex-name]');
    if (item) _setFocused(_items().indexOf(item));
  });

  if (addBtn) addBtn.addEventListener('click', () => _commit());

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) _hideDropdown();
  });
}

export function addCustomExerciseToWorkout(name) {
  const trimmed = name?.trim();
  if (!trimmed) return;
  if (state.ui.exerciseMap[trimmed]) return; // already in session

  const libraryEx = (state.muscles || []).find(e => e.name.toLowerCase() === trimmed.toLowerCase());
  const ex = libraryEx
    ? { ...libraryEx, name: libraryEx.name }
    : { name: trimmed, pattern: 'ACCESSORY', family: '', muscles: {} };

  const container = document.getElementById('workout');
  if (!container) return;

  // Remove placeholder text if present
  const placeholder = container.querySelector('.muted-text');
  if (placeholder) placeholder.remove();

  // Find or create the pattern group
  let gDiv = container.querySelector(`.workout-pattern-group[data-pattern="${ex.pattern}"]`);
  if (!gDiv) {
    gDiv = document.createElement('details');
    gDiv.className = 'workout-pattern-group';
    gDiv.setAttribute('open', '');
    gDiv.setAttribute('data-pattern', ex.pattern || 'ACCESSORY');
    gDiv.innerHTML = `<summary class="workout-pattern-header">${PATTERN_LABELS[ex.pattern] || ex.pattern || 'Custom'}</summary>`;
    container.appendChild(gDiv);
  }

  gDiv.appendChild(_buildExerciseCard(ex, { openByDefault: true }));
}

// ---- Helpers ----

function _formatTimestamp(value) {
  try { return new Date(value).toLocaleString(); } catch { return value; }
}

function _summarizeConfigEntry(config, previousConfig) {
  if (!previousConfig) {
    return {
      title: `Initial snapshot: ${config.target_exercise_count ?? '?'} exercises, decay ${config.fatigue_decay ?? '?'}`,
      lines: [
        `Target exercises: ${config.target_exercise_count ?? '?'}`,
        `Fatigue decay: ${config.fatigue_decay ?? '?'}`,
        `Max difficulty: ${config.max_difficulty_allowed ?? '?'}`,
        'This is the first saved config snapshot.'
      ]
    };
  }

  const changedSections = [];
  const lines = [];

  const scalarFields = [
    'target_exercise_count', 'fatigue_decay', 'max_difficulty_allowed',
    'sore_penalty_factor', 'sore_block_threshold', 'fatigue_block_threshold',
    'fatigue_block_contribution', 'muscle_usage_limit'
  ];
  const scalarChanges = scalarFields.filter(f => config[f] !== previousConfig[f]);
  if (scalarChanges.length) {
    changedSections.push('settings');
    scalarChanges.forEach(f => lines.push(`${f}: ${config[f]}`));
  }

  const mwCurrent = config.muscle_weights || {};
  const mwPrev = previousConfig.muscle_weights || {};
  const mwChanges = Object.keys(mwCurrent).filter(m => mwCurrent[m] !== mwPrev[m]);
  if (mwChanges.length) {
    changedSections.push(`${mwChanges.length} muscle weight${mwChanges.length > 1 ? 's' : ''}`);
    lines.push(`Muscle weights: ${mwChanges.map(m => `${m}=${mwCurrent[m]}`).join(', ')}`);
  }

  const plCurrent = config.pattern_limits || {};
  const plPrev = previousConfig.pattern_limits || {};
  const plChanges = Object.keys(plCurrent).filter(p => plCurrent[p] !== plPrev[p]);
  if (plChanges.length) {
    changedSections.push('pattern limits');
    lines.push(`Pattern limits: ${plChanges.map(p => `${p}=${plCurrent[p]}`).join(', ')}`);
  }

  const wtCurrent = config.weekly_targets || {};
  const wtPrev = previousConfig.weekly_targets || {};
  const wtChanges = Object.keys(wtCurrent).filter(m => {
    const c = wtCurrent[m] || {};
    const p = wtPrev[m] || {};
    return c.min !== p.min || c.mid !== p.mid || c.max !== p.max;
  });
  if (wtChanges.length) {
    changedSections.push(`${wtChanges.length} weekly target${wtChanges.length > 1 ? 's' : ''}`);
    lines.push(`Weekly targets: ${wtChanges.map(m => {
      const t = wtCurrent[m] || {};
      return `${m} ${t.min}–${t.mid}–${t.max}`;
    }).join(', ')}`);
  }

  if (!changedSections.length) lines.push('No field-level differences from previous snapshot.');

  return {
    title: changedSections.length ? `Changed: ${changedSections.join(', ')}` : 'No differences from previous snapshot',
    lines
  };
}
