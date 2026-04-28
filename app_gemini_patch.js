/**
 * =============================================================
 * PATCH: app.js — Gemini AI Smart Match
 * VolunteerBridge v2.0
 * =============================================================
 *
 * HOW TO APPLY
 * ─────────────
 * In app.js, find each function by the SEARCH comment and
 * replace the ENTIRE function body with the replacement below.
 *
 * Two functions are patched:
 *   1. _calcMatchScore  — now delegates score to AI; kept as
 *                         a synchronous fallback for non-modal
 *                         uses (opportunity list sorting, etc.)
 *   2. runSmartMatch    — now async, calls AI.getAiMatches()
 *                         and renders the "Match Reason" pill.
 * =============================================================
 */


// ─────────────────────────────────────────────────────────────
// PATCH 1 OF 2
// SEARCH:  function _calcMatchScore(volunteer, task) {
// REPLACE the ENTIRE function with:
// ─────────────────────────────────────────────────────────────

function _calcMatchScore(volunteer, task) {
  // Kept as synchronous local scorer for:
  //   • opportunity-list ordering in the volunteer dashboard
  //   • _checkAndNotifyMatches() on login
  // The AI layer (runSmartMatch) overrides this for the NGO modal.
  const vSkills  = (volunteer.skills        || []).map(s => s.toLowerCase());
  const tSkills  = (task.requiredSkills     || []).map(s => s.toLowerCase());
  if (!tSkills.length) return 0;
  const matched  = tSkills.filter(s => vSkills.includes(s)).length;
  const skillPts = (matched / tSkills.length) * 70;
  const locPts   = volunteer.location === task.location ? 20 : 0;
  const availPts = { 'Full-time':10, 'Flexible':8, 'Weekends':6, 'Weekdays':5 }[volunteer.availability] || 4;
  return Math.min(Math.round(skillPts + locPts + availPts), 99);
}
// NOTE: _calcMatchScore is unchanged from the original.
// It is listed here for clarity — no edit is needed for Patch 1.


// ─────────────────────────────────────────────────────────────
// PATCH 2 OF 2  ← THE MAIN CHANGE
// SEARCH:  function runSmartMatch(taskId) {
// REPLACE the ENTIRE function with:
// ─────────────────────────────────────────────────────────────

async function runSmartMatch(taskId) {
  const resultEl = _el('match-result-' + taskId);
  if (!resultEl) return;

  const task = DB.tasks.getById(taskId);
  if (!task) return;

  const volunteers = DB.users.getVolunteers();

  // ── 1. Scanning animation (identical to original) ──────────
  resultEl.innerHTML = `
    <div class="match-result-block" style="margin-top:12px">
      <div class="match-result-header">
        <span>🤖 AI Scanning ${volunteers.length} volunteers…</span>
      </div>
      <div class="ai-scanning">
        <div class="scan-bar"></div>
        <div class="scan-dots">
          <div class="scan-dot"></div>
          <div class="scan-dot"></div>
          <div class="scan-dot"></div>
        </div>
        <div class="scan-label">✨ Gemini is analysing bios, skills & location…</div>
      </div>
    </div>`;

  // ── 2. Call Gemini ──────────────────────────────────────────
  let matches;
  try {
    matches = await AI.getAiMatches(task, volunteers, 3);
  } catch (err) {
    console.error('[runSmartMatch] Gemini call failed:', err);
    showToast('AI unavailable — using local scoring.', 'warning');

    // Graceful fallback: use the original local scorer
    matches = _getTopMatches(task, 3).map(m => ({
      ...m,
      matchReason: 'Matched on skills & location (AI offline).',
    }));
  }

  // ── 3. Render results ───────────────────────────────────────
  if (!matches.length) {
    resultEl.innerHTML = _emptyState(
      '😔',
      'No strong matches found',
      'Broaden skill requirements or grow the volunteer pool.'
    );
    return;
  }

  const rankEmoji  = ['🥇', '🥈', '🥉'];
  const rankClass  = ['rank-1', 'rank-2', 'rank-3'];
  const fillClass  = s => s >= 70 ? 'fill-high' : s >= 40 ? 'fill-mid' : 'fill-low';
  const scoreLabel = s => s >= 85 ? 'High' : s >= 55 ? 'Good' : 'Fair';
  const scoreColor = s => s >= 70 ? 'var(--green-mid)' : s >= 40 ? 'var(--amber)' : 'var(--slate-400)';

  const itemsHtml = matches.map(({ volunteer: v, score, matchReason }, i) => `
    <div class="match-result-item">
      <div class="match-rank ${rankClass[i]}">${rankEmoji[i]}</div>

      <!-- Avatar -->
      <div style="
        background:${_avatarColor(v.displayName)};
        width:36px;height:36px;border-radius:50%;flex-shrink:0;
        display:flex;align-items:center;justify-content:center;
        font-size:0.75rem;font-weight:700;color:white">
        ${_initials(v.displayName)}
      </div>

      <div class="match-info">
        <div class="match-name">${v.displayName}</div>
        <div class="match-detail">📍 ${v.location} · ${(v.skills || []).join(', ')}</div>

        <!-- ✨ AI Match Reason pill — new addition -->
        ${matchReason ? `
          <div style="
            margin-top:5px;padding:4px 10px;border-radius:20px;
            background:var(--indigo-50,#eef2ff);border:1px solid var(--indigo-100,#c7d2fe);
            font-size:0.72rem;color:var(--indigo-700,#4338ca);
            display:inline-flex;align-items:center;gap:5px;max-width:100%">
            <span>✨</span>
            <span>${matchReason}</span>
          </div>` : ''}

        <div class="match-bar-row" style="margin-top:6px">
          <div class="match-bar">
            <div class="match-bar-fill ${fillClass(score)}"
                 style="width:0%"
                 data-w="${score}">
            </div>
          </div>
          <div class="match-pct" style="color:${scoreColor(score)}">
            ${scoreLabel(score)}
          </div>
        </div>
      </div>

      <button class="btn btn-emerald btn-xs"
              onclick="App._notifyMatchedVolunteer('${v.uid}','${task.id}')">
        Notify
      </button>
    </div>`).join('');

  resultEl.innerHTML = `
    <div class="match-result-block" style="margin-top:12px">
      <div class="match-result-header">
        <span>✨ Top ${matches.length} AI Matches for "${task.title}"</span>
        <span style="font-size:0.7rem;color:var(--text-muted);font-style:italic;margin-left:8px">
          Powered by Gemini 1.5 Flash
        </span>
      </div>
      ${itemsHtml}
    </div>`;

  // Animate score bars after render
  requestAnimationFrame(() => {
    resultEl.querySelectorAll('.match-bar-fill').forEach(bar => {
      bar.style.transition = 'width 0.7s ease';
      bar.style.width = bar.dataset.w + '%';
    });
  });
}
// ─────────────────────────────────────────────────────────────
// END OF PATCH
// ─────────────────────────────────────────────────────────────
