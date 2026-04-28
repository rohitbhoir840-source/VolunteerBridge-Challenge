/**
 * ================================================================
 * app_patch.js — Surgical App Patch
 * VolunteerBridge v2.1
 * ================================================================
 *
 * HOW TO APPLY:
 *   1. Add  <script src="app_patch.js"></script>  AFTER app.js
 *      in index.html.
 *   2. This file overrides/extends window.App via Object.assign.
 *   3. All functions here are self-contained and use localStorage.
 *
 * ================================================================
 */

'use strict';

(function AppPatch() {

  // ── Shared helpers (may already exist in App, redefined safely) ─
  const _el  = id => document.getElementById(id);
  const _set = (id, html) => { const e = _el(id); if (e) e.innerHTML = html; };

  function _avatarColor(name) {
    const COLORS = ['#1d4ed8','#15803d','#7c3aed','#dc2626','#d97706','#0891b2','#db2778','#65a30d'];
    return COLORS[(name || '').charCodeAt(0) % COLORS.length];
  }
  function _initials(name) {
    return (name || '??').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }
  function _timeAgo(iso) {
    const d = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (d < 60) return 'just now';
    if (d < 3600) return `${Math.floor(d/60)}m ago`;
    if (d < 86400) return `${Math.floor(d/3600)}h ago`;
    return `${Math.floor(d/86400)}d ago`;
  }
  function _rupee(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }
  function _emptyState(icon, title, desc) {
    return `<div class="card"><div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <div class="empty-title">${title}</div>
      <div class="empty-desc">${desc}</div>
    </div></div>`;
  }
  function showToast(msg, type = 'info') {
    if (window.App?.showToast) { window.App.showToast(msg, type); return; }
    console.info(msg);
  }

  /* ============================================================
     1. GENERAL USER ROLE — Auth extensions
     ============================================================ */

  /** Called from the signup panel when 'General' tab is chosen */
  function setSignupRoleGeneral() {
    _el('signup-vol-fields')?.classList.add('hidden');
    _el('signup-ngo-fields')?.classList.add('hidden');
    _el('signup-gen-fields')?.classList.remove('hidden');
    _el('srole-vol')?.classList.remove('active');
    _el('srole-ngo')?.classList.remove('active');
    _el('srole-gen')?.classList.add('active');
    if (window.App) window.App._signupRoleOverride = 'general';
  }

  /** Registers a new General user (reporter / public) */
  function handleGeneralSignup() {
    const name  = (_el('su-gen-name')?.value || '').trim();
    const email = (_el('su-gen-email')?.value || '').trim().toLowerCase();
    const phone = (_el('su-gen-phone')?.value || '').trim();
    const loc   = _el('su-gen-location')?.value || '';
    const pw    = _el('su-gen-pw')?.value || '';
    const pw2   = _el('su-gen-pw2')?.value || '';
    const errEl = _el('signup-gen-error');

    if (!name)  { _showErr(errEl, 'Full name is required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { _showErr(errEl, 'Valid email is required.'); return; }
    if (pw.length < 6) { _showErr(errEl, 'Password must be at least 6 characters.'); return; }
    if (pw !== pw2)    { _showErr(errEl, 'Passwords do not match.'); return; }
    if (DB.users.getByEmail(email)) { _showErr(errEl, 'Email already registered.'); return; }

    const uid = DB.users.registerGeneral({
      name, email,
      passwordHash: DB.users.hashPassword(pw),
      location: loc,
      phone,
    });

    const user = DB.users.getById(uid);
    sessionStorage.setItem('vb2_session', JSON.stringify(user));

    if (window.App) { window.App._updateNavbar(); }
    showToast(`Welcome, ${name}! You can now report incidents.`, 'success');
    showIncidentsPage();
  }

  function _showErr(el, msg) {
    if (!el) return;
    el.textContent = '⚠️ ' + msg;
    el.classList.remove('hidden');
  }

  /* ============================================================
     2. REPORT INCIDENT — Floating Button + Modal
     ============================================================ */

  function openReportModal() {
    if (!Auth.isAuthenticated()) {
      showToast('Please sign in to report an incident.', 'warning');
      window.App?.showPage('auth');
      return;
    }
    // Reset form
    ['ri-type','ri-location','ri-desc','ri-fatalities','ri-injuries'].forEach(id => {
      const e = _el(id); if (e) e.value = '';
    });
    _el('ri-crit-low')  && (_el('ri-crit-low').checked  = true);
    const errEl = _el('ri-error');
    if (errEl) { errEl.classList.add('hidden'); errEl.textContent = ''; }
    if (window.App) window.App.openModal('modal-report-incident');
  }

  function submitIncidentReport() {
    const type        = (_el('ri-type')?.value || '').trim();
    const location    = (_el('ri-location')?.value || '').trim();
    const description = (_el('ri-desc')?.value || '').trim();
    const fatalities  = parseInt(_el('ri-fatalities')?.value || '0');
    const injuries    = parseInt(_el('ri-injuries')?.value  || '0');
    const criticality = document.querySelector('input[name="ri-crit"]:checked')?.value || 'Low';
    const errEl = _el('ri-error');

    if (!type)     { _showErr(errEl, 'Incident type is required.'); return; }
    if (!location) { _showErr(errEl, 'Location is required.'); return; }
    if (!description) { _showErr(errEl, 'Please provide a description.'); return; }

    const user = Auth.getCurrentUser();
    DB.incidents.create({
      type, location, description,
      fatalities: isNaN(fatalities) ? 0 : fatalities,
      injuries:   isNaN(injuries)   ? 0 : injuries,
      criticality,
      reporterId:   user.uid,
      reporterName: user.displayName,
      reporterRole: user.role,
    });

    // Notify all NGOs and volunteers
    [...DB.users.getVolunteers(), ...DB.users.getNGOs()].forEach(u => {
      if (u.uid !== user.uid) {
        DB.notifications.create({
          userId: u.uid,
          message: `🚨 ${criticality === 'High' ? 'CRITICAL' : 'New'} Incident reported in ${location}: "${type}" — check the Incidents board.`,
          type: 'alert', icon: criticality === 'High' ? '🔴' : '🟡',
        });
      }
    });

    if (window.App) {
      window.App.closeModal('modal-report-incident');
      window.App._updateNotifBadge?.();
    }
    showToast('Incident reported! Volunteers and NGOs have been alerted.', 'success');
    renderIncidentsPage();
  }

  /* ============================================================
     3. INCIDENTS PAGE — public board
     ============================================================ */

  function showIncidentsPage() {
    if (window.App) window.App.showPage('incidents');
    renderIncidentsPage();
  }

  function renderIncidentsPage() {
    const el = _el('page-incidents');
    if (!el) return;

    const user      = Auth.getCurrentUser();
    const incidents = DB.incidents.getAll();

    const critBadge = c => c === 'High'
      ? `<span class="badge badge-red">🔴 High</span>`
      : `<span class="badge badge-amber">🟡 Low</span>`;

    el.innerHTML = `
      <div class="section-wrapper">
        <div class="page-header-row">
          <div>
            <div class="eyebrow dark">🚨 Community Safety</div>
            <h2 class="page-title">Live Incidents Board</h2>
            <p class="page-sub">Real-time incident reports from the community. Respond to help.</p>
          </div>
          <button class="btn btn-danger" onclick="AppPatch.openReportModal()">
            🚨 Report Incident
          </button>
        </div>

        ${incidents.length === 0
          ? _emptyState('🛡️', 'No incidents reported', 'The community is safe. Report an incident if you see one.')
          : incidents.map(inc => {
              const isResponder = (inc.responders || []).some(r => r.uid === user?.uid);
              const timeSince   = _timeAgo(inc.reportedAt);
              return `
              <div class="incident-card criticality-${inc.criticality}">
                <div class="incident-header">
                  <div class="incident-type-wrap">
                    <span class="incident-icon">${inc.criticality === 'High' ? '🔴' : '🟡'}</span>
                    <div>
                      <div class="incident-type">${inc.type}</div>
                      <div class="incident-meta-row">
                        ${critBadge(inc.criticality)}
                        <span class="badge badge-slate">${inc.status}</span>
                        <span class="incident-time">📍 ${inc.location} · ${timeSince}</span>
                      </div>
                    </div>
                  </div>
                  <div class="incident-stats">
                    ${inc.fatalities > 0 ? `<div class="inc-stat inc-stat-red"><div class="inc-stat-val">${inc.fatalities}</div><div class="inc-stat-lbl">Fatalities</div></div>` : ''}
                    ${inc.injuries > 0   ? `<div class="inc-stat inc-stat-amber"><div class="inc-stat-val">${inc.injuries}</div><div class="inc-stat-lbl">Injuries</div></div>` : ''}
                    <div class="inc-stat"><div class="inc-stat-val">${(inc.responders||[]).length}</div><div class="inc-stat-lbl">Responders</div></div>
                  </div>
                </div>

                <div class="incident-desc">${inc.description}</div>

                <div class="incident-footer">
                  <div class="incident-reporter">
                    Reported by <strong>${inc.reporterName}</strong>
                    (${inc.reporterRole === 'general' ? 'Community Member' : inc.reporterRole === 'ngo' ? 'NGO' : 'Volunteer'})
                  </div>
                  <div class="incident-actions">
                    ${(inc.responders||[]).length > 0 ? `
                      <span class="responder-list">
                        ${inc.responders.slice(0,3).map(r=>`
                          <span class="responder-chip" style="background:${_avatarColor(r.name)}" title="${r.name}">
                            ${_initials(r.name)}
                          </span>`).join('')}
                        ${inc.responders.length > 3 ? `<span class="responder-chip-more">+${inc.responders.length-3}</span>` : ''}
                      </span>` : ''}
                    ${user && !isResponder && user.uid !== inc.reporterId ? `
                      <button class="btn btn-primary btn-sm"
                              onclick="AppPatch.respondToIncident('${inc.id}')">
                        🚑 Respond to Incident
                      </button>` : ''}
                    ${isResponder ? `<span class="badge badge-green">✓ You're Responding</span>` : ''}
                  </div>
                </div>
              </div>`;
            }).join('')}
      </div>`;
  }

  function respondToIncident(incidentId) {
    const user = Auth.getCurrentUser();
    if (!user) { showToast('Please sign in to respond.', 'warning'); return; }

    const ok = DB.incidents.addResponder(incidentId, {
      uid: user.uid, name: user.displayName, role: user.role,
    });

    if (!ok) { showToast('You are already listed as a responder.', 'info'); return; }

    const inc = DB.incidents.getById(incidentId);
    // Notify reporter
    DB.notifications.create({
      userId: inc.reporterId,
      message: `${user.displayName} is responding to your incident report: "${inc.type}" in ${inc.location}.`,
      type: 'success', icon: '🚑',
    });

    DB.activityFeed?.push(`${user.displayName} responded to incident: "${inc.type}" in ${inc.location}`, 'critical');
    if (window.App) window.App._updateNotifBadge?.();
    showToast('You are now listed as a responder!', 'success');
    renderIncidentsPage();
  }

  /* ============================================================
     4. NGO ANALYTICS — Completed Tasks + Ex-Volunteers
     ============================================================ */

  function renderNgoAnalyticsPage() {
    if (!Auth.hasRole('ngo')) {
      showToast('Analytics is only available for NGOs.', 'warning');
      window.App?.showPage('landing');
      return;
    }

    const user     = Auth.getCurrentUser();
    const myTasks  = DB.tasks.getAll().filter(t => t.ngoId === user.uid);
    const donTotal = DB.donations.getTotalForNgo(user.uid);
    const bonTotal = Object.values((function() {
      try { return JSON.parse(localStorage.getItem('vb2_database') || '{}').bonuses || {}; } catch { return {}; }
    }())).filter(b => b.fromNgoId === user.uid).reduce((s,b) => s + Number(b.amount||0), 0);
    const allVols  = DB.users.getVolunteers();

    // Build ex-volunteer list (anyone who ever applied to an NGO task)
    const exVolIds = new Set();
    myTasks.forEach(t => (t.applications||[]).forEach(a => exVolIds.add(a.userId)));
    const exVols   = [...exVolIds].map(uid => DB.users.getById(uid)).filter(Boolean);

    const completedTasks = myTasks.filter(t => t.status === 'Complete');
    const openTasks      = myTasks.filter(t => t.status === 'Open');
    const totalHrs       = completedTasks.reduce((s, t) =>
      s + Object.values(t.hoursLogged || {}).reduce((a, h) => a + h, 0), 0);

    const el = _el('page-analytics');
    if (!el) return;

    el.innerHTML = `
      <div class="section-wrapper">
        <div class="page-header-row">
          <div>
            <div class="eyebrow dark">✦ NGO Analytics</div>
            <h2 class="page-title">Impact Dashboard</h2>
            <p class="page-sub">Everything your NGO has accomplished in one view.</p>
          </div>
          <button class="btn btn-ghost" onclick="App.guardPage('ngo-dash','ngo')">← Dashboard</button>
        </div>

        <!-- KPI Grid -->
        <div class="analytics-kpi-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px">
          ${[
            { icon:'📋', label:'Total Tasks', val: myTasks.length,       color:'var(--blue-mid)' },
            { icon:'✅', label:'Completed',   val: completedTasks.length, color:'var(--green-mid)' },
            { icon:'⏱️', label:'Hours Given', val: totalHrs+'h',          color:'var(--purple)' },
            { icon:'💚', label:'Donations',   val: _rupee(donTotal),      color:'var(--amber)' },
          ].map(k => `
            <div class="kpi-card" style="padding:20px">
              <div style="font-size:1.4rem;margin-bottom:8px">${k.icon}</div>
              <div style="font-size:1.6rem;font-weight:800;color:${k.color}">${k.val}</div>
              <div style="font-size:.78rem;color:var(--text-muted)">${k.label}</div>
            </div>`).join('')}
        </div>

        <!-- Completed Tasks Detail -->
        <div class="chart-card" style="margin-bottom:20px">
          <div class="chart-title">✅ Completed Tasks</div>
          ${completedTasks.length === 0
            ? `<p style="color:var(--text-muted);font-size:.85rem">No completed tasks yet.</p>`
            : completedTasks.map(task => {
                const hrs     = Object.values(task.hoursLogged || {}).reduce((s, h) => s + h, 0);
                const approvedApps = (task.applications || []).filter(a => a.status === 'approved');
                return `
                <div class="inc-detail-card">
                  <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
                    <div>
                      <div style="font-weight:700;font-size:.95rem">${task.title}</div>
                      <div style="font-size:.75rem;color:var(--text-muted)">📍 ${task.location} · Completed ${task.completedDate||task.postedDate}</div>
                    </div>
                    <div style="display:flex;gap:8px">
                      <div class="kpi-mini"><span>${hrs}h</span><div>Hours</div></div>
                      <div class="kpi-mini" style="color:var(--amber)"><span>${_rupee(hrs*1850)}</span><div>Value</div></div>
                      <div class="kpi-mini" style="color:var(--green-mid)"><span>${approvedApps.length}</span><div>Volunteers</div></div>
                    </div>
                  </div>
                  ${approvedApps.length ? `
                    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
                      ${approvedApps.map(app => `
                        <div style="display:flex;align-items:center;gap:6px;padding:4px 10px;background:var(--slate-50);border-radius:var(--radius-md);border:1px solid var(--border)">
                          <div style="width:22px;height:22px;border-radius:50%;background:${_avatarColor(app.userName)};display:flex;align-items:center;justify-content:center;font-size:.55rem;font-weight:700;color:white">${_initials(app.userName)}</div>
                          <span style="font-size:.78rem;font-weight:600">${app.userName}</span>
                          <span style="font-size:.7rem;color:var(--text-muted)">${(task.hoursLogged||{})[app.userId]||0}h</span>
                        </div>`).join('')}
                    </div>` : ''}
                </div>`;
              }).join('')}
        </div>

        <!-- Open Tasks -->
        <div class="chart-card" style="margin-bottom:20px">
          <div class="chart-title">📋 Open Tasks (${openTasks.length})</div>
          ${openTasks.length === 0
            ? `<p style="color:var(--text-muted);font-size:.85rem">No open tasks.</p>`
            : openTasks.map(t => `
              <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--slate-100)">
                <div>
                  <div style="font-weight:600;font-size:.88rem">${t.title}</div>
                  <div style="font-size:.75rem;color:var(--text-muted)">📍 ${t.location} · ${(t.applications||[]).length} applied</div>
                </div>
                <span class="badge badge-blue">${t.priority}</span>
              </div>`).join('')}
        </div>

        <!-- Ex-Volunteers Directory -->
        <div class="chart-card">
          <div class="chart-title">👥 Ex-Volunteer Directory (${exVols.length})</div>
          <p style="font-size:.82rem;color:var(--text-3);margin-bottom:14px">Everyone who has ever applied to one of your tasks.</p>
          ${exVols.length === 0
            ? `<p style="color:var(--text-muted);font-size:.85rem">No volunteers yet.</p>`
            : `<div class="vol-grid">
                ${exVols.map(v => {
                  const loggedForUs = myTasks.reduce((s, t) => s + ((t.hoursLogged||{})[v.uid]||0), 0);
                  const color = _avatarColor(v.displayName);
                  const avg   = v.ratings?.length
                    ? (v.ratings.reduce((s,r)=>s+r.score,0)/v.ratings.length).toFixed(1) : null;
                  return `
                  <div class="vol-card">
                    <div class="vol-card-header">
                      <div class="vol-avatar-md" style="background:${color}">${_initials(v.displayName)}</div>
                      <div>
                        <div class="vol-card-name">${v.displayName}</div>
                        <div class="vol-card-loc">📍 ${v.location} · ${v.hours||0}h total · ${loggedForUs}h with us${avg?` · ⭐${avg}`:''}</div>
                      </div>
                    </div>
                    <div class="vol-card-skills">${(v.skills||[]).map(s=>`<span class="badge badge-blue" style="font-size:.7rem">${s}</span>`).join('')}</div>
                    <div style="margin-top:8px;display:flex;gap:6px">
                      <button class="btn btn-ghost btn-xs" onclick="App.openProfileModal('${v.uid}')">👤 Profile</button>
                      <button class="btn btn-ghost btn-xs" onclick="App.openMessageModal('${v.uid}','${v.displayName.replace(/'/g,"\\'")}')">💬 Message</button>
                    </div>
                  </div>`;
                }).join('')}
              </div>`}
        </div>
      </div>`;
  }

  /* ============================================================
     5. SQUAD CHAT — renders inside squad details
     ============================================================ */

  let _activeSquadChatId = null;

  function openSquadChat(squadId) {
    _activeSquadChatId = squadId;
    const squad = DB.squads?.getById(squadId);
    if (!squad) return;
    const titleEl = _el('modal-squad-chat-title');
    if (titleEl) titleEl.textContent = `⚔️ ${squad.name} — Squad Chat`;
    renderSquadChat();
    if (window.App) window.App.openModal('modal-squad-chat');
  }

  function renderSquadChat() {
    const el = _el('squad-chat-thread');
    if (!el || !_activeSquadChatId) return;
    const user = Auth.getCurrentUser();
    const msgs = DB.squads?.getChat(_activeSquadChatId) || [];

    if (!msgs.length) {
      el.innerHTML = `<div class="chat-empty">Start the squad conversation 🛡️</div>`;
      return;
    }
    el.innerHTML = msgs.map(m => {
      const isMine = m.fromId === user?.uid;
      return `
      <div class="chat-bubble-wrap ${isMine ? 'mine' : 'theirs'}">
        ${!isMine ? `<div class="chat-sender-name">${m.fromName}</div>` : ''}
        <div class="chat-bubble ${isMine ? 'bubble-mine' : 'bubble-theirs'}">${m.text}</div>
        <div class="chat-time">${_timeAgo(m.createdAt)}</div>
      </div>`;
    }).join('');
    el.scrollTop = el.scrollHeight;
  }

  function sendSquadChatMessage() {
    const user = Auth.getCurrentUser();
    const inp  = _el('squad-chat-input');
    const text = (inp?.value || '').trim();
    if (!user || !text || !_activeSquadChatId) return;

    DB.squads.sendMessage(_activeSquadChatId, {
      fromId: user.uid, fromName: user.displayName, text,
    });
    if (inp) inp.value = '';
    renderSquadChat();
  }

  /* ============================================================
     6. PATCH showPage to register 'incidents' and 'analytics'
     ============================================================ */

  function _patchShowPage() {
    const origShow = window.App?.showPage;
    if (!origShow) return;

    window.App.showPage = function(pageId) {
      origShow.call(window.App, pageId);

      if (pageId === 'incidents') {
        // The original showPage might not know about this page yet
        document.querySelectorAll('.page').forEach(p => {
          p.classList.add('hidden');
          p.classList.remove('entering');
        });
        const target = _el('page-incidents');
        if (target) {
          target.classList.remove('hidden');
          requestAnimationFrame(() => target.classList.add('entering'));
        }
        renderIncidentsPage();
      }

      if (pageId === 'analytics' && Auth.hasRole('ngo')) {
        renderNgoAnalyticsPage();
      }
    };
  }

  /* ============================================================
     7. PATCH _postLoginRedirect for General role
     ============================================================ */
  function _patchPostLoginRedirect() {
    // Expose an override for the general role nav
    if (window.App) {
      const orig = window.App.handleLogin;
      if (orig) {
        window.App.handleLogin = function() {
          orig.call(window.App);
          // After login, if general user, redirect to incidents
          const user = Auth.getCurrentUser();
          if (user?.role === 'general') {
            window.App.showPage('incidents');
          }
        };
      }
    }
  }

  /* ============================================================
     8. NAV VISIBILITY — show Incidents for everyone, hide
        vol/ngo-specific links for general users
     ============================================================ */
  function _patchNavVisibility() {
    const orig = window.App?._updateNavVisibility;
    // We hook into the event that fires after login
    document.addEventListener('vb-nav-update', () => {
      const user = Auth.getCurrentUser();
      const el = _el('nav-incidents');
      if (el) el.style.display = ''; // always visible

      if (user?.role === 'general') {
        _el('nav-vol-dash') && (_el('nav-vol-dash').style.display = 'none');
        _el('nav-ngo-dash') && (_el('nav-ngo-dash').style.display = 'none');
        _el('nav-create')   && (_el('nav-create').style.display   = 'none');
        _el('nav-analytics')&& (_el('nav-analytics').style.display= 'none');
      }
    });
  }

  /* ============================================================
     9. FLOATING REPORT BUTTON visibility
     ============================================================ */
  function _initReportFab() {
    const fab = _el('report-fab');
    if (!fab) return;
    // Always visible
    fab.style.display = 'flex';
  }

  /* ============================================================
     10. INIT — run once DOM is ready
     ============================================================ */
  function _init() {
    _patchShowPage();
    _patchPostLoginRedirect();
    _patchNavVisibility();
    _initReportFab();

    // Register squad chat cleanup when modal closes
    const chatModal = _el('modal-squad-chat');
    if (chatModal) {
      chatModal.addEventListener('click', e => {
        if (e.target === chatModal) {
          _activeSquadChatId = null;
          if (window.App) window.App.closeModal('modal-squad-chat');
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

  /* ============================================================
     EXPOSE as window.AppPatch
     ============================================================ */
  window.AppPatch = {
    // Incidents
    openReportModal,
    submitIncidentReport,
    showIncidentsPage,
    renderIncidentsPage,
    respondToIncident,
    // General role
    setSignupRoleGeneral,
    handleGeneralSignup,
    // Analytics
    renderNgoAnalyticsPage,
    // Squad chat
    openSquadChat,
    sendSquadChatMessage,
    renderSquadChat,
  };

  console.info('[AppPatch] v2.1 loaded — General role, Incidents, NGO Analytics.');

})();