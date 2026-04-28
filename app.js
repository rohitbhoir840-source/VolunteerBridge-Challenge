/**
 * =============================================================
 * app.js — Core Application Logic
 * VolunteerBridge v2.0
 * =============================================================
 *
 * Depends on: backend.js (window.DB) and auth.js (window.Auth)
 * Exposes:    window.App
 * =============================================================
 */

'use strict';

const App = (() => {

  // ─────────────────────────────────────────────────────────────
  // INTERNAL STATE
  // ─────────────────────────────────────────────────────────────
  const _s = {
    currentPage:      'landing',
    currentVolTab:    'opportunities',
    currentNgoTab:    'tasks',
    volFilter:        'all',
    volSearch:        '',
    signupSkills:     [],
    signupDays:       [],
    taskSkills:       [],
    signupRole:       'volunteer',
    authRole:         'volunteer',
    pendingConfirmCb: null,
    squadSquad:       null,
    activityTimer:    null,
    certData:         null,
    selectedStars:   0,
    inboxContactId:  null,
    moneySavedFilter: 'week',
    moneySavedProjectId: null,
  };

  const AVATAR_COLORS = [
    '#1d4ed8','#15803d','#7c3aed','#dc2626',
    '#d97706','#0891b2','#db2778','#65a30d',
  ];

  const MAP_POSITIONS = {
    Pune:      { x:37, y:55 }, Mumbai:    { x:21, y:43 },
    Delhi:     { x:47, y:17 }, Bangalore: { x:39, y:72 },
    Hyderabad: { x:46, y:60 }, Chennai:   { x:49, y:78 },
    Kolkata:   { x:70, y:34 }, Ahmedabad: { x:27, y:31 },
  };

  // ─────────────────────────────────────────────────────────────
  // DOM / FORMAT HELPERS
  // ─────────────────────────────────────────────────────────────
  function _el(id)            { return document.getElementById(id); }
  function _setHtml(id, html) { const e = _el(id); if (e) e.innerHTML = html; }
  const _set = _setHtml;

  function _initials(name) {
    return (name || '??').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }
  function _avatarColor(name) {
    return AVATAR_COLORS[(name || '').charCodeAt(0) % AVATAR_COLORS.length];
  }
  function _skillEmoji(skill) {
    const m = { Medical:'🏥', Tech:'💻', Logistics:'📦', Teaching:'📚', Counseling:'🧠', Construction:'🔧' };
    return m[skill] || '⭐';
  }
  function _priorityBadge(p) {
    const cls = { Critical:'badge-red', High:'badge-amber', Medium:'badge-blue', Low:'badge-green' };
    return `<span class="badge ${cls[p] || 'badge-slate'}">${p}</span>`;
  }
  function _statusBadge(s) {
    const cls = { Open:'badge-blue', 'In Progress':'badge-amber', Complete:'badge-green' };
    return `<span class="badge ${cls[s] || 'badge-slate'}">${s}</span>`;
  }
  function _ageFromDob(dob) {
    if (!dob) return null;
    return Math.floor((Date.now() - new Date(dob)) / (365.25 * 86400000));
  }
  function _timeAgo(iso) {
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }
  function _fmtNum(n) {
    if (n >= 1e7) return (n/1e7).toFixed(1)+'Cr';
    if (n >= 1e5) return (n/1e5).toFixed(1)+'L';
    if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
    return Math.round(n).toString();
  }
  function _emptyState(icon, title, desc) {
    return `<div class="card"><div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <div class="empty-title">${title}</div>
      <div class="empty-desc">${desc}</div>
    </div></div>`;
  }

  // ─────────────────────────────────────────────────────────────
  // TOAST
  // ─────────────────────────────────────────────────────────────
  function showToast(msg, type = 'info') {
    const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
    const wrap  = _el('toast-container');
    if (!wrap) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
    wrap.appendChild(t);
    setTimeout(() => {
      t.style.transition  = 'all 0.3s ease';
      t.style.opacity     = '0';
      t.style.transform   = 'translateX(24px)';
      setTimeout(() => t.remove(), 320);
    }, 3500);
  }

  // ─────────────────────────────────────────────────────────────
  // CONFIRM DIALOG
  // ─────────────────────────────────────────────────────────────
  function _showConfirmDialog(message, onConfirm, confirmLabel = 'Confirm') {
    _s.pendingConfirmCb = onConfirm;
    _setHtml('modal-confirm-msg', message);
    const btn = _el('modal-confirm-btn');
    if (btn) btn.textContent = confirmLabel;
    openModal('modal-confirm');
  }

  function _executeConfirm() {
    if (typeof _s.pendingConfirmCb === 'function') {
      _s.pendingConfirmCb();
      _s.pendingConfirmCb = null;
    }
    closeModal('modal-confirm');
  }

  // ─────────────────────────────────────────────────────────────
  // MODALS
  // ─────────────────────────────────────────────────────────────
  function openModal(id) {
    const el = _el(id);
    if (el) el.classList.remove('hidden');
  }
  function closeModal(id) {
    const el = _el(id);
    if (el) el.classList.add('hidden');
  }
  function handleModalOverlayClick(event, id) {
    if (event.target === event.currentTarget) closeModal(id);
  }

  // ─────────────────────────────────────────────────────────────
  // PAGE NAVIGATION
  // ─────────────────────────────────────────────────────────────
  function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => {
      p.classList.add('hidden');
      p.classList.remove('entering');
    });
    const target = _el('page-' + pageId);
    if (!target) return;
    target.classList.remove('hidden');
    requestAnimationFrame(() => target.classList.add('entering'));
    _s.currentPage = pageId;

    document.querySelectorAll('.nav-link').forEach(l =>
      l.classList.toggle('active', l.dataset.page === pageId)
    );

    _updateNavVisibility();

    const routeMap = {
      landing:      _renderLanding,
      'vol-dash':   _renderVolDash,
      'ngo-dash':   _renderNgoDash,
      analytics:    _renderAnalytics,
      leaderboard:  _renderLeaderboard,
    };
    if (routeMap[pageId]) routeMap[pageId]();
    if (pageId === 'create-task') _resetCreateTaskForm();
    if (pageId === 'auth')        _clearFormErrors();

    _closeNotifPanel();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function guardPage(pageId, role) {
    if (!Auth.requireAuth()) return;
    if (role && !Auth.hasRole(role)) {
      showToast(`This section requires ${role === 'ngo' ? 'NGO' : 'Volunteer'} access.`, 'warning');
      return;
    }
    showPage(pageId);
  }

  function _updateNavVisibility() {
    const user  = Auth.getCurrentUser();
    const isNgo = user?.role === 'ngo';
    const isVol = user?.role === 'volunteer';
    const set   = (id, show) => { const e = _el(id); if (e) e.style.display = show ? '' : 'none'; };
    set('nav-vol-dash',  !user || isVol);
    set('nav-ngo-dash',  !user || isNgo);
    set('nav-create',    isNgo);
    set('nav-analytics', isNgo);
  }

  // ─────────────────────────────────────────────────────────────
  // NAVBAR / USER AREA
  // ─────────────────────────────────────────────────────────────
  function _updateNavbar() {
    const user = Auth.getCurrentUser();
    const area = _el('nav-user-area');
    if (!area) return;
    if (user) {
      const color = _avatarColor(user.displayName);
      const role  = user.role === 'ngo' ? '🏢' : '🙌';
      area.innerHTML = `
        <div class="user-pill" onclick="App.openProfileModal()" title="View / Edit Profile">
          <div class="user-pill-avatar" style="background:${color}">${_initials(user.displayName)}</div>
          <span>${user.displayName.split(' ')[0]}</span>
          <span style="font-size:0.7rem;color:var(--text-muted)">${role}</span>
        </div>`;
    } else {
      area.innerHTML = `
        <button class="btn btn-ghost btn-sm"   onclick="App.showPage('auth')">Sign In</button>
        <button class="btn btn-primary btn-sm" onclick="App.showPage('auth')">Get Started</button>`;
    }
    _updateNotifBadge();
    _updateNavVisibility();
  }

  // ─────────────────────────────────────────────────────────────
  // NOTIFICATIONS
  // ─────────────────────────────────────────────────────────────
  function _updateNotifBadge() {
    const user  = Auth.getCurrentUser();
    const badge = _el('notif-badge');
    if (!badge) return;
    if (!user) { badge.classList.add('hidden'); return; }
    const count = DB.notifications.getUnreadCount(user.uid);
    badge.textContent = count > 9 ? '9+' : count;
    badge.classList.toggle('hidden', count === 0);
  }

  function toggleNotifPanel() {
    const panel = _el('notif-panel');
    if (!panel) return;
    const isOpen = panel.classList.contains('open');
    if (isOpen) { _closeNotifPanel(); return; }
    panel.classList.add('open');
    _renderNotifPanel();
  }

  function _closeNotifPanel() {
    _el('notif-panel')?.classList.remove('open');
  }

  function _renderNotifPanel() {
    const user  = Auth.getCurrentUser();
    const list  = _el('notif-list');
    if (!list) return;
    if (!user) { list.innerHTML = _emptyState('🔔','Sign in to see notifications',''); return; }

    const notifs = DB.notifications.getByUser(user.uid);
    if (notifs.length === 0) {
      list.innerHTML = `<div style="padding:28px;text-align:center;color:var(--text-muted);font-size:0.85rem;">🔔 All caught up!</div>`;
      return;
    }
    const typeColors = { match:'var(--blue-50)', alert:'var(--amber-50)', success:'var(--green-50)', application:'var(--purple-50)' };
    list.innerHTML = notifs.map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}" onclick="App._markNotifRead('${n.id}')">
        <div class="notif-icon" style="background:${typeColors[n.type] || 'var(--slate-100)'}">${n.icon || '🔔'}</div>
        <div class="notif-content">
          <div class="notif-msg">${n.message}</div>
          <div class="notif-time">${_timeAgo(n.createdAt)}</div>
        </div>
        ${!n.read ? '<div class="notif-unread-dot"></div>' : ''}
      </div>`).join('');
  }

  function _markNotifRead(id) {
    DB.notifications.markRead(id);
    _updateNotifBadge();
    _renderNotifPanel();
  }

  function markAllNotifRead() {
    const user = Auth.getCurrentUser();
    if (!user) return;
    DB.notifications.markAllRead(user.uid);
    _updateNotifBadge();
    _renderNotifPanel();
  }

  // ─────────────────────────────────────────────────────────────
  // AUTH — SIGN IN
  // ─────────────────────────────────────────────────────────────
  function setAuthTab(tab) {
    _el('auth-signin-panel')?.classList.toggle('hidden', tab !== 'signin');
    _el('auth-signup-panel')?.classList.toggle('hidden', tab !== 'signup');
    _el('tab-signin')?.classList.toggle('active', tab === 'signin');
    _el('tab-signup')?.classList.toggle('active', tab === 'signup');
    _clearFormErrors();
  }

  function setAuthMode(role) {
    _s.authRole = role;
    selectRole(role);
  }

  function selectRole(role) {
    _s.authRole = role;
    _el('role-volunteer')?.classList.toggle('selected', role === 'volunteer');
    _el('role-ngo')?.classList.toggle('selected', role === 'ngo');
  }

  function setSignupRole(role) {
    _s.signupRole = role;
    _el('signup-vol-fields')?.classList.toggle('hidden', role !== 'volunteer');
    _el('signup-ngo-fields')?.classList.toggle('hidden', role !== 'ngo');
    _el('srole-vol')?.classList.toggle('active', role === 'volunteer');
    _el('srole-ngo')?.classList.toggle('active', role === 'ngo');
    _clearFormErrors();
  }

  function toggleSignupSkill(el) {
    const skill = el.dataset.skill;
    el.classList.toggle('selected');
    if (el.classList.contains('selected')) {
      if (!_s.signupSkills.includes(skill)) _s.signupSkills.push(skill);
    } else {
      _s.signupSkills = _s.signupSkills.filter(s => s !== skill);
    }
  }

  function toggleDayChip(el) {
    const day = el.dataset.day;
    el.classList.toggle('selected');
    if (el.classList.contains('selected')) {
      if (!_s.signupDays.includes(day)) _s.signupDays.push(day);
    } else {
      _s.signupDays = _s.signupDays.filter(d => d !== day);
    }
  }

  function togglePasswordVisibility(inputId, btn) {
    const inp = _el(inputId);
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
    btn.textContent = inp.type === 'password' ? '👁' : '🙈';
  }

  function fillDemoLogin(email, password, role) {
    showPage('auth');
    setAuthTab('signin');
    selectRole(role);
    const eEl = _el('si-email'), pEl = _el('si-password');
    if (eEl) eEl.value = email;
    if (pEl) pEl.value = password;
    setTimeout(handleLogin, 150);
  }
// ─────────────────────────────────────────────────────────────
  // FORM ERROR HELPERS  (required by auth forms, profile modal, create-task)
  // ─────────────────────────────────────────────────────────────
  function _showFormError(id, msg) {
    const el = _el(id);
    if (!el) return;
    el.textContent = msg || 'An unexpected error occurred.';
    el.classList.remove('hidden');
  }

  function _clearFormErrors() {
    ['signin-error', 'signup-error', 'pm-error', 'ct-error'].forEach(id => {
      const el = _el(id);
      if (el) { el.textContent = ''; el.classList.add('hidden'); }
    });
  }

  function _postLoginRedirect(user) {
    _updateNavbar();
    showPage(user.role === 'ngo' ? 'ngo-dash' : 'vol-dash');
  }
// --- UI LOGIN HANDLER ---
  async function handleLogin() {
    _clearFormErrors();
    const email    = (_el('si-email')?.value  || '').trim();
    const password =  _el('si-password')?.value || '';
    
    // The 'await' makes the browser pause until Firebase replies
    const result = await Auth.login(email, password);
    
    if (!result.success) { 
      _showFormError('signin-error', result.error); 
      return; 
    }
    
    _updateNavbar();
    showToast(`Welcome back, ${result.user.displayName}! 👋`, 'success');
    _postLoginRedirect(result.user);
  }

// --- UI SIGNUP HANDLER ---
  async function handleSignup() {
    _clearFormErrors();
    let result;
    
    if (_s.signupRole === 'volunteer') {
      result = await Auth.registerVolunteer({
        name:            _el('su-name')?.value     || '',
        email:           _el('su-email')?.value    || '',
        password:        _el('su-pw')?.value       || '',
        confirmPassword: _el('su-pw2')?.value      || '',
        dob:             _el('su-dob')?.value      || '',
        bio:             _el('su-bio')?.value      || '',
        skills:          [..._s.signupSkills],
        location:        _el('su-location')?.value || '',
        availability:    _el('su-avail')?.value    || 'Flexible',
        availableDays:   [..._s.signupDays],
      });
    } else {
      result = await Auth.registerNgo({
        orgName:         _el('su-orgname')?.value      || '',
        email:           _el('su-ngo-email')?.value    || '',
        password:        _el('su-ngo-pw')?.value       || '',
        confirmPassword: _el('su-ngo-pw2')?.value      || '',
        bio:             _el('su-ngo-bio')?.value      || '',
        location:        _el('su-ngo-location')?.value || '',
        contactPhone:    _el('su-ngo-phone')?.value    || '',
      });
    }
    
    // If Firebase fails, it will now properly show the error on screen instead of "undefined"
    if (!result.success) { 
      _showFormError('signup-error', result.error); 
      return; 
    }

    if (_s.signupRole === 'volunteer') _checkAndNotifyMatches(result.user);
    _updateNavbar();
    showToast(`Account created! Welcome, ${result.user.displayName} 🚀`, 'success');
    _postLoginRedirect(result.user);
  }
  async function handleLogout() {
    try {
      // 1. Sign out from Firebase
      await Auth.logout(); 
      
      // 2. Clear local UI state
      _updateNavbar();
      showPage('landing');
      showToast('Logged out successfully', 'info');
    } catch (error) {
      console.error("Logout error:", error);
    }
  }
  // ─────────────────────────────────────────────────────────────
  // SMART MATCH ALGORITHM
  //   Skill overlap:  70 pts max  (proportional to matched/required)
  //   Location match: 20 pts bonus
  //   Availability:   10 pts max
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

  function _getTopMatches(task, n = 3) {
    return DB.users.getVolunteers()
      .map(v => ({ volunteer: v, score: _calcMatchScore(v, task) }))
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, n);
  }

  function _checkAndNotifyMatches(vol) {
    DB.tasks.getAll()
      .filter(t => t.status === 'Open' && t.priority === 'Critical' && _calcMatchScore(vol, t) >= 60)
      .forEach(t => DB.notifications.create({
        userId: vol.uid,
        message: `You matched for "${t.title}" — a critical task in ${t.location}!`,
        type: 'match', icon: '🎯',
      }));
    _updateNotifBadge();
  }

  // ─────────────────────────────────────────────────────────────
  // LANDING
  // ─────────────────────────────────────────────────────────────
  function _renderLanding() {
    const vols  = DB.users.getVolunteers();
    const tasks = DB.tasks.getAll();
    const hours = vols.reduce((s, v) => s + (v.hours || 0), 0);
    _countUp('stat-volunteers', vols.length);
    _countUp('stat-tasks',  tasks.filter(t => t.status === 'Open').length);
    _countUp('stat-hours',  hours);
  }

  function _countUp(id, target) {
    const el = _el(id);
    if (!el) return;
    let v = 0;
    const step = Math.max(target / (1200 / 16), 1);
    const timer = setInterval(() => {
      v = Math.min(v + step, target);
      el.textContent = Math.round(v);
      if (v >= target) clearInterval(timer);
    }, 16);
  }

  // ─────────────────────────────────────────────────────────────
  // PROFILE SIDEBAR (shared by Volunteer & NGO dashboards)
  // ─────────────────────────────────────────────────────────────
  function _renderProfileSidebar(containerId, user) {
    const el = _el(containerId);
    if (!el) return;
    const color    = _avatarColor(user.displayName);
    const isVol    = user.role === 'volunteer';
    const stat1Val = isVol ? (user.hours || 0) + 'h' : DB.tasks.getByNgo(user.uid).filter(t => t.status === 'Open').length;
    const stat1Lbl = isVol ? 'Hours Given' : 'Open Tasks';
    const stat2Val = isVol ? (user.skills || []).length : DB.users.getVolunteers().length;
    const stat2Lbl = isVol ? 'Skills' : 'Pool Size';
    el.innerHTML = `
      <div class="profile-sidebar-card">
        <div class="psc-avatar" style="background:${color}">${_initials(user.displayName)}</div>
        <div class="psc-name">${user.displayName}</div>
        <div class="psc-role">${isVol ? '🙌 Volunteer' : '🏢 NGO'} · ${user.location || 'N/A'}</div>
        <div class="psc-stats">
          <div><div class="psc-stat-val">${stat1Val}</div><div class="psc-stat-lbl">${stat1Lbl}</div></div>
          <div><div class="psc-stat-val">${stat2Val}</div><div class="psc-stat-lbl">${stat2Lbl}</div></div>
        </div>
      </div>`;
  }

  // ─────────────────────────────────────────────────────────────
  // PROFILE MODAL
  // ─────────────────────────────────────────────────────────────
  function openProfileModal(uid) {
    const user = uid ? DB.users.getById(uid) : (() => {
      const cu = Auth.getCurrentUser();
      return cu ? DB.users.getById(cu.uid) : null;
    })();
    if (!user) { showToast('User not found.', 'error'); return; }

    const color      = _avatarColor(user.displayName);
    const isVol      = user.role === 'volunteer';
    const isSelf     = Auth.getCurrentUser()?.uid === user.uid;
    const age        = _ageFromDob(user.dob);

    // Top section
    const topHtml = `
      <div class="profile-modal-top">
        <div>
          <div class="profile-modal-avatar" style="background:${color}">${_initials(user.displayName)}</div>
          ${isSelf ? `<button class="profile-modal-change-photo" onclick="App._handlePhotoChange()">📷 Change Photo</button>` : ''}
        </div>
        <div>
          <div class="profile-modal-name">${user.displayName}</div>
          <div class="profile-modal-sub">${isVol ? '🙌 Volunteer' : '🏢 NGO'} · ${user.location || 'Location not set'}</div>
          ${isVol ? `<div class="profile-modal-sub" style="margin-top:6px">
            ${(user.skills || []).map(s => `<span style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:999px;padding:2px 8px;font-size:0.7rem;font-weight:600;margin:2px">${_skillEmoji(s)} ${s}</span>`).join('')}
          </div>` : ''}
        </div>
      </div>`;

    // Info grid
    let infoFields = [];
    if (isVol) {
      infoFields = [
        { label:'Email',        val: user.email || '—' },
        { label:'Date of Birth',val: user.dob ? `${user.dob} ${age ? `(${age} yrs)` : ''}` : '—' },
        { label:'Location',     val: user.location || '—' },
        { label:'Availability', val: user.availability || '—' },
        { label:'Hours Logged', val: `${user.hours || 0} hours` },
        { label:'Joined',       val: user.createdAt || '—' },
        { label:'Available Days', val: (user.availableDays || []).join(', ') || '—' },
        { label:'Bio',          val: user.bio || 'No bio provided.' },
      ];
    } else {
      infoFields = [
        { label:'Organisation', val: user.orgName || user.displayName },
        { label:'Email',        val: user.contactEmail || user.email || '—' },
        { label:'Phone',        val: user.contactPhone || '—' },
        { label:'Location',     val: user.location || '—' },
        { label:'Joined',       val: user.createdAt || '—' },
        { label:'About',        val: user.bio || 'No description provided.' },
      ];
    }

    const infoHtml = `
      <div class="profile-info-grid">
        ${infoFields.map(f => `
          <div class="profile-info-item ${f.label==='Bio'||f.label==='About'?'style="grid-column:span 2"':''}">
            <div class="profile-info-label">${f.label}</div>
            <div class="profile-info-val">${f.val}</div>
          </div>`).join('')}
      </div>`;

    // Edit section (self only)
    const editHtml = isSelf ? `
      <div style="margin-top:20px;padding-top:18px;border-top:1px solid var(--border)">
        <div style="font-size:0.78rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);margin-bottom:14px">Edit Profile</div>
        ${isVol ? `
        <div class="form-group">
          <label class="form-label" for="pm-bio">Bio</label>
          <textarea class="form-textarea" id="pm-bio" rows="2">${user.bio || ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label" for="pm-avail">Availability</label>
          <select class="form-select" id="pm-avail">
            <option ${user.availability==='Weekends'?'selected':''}>Weekends</option>
            <option ${user.availability==='Weekdays'?'selected':''}>Weekdays</option>
            <option ${user.availability==='Full-time'?'selected':''}>Full-time</option>
            <option ${user.availability==='Flexible'?'selected':''}>Flexible</option>
          </select>
        </div>` : `
        <div class="form-group">
          <label class="form-label" for="pm-bio">Description</label>
          <textarea class="form-textarea" id="pm-bio" rows="2">${user.bio || ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label" for="pm-phone">Contact Phone</label>
          <input class="form-input" type="tel" id="pm-phone" value="${user.contactPhone || ''}" />
        </div>`}
        <div style="font-size:0.78rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);margin:16px 0 12px">Change Password</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="pm-cur-pw">Current Password</label>
            <input class="form-input" type="password" id="pm-cur-pw" placeholder="••••••" />
          </div>
          <div class="form-group">
            <label class="form-label" for="pm-new-pw">New Password</label>
            <input class="form-input" type="password" id="pm-new-pw" placeholder="Min 6 chars" />
          </div>
        </div>
        <div class="form-error hidden" id="pm-error"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px">
          <button class="btn btn-ghost btn-sm" onclick="App.closeModal('modal-profile')">Close</button>
          <button class="btn btn-primary btn-sm" onclick="App._saveProfile('${user.uid}','${isVol?'volunteer':'ngo'}')">Save Changes ✓</button>
        </div>
      </div>` : `
      <div style="margin-top:16px;display:flex;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="App.closeModal('modal-profile')">Close</button>
      </div>`;

    _setHtml('modal-profile-body', topHtml + infoHtml + editHtml);
    openModal('modal-profile');
  }

  function _saveProfile(uid, role) {
    const bio    = (_el('pm-bio')?.value   || '').trim();
    const curPw  =  _el('pm-cur-pw')?.value || '';
    const newPw  =  _el('pm-new-pw')?.value || '';
    const avail  =  _el('pm-avail')?.value  || '';
    const phone  =  _el('pm-phone')?.value  || '';

    const updates = {};
    if (bio)   updates.bio   = bio;
    if (avail) updates.availability = avail;
    if (phone) updates.contactPhone = phone;

    // Password change (optional)
    if (newPw || curPw) {
      updates.currentPassword   = curPw;
      updates.newPassword       = newPw;
      updates.confirmNewPassword = newPw;
    }

    const result = Auth.updateProfile(updates);
    if (!result.success) { _showFormError('pm-error', result.error); return; }

    // Refresh sidebar
    const cu = Auth.getCurrentUser();
    const fresh = DB.users.getById(cu.uid);
    if (_s.currentPage === 'vol-dash') _renderProfileSidebar('vol-profile-sidebar', fresh);
    if (_s.currentPage === 'ngo-dash') _renderProfileSidebar('ngo-profile-sidebar', fresh);
    _updateNavbar();
    closeModal('modal-profile');
    showToast('Profile updated successfully! ✓', 'success');
  }

  function _handlePhotoChange() {
    // Placeholder — in production, trigger a file input and upload to Firebase Storage
    showToast('Photo upload: connect Firebase Storage to enable this feature.', 'info');
  }

  // ─────────────────────────────────────────────────────────────
  // TASK DETAIL MODAL
  // ─────────────────────────────────────────────────────────────
  function showTaskDetailModal(taskId) {
    const task = DB.tasks.getById(taskId);
    if (!task) return;
    const user       = Auth.getCurrentUser();
    const isVol      = user?.role === 'volunteer';
    const vol        = isVol ? DB.users.getById(user.uid) : null;
    const applied    = vol ? (task.applications || []).find(a => a.userId === vol.uid) : null;

    _setHtml('modal-task-title', task.title);
    _setHtml('modal-task-detail-body', `
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:18px">
        ${_priorityBadge(task.priority)}
        ${_statusBadge(task.status)}
      </div>

      <div class="profile-info-grid" style="margin-bottom:18px">
        <div class="profile-info-item">
          <div class="profile-info-label">Posted By</div>
          <div class="profile-info-val">${task.ngoName}</div>
        </div>
        <div class="profile-info-item">
          <div class="profile-info-label">NGO Contact</div>
          <div class="profile-info-val">${task.ngoContact || '—'}</div>
        </div>
        <div class="profile-info-item">
          <div class="profile-info-label">Location</div>
          <div class="profile-info-val">📍 ${task.location}</div>
        </div>
        <div class="profile-info-item">
          <div class="profile-info-label">Duration</div>
          <div class="profile-info-val">⏱️ ${task.duration || 'TBD'}</div>
        </div>
        <div class="profile-info-item">
          <div class="profile-info-label">Volunteers Needed</div>
          <div class="profile-info-val">👥 ${task.volunteersNeeded || '?'}</div>
        </div>
        <div class="profile-info-item">
          <div class="profile-info-label">Posted On</div>
          <div class="profile-info-val">📅 ${task.postedDate}</div>
        </div>
      </div>

      <div style="margin-bottom:16px">
        <div class="profile-info-label" style="margin-bottom:8px">Required Skills</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${(task.requiredSkills || []).map(s => `<span class="badge badge-navy">${_skillEmoji(s)} ${s}</span>`).join('')}
          ${task.customRole ? `<span class="badge badge-purple">🎭 ${task.customRole}</span>` : ''}
        </div>
      </div>

      <div style="margin-bottom:20px">
        <div class="profile-info-label" style="margin-bottom:8px">Full Description</div>
        <div style="font-size:0.875rem;color:var(--text-2);line-height:1.7;background:var(--slate-50);padding:14px;border-radius:var(--radius-md);border:1px solid var(--border)">${task.description}</div>
      </div>

      ${isVol ? `<div style="display:flex;gap:8px;justify-content:flex-end;padding-top:12px;border-top:1px solid var(--border)">
        <button class="btn btn-ghost" onclick="App.closeModal('modal-task-detail')">Close</button>
        ${applied && (applied.status === 'pending' || applied.status === 'approved')
          ? `<button class="btn btn-ghost" style="color:var(--red)" onclick="App.confirmRevokeCommitment('${task.id}');App.closeModal('modal-task-detail')">Revoke Commitment</button>`
          : (!applied ? `<button class="btn btn-emerald" onclick="App.applyToTask('${task.id}');App.closeModal('modal-task-detail')">Apply Now →</button>` : '')}
      </div>` : `<div style="display:flex;justify-content:flex-end">
        <button class="btn btn-ghost" onclick="App.closeModal('modal-task-detail')">Close</button>
      </div>`}
    `);
    openModal('modal-task-detail');
  }

  // ─────────────────────────────────────────────────────────────
  // VOLUNTEER DASHBOARD
  // ─────────────────────────────────────────────────────────────
  function _renderVolDash() {
    const user = Auth.getCurrentUser();
    if (!user) return;
    const vol = DB.users.getById(user.uid) || user;
    _renderProfileSidebar('vol-profile-sidebar', vol);
    _renderVolOpportunities();
    _renderMyTasks();
    _renderVolAvailability(vol);
    _startActivityFeed();
    _updateMsgBadge();
  }

  function showVolTab(tab) {
    _s.currentVolTab = tab;
    ['opportunities','my-tasks','availability','map','incentives','certificates','squads'].forEach(t => {
      const el = _el('vol-tab-' + t);
      if (el) {
        el.classList.toggle('active', t === tab);
        el.classList.toggle('hidden', t !== tab);
      }
    });
    document.querySelectorAll('#page-vol-dash .sidebar-link[data-tab]').forEach(l =>
      l.classList.toggle('active', l.dataset.tab === tab)
    );
    if (tab === 'map')          _renderMap('vol-map');
    if (tab === 'my-tasks')     _renderMyTasks();
    if (tab === 'incentives')   _renderIncentives();
    if (tab === 'certificates') _renderCertificates();
    if (tab === 'squads')       _renderSquadsTab();
    if (tab === 'availability') {
      const cu = Auth.getCurrentUser();
      if (cu) _renderVolAvailability(DB.users.getById(cu.uid));
    }
    if (tab === 'opportunities') _startActivityFeed();
  }

  function _renderVolOpportunities() {
    const user  = Auth.getCurrentUser();
    const vol   = user ? DB.users.getById(user.uid) : null;
    let tasks   = DB.tasks.getAll().filter(t => t.status !== 'Complete');

    if (_s.volFilter !== 'all') tasks = tasks.filter(t => t.priority === _s.volFilter);
    if (_s.volSearch) {
      const q = _s.volSearch.toLowerCase();
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q)
      );
    }

    if (vol?.skills?.length) {
      tasks = tasks
        .map(t => ({ ...t, _score: _calcMatchScore(vol, t) }))
        .sort((a, b) => b._score - a._score);
    }

    const container = _el('vol-task-list');
    if (!container) return;
    if (!tasks.length) {
      container.innerHTML = _emptyState('🔍', 'No tasks found', 'Try adjusting your filters or check back soon.');
      return;
    }
    container.innerHTML = tasks.map(task => _buildVolTaskCard(task, vol)).join('');
  }

  function _buildVolTaskCard(task, vol) {
    const applied = vol ? (task.applications || []).find(a => a.userId === vol.uid) : null;
    const skillsHtml = (task.requiredSkills || [])
      .map(s => `<span class="badge badge-navy">${_skillEmoji(s)} ${s}</span>`).join('');

    let actionHtml;
    if (applied) {
      const statusCls = { pending:'badge-slate', approved:'badge-green', rejected:'badge-red', revoked:'badge-slate' };
      const statusLbl = { pending:'⏳ Pending Approval', approved:'✅ Approved', rejected:'❌ Rejected', revoked:'↩ Revoked' };
      actionHtml = `
        <span class="badge ${statusCls[applied.status] || 'badge-slate'}">${statusLbl[applied.status] || applied.status}</span>
        ${(applied.status === 'pending' || applied.status === 'approved')
          ? `<button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="App.confirmRevokeCommitment('${task.id}')">Revoke</button>`
          : ''}
        <button class="btn btn-ghost btn-sm" onclick="App.showTaskDetailModal('${task.id}')">View Details</button>`;
    } else {
      actionHtml = `
        <button class="btn btn-emerald btn-sm" onclick="App.applyToTask('${task.id}')">Apply Now</button>
        <button class="btn btn-ghost btn-sm" onclick="App.showTaskDetailModal('${task.id}')">View Details</button>`;
    }

    return `
    <div class="task-card priority-${task.priority}">
      <div class="task-card-header">
        <div>
          <div class="task-card-title">${task.title}</div>
          <div class="task-card-ngo">by ${task.ngoName}</div>
        </div>
        <div class="task-card-badges">
          ${_priorityBadge(task.priority)}
          ${_statusBadge(task.status)}
        </div>
      </div>
      <div class="task-desc">${task.description}</div>
      <div class="task-skills">
        ${skillsHtml}
        ${task.customRole ? `<span class="badge badge-purple">🎭 ${task.customRole}</span>` : ''}
      </div>
      <div class="task-meta">
        <span class="task-meta-item">📍 ${task.location}</span>
        <span class="task-meta-item">👥 ${task.volunteersNeeded || '?'} needed</span>
        <span class="task-meta-item">⏱️ ${task.duration || 'TBD'}</span>
        <span class="task-meta-item">📅 ${task.postedDate}</span>
        <span class="task-meta-item">📨 ${(task.applications || []).length} applied</span>
      </div>
      <div class="task-actions">${actionHtml}</div>
    </div>`;
  }

  function _renderMyTasks() {
    const user = Auth.getCurrentUser();
    if (!user) return;
    const allTasks = DB.tasks.getAll().filter(t =>
      (t.applications || []).some(a => a.userId === user.uid)
    );
    const container = _el('vol-my-tasks-list');
    if (!container) return;
    if (!allTasks.length) {
      container.innerHTML = _emptyState('📋', 'No commitments yet', 'Browse Opportunities and apply to tasks that match your skills.');
      return;
    }

    // Split: current = pending/approved on open tasks; history = completed/revoked/rejected
    const current = allTasks.filter(t => {
      const app = t.applications.find(a => a.userId === user.uid);
      return (app.status === 'pending' || app.status === 'approved') && t.status !== 'Complete';
    });
    const history = allTasks.filter(t => {
      const app = t.applications.find(a => a.userId === user.uid);
      return app.status === 'revoked' || app.status === 'rejected' || t.status === 'Complete';
    });

    const renderCard = task => {
      const app    = task.applications.find(a => a.userId === user.uid);
      const logged = (task.hoursLogged || {})[user.uid] || 0;
      const skillsHtml = (task.requiredSkills || [])
        .map(s => `<span class="badge badge-navy">${_skillEmoji(s)} ${s}</span>`).join('');
      const stCls = { pending:'badge-slate', approved:'badge-green', rejected:'badge-red', revoked:'badge-slate' };
      const stLbl = { pending:'⏳ Pending Approval', approved:'✅ Approved', rejected:'❌ Rejected', revoked:'↩ Revoked' };
      return `
      <div class="task-card priority-${task.priority}">
        <div class="task-card-header">
          <div>
            <div class="task-card-title">${task.title}</div>
            <div class="task-card-ngo">by <button class="link-btn" style="font-size:.75rem" onclick="App.openNgoProfilePage('${task.ngoId}')">${task.ngoName}</button></div>
          </div>
          <div class="task-card-badges">
            <span class="badge ${stCls[app.status]||'badge-slate'}">${stLbl[app.status]||app.status}</span>
            ${_priorityBadge(task.priority)}
          </div>
        </div>
        <div class="task-desc">${task.description}</div>
        <div class="task-skills">${skillsHtml}</div>
        <div class="task-meta">
          <span class="task-meta-item">📍 ${task.location}</span>
          <span class="task-meta-item">⏱️ ${task.duration||'TBD'}</span>
          <span class="task-meta-item">📅 Applied ${app.appliedDate}</span>
          <span class="task-meta-item">📞 ${task.ngoContact||'—'}</span>
          ${logged > 0 ? `<span class="task-meta-item" style="color:var(--green-mid);font-weight:600">✓ ${logged}h logged</span>` : ''}
        </div>
        <div class="task-actions">
          ${(app.status === 'pending' || app.status === 'approved')
            ? `<button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="App.confirmRevokeCommitment('${task.id}')">Revoke Commitment</button>`
            : ''}
          <button class="btn btn-ghost btn-sm" onclick="App.showTaskDetailModal('${task.id}')">View Details</button>
          <button class="btn btn-ghost btn-sm" onclick="App.openNgoProfilePage('${task.ngoId}')">View NGO</button>
        </div>
      </div>`;
    };

    container.innerHTML = `
      <div class="commitments-section">
        <div class="commitments-section-header">
          <h3 class="commitments-section-title">Current Commitments</h3>
          <span class="badge badge-blue">${current.length}</span>
        </div>
        ${current.length ? current.map(renderCard).join('') : `<div style="padding:16px;color:var(--text-muted);font-size:.85rem">No active commitments.</div>`}
      </div>
      <div class="commitments-section" style="margin-top:28px">
        <div class="commitments-section-header">
          <h3 class="commitments-section-title">Volunteering History</h3>
          <span class="badge badge-slate">${history.length}</span>
        </div>
        ${history.length ? history.map(renderCard).join('') : `<div style="padding:16px;color:var(--text-muted);font-size:.85rem">No past activity yet.</div>`}
      </div>`;
  }

  function _renderVolAvailability(vol) {
    const el = _el('vol-availability-card');
    if (!el) return;
    const days     = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const selected = vol?.availableDays || [];
    _s.signupDays  = [...selected];
    el.innerHTML = `
      <p style="font-size:0.875rem;color:var(--text-3);margin-bottom:18px;line-height:1.6">
        Mark the days you are typically free. NGOs will see this when reviewing your application.
      </p>
      <div class="avail-grid">
        ${days.map(d => `
          <div class="avail-day ${selected.includes(d) ? 'selected' : ''}" onclick="App.toggleAvailDay(this,'${d}')">
            <span class="avail-day-abbr">${d.slice(0,3)}</span>
            <span class="avail-day-full">${d.slice(3)}</span>
          </div>`).join('')}
      </div>
      <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border);display:flex;gap:10px;justify-content:flex-end">
        <button class="btn btn-primary" onclick="App.saveAvailability()">Save Availability ✓</button>
      </div>`;
  }

  function toggleAvailDay(el, day) {
    el.classList.toggle('selected');
    if (el.classList.contains('selected')) { if (!_s.signupDays.includes(day)) _s.signupDays.push(day); }
    else _s.signupDays = _s.signupDays.filter(d => d !== day);
  }

  function saveAvailability() {
    const user = Auth.getCurrentUser();
    if (!user) return;
    DB.users.update(user.uid, { availableDays: [..._s.signupDays] });
    Auth.refreshSession();
    showToast(`Availability saved — ${_s.signupDays.length} day(s) selected.`, 'success');
  }

  // ─────────────────────────────────────────────────────────────
  // APPLY / REVOKE
  // ─────────────────────────────────────────────────────────────
  function applyToTask(taskId) {
    if (!Auth.requireAuth()) return;
    const user = Auth.getCurrentUser();
    const vol  = DB.users.getById(user.uid);
    if (!vol)  return;
    const task = DB.tasks.getById(taskId);
    if (!task) return;

    const ok = DB.tasks.addApplication(taskId, {
      userId: vol.uid, userName: vol.displayName,
      userEmail: vol.email, userSkills: vol.skills || [],
      userLocation: vol.location || '',
    });

    if (!ok) { showToast('You have already applied to this task.', 'info'); return; }

    DB.notifications.create({
      userId:  task.ngoId,
      message: `${vol.displayName} applied to "${task.title}". Review applications in your dashboard.`,
      type: 'application', icon: '📩',
    });

    showToast(`Applied to "${task.title}" — awaiting NGO approval.`, 'success');
    _renderVolOpportunities();
    if (_s.currentVolTab === 'my-tasks') _renderMyTasks();
  }

  function confirmRevokeCommitment(taskId) {
    _showConfirmDialog(
      'Are you sure you want to revoke this commitment? The NGO will be notified and your application removed.',
      () => _revokeCommitment(taskId),
      'Yes, Revoke'
    );
  }

  function _revokeCommitment(taskId) {
    const user = Auth.getCurrentUser();
    if (!user) return;
    const task = DB.tasks.getById(taskId);
    if (!task) return;
    DB.tasks.removeApplication(taskId, user.uid);
    DB.notifications.create({
      userId:  task.ngoId,
      message: `${user.displayName} has withdrawn from "${task.title}".`,
      type: 'alert', icon: '↩️',
    });
    showToast('Commitment revoked.', 'info');
    _renderVolOpportunities();
    _renderMyTasks();
  }

  function filterByPriority(priority, btn) {
    _s.volFilter = priority;
    document.querySelectorAll('#vol-priority-filters .filter-chip').forEach(c => c.classList.remove('active'));
    if (btn) btn.classList.add('active');
    _renderVolOpportunities();
  }

  function handleVolSearch(q) {
    _s.volSearch = q;
    _renderVolOpportunities();
  }

  // ─────────────────────────────────────────────────────────────
  // NGO DASHBOARD
  // ─────────────────────────────────────────────────────────────
  function _renderNgoDash() {
    const user = Auth.getCurrentUser();
    if (!user) return;
    const ngo = DB.users.getById(user.uid) || user;
    _renderProfileSidebar('ngo-profile-sidebar', ngo);
    _renderNgoTasks();
    _renderNgoVolPool();
    _renderNgoQuickStats();
  }

  function showNgoTab(tab) {
    _s.currentNgoTab = tab;
    ['tasks','volunteers','map','donations'].forEach(t => {
      const el = _el('ngo-tab-' + t);
      if (el) {
        el.classList.toggle('active', t === tab);
        el.classList.toggle('hidden', t !== tab);
      }
    });
    document.querySelectorAll('#page-ngo-dash .sidebar-link[data-tab]').forEach(l =>
      l.classList.toggle('active', l.dataset.tab === tab)
    );
    if (tab === 'map')       _renderMap('ngo-map');
    if (tab === 'volunteers') _renderNgoVolPool();
    if (tab === 'donations')  _renderNgoDonations();
  }

  function _renderNgoTasks() {
    const tasks     = DB.tasks.getAll();
    const container = _el('ngo-task-list');
    if (!container) return;
    if (!tasks.length) {
      container.innerHTML = _emptyState('📋', 'No tasks yet',
        '<button class="btn btn-primary btn-sm" onclick="App.guardPage(\'create-task\',\'ngo\')">Post your first task</button>');
      return;
    }
    container.innerHTML = tasks.map(t => _buildNgoTaskCard(t)).join('');
  }

  function _buildNgoTaskCard(task) {
    const user    = Auth.getCurrentUser();
    const isOwner = task.ngoId === user?.uid;
    const apps    = task.applications || [];
    const pending  = apps.filter(a => a.status === 'pending').length;
    const approved = apps.filter(a => a.status === 'approved').length;
    const skillsHtml = (task.requiredSkills || [])
      .map(s => `<span class="badge badge-navy">${_skillEmoji(s)} ${s}</span>`).join('');

    // Applications list
    const appsHtml = apps.length > 0 ? `
      <div class="applications-block">
        <div class="applications-title">
          Applications — ${apps.length} total · ${pending} pending · ${approved} approved
        </div>
        ${apps.map(app => {
          const color  = _avatarColor(app.userName);
          const logged = (task.hoursLogged || {})[app.userId] || 0;
          const stCls  = { pending:'badge-slate', approved:'badge-green', rejected:'badge-red', revoked:'badge-slate' };
          const stLbl  = { pending:'Pending', approved:'Approved', rejected:'Rejected', revoked:'Revoked' };
          return `
          <div class="application-row">
            <div class="app-avatar" style="background:${color}">${_initials(app.userName)}</div>
            <div class="app-info">
              <div class="app-name">${app.userName}
                <span class="badge ${stCls[app.status]}" style="margin-left:6px;font-size:0.67rem">${stLbl[app.status]}</span>
              </div>
              <div class="app-detail">
                ${app.userLocation} · ${(app.userSkills||[]).join(', ')}
                ${logged > 0 ? `· <strong style="color:var(--green-mid)">${logged}h logged</strong>` : ''}
              </div>
            </div>
            <div class="app-actions">
              ${isOwner ? `
                <button class="btn btn-ghost btn-xs" onclick="App.openProfileModal('${app.userId}')" title="View Profile">👤</button>
                ${app.status === 'pending' ? `
                  <button class="btn btn-emerald btn-xs" onclick="App.approveApplication('${task.id}','${app.userId}')">✓ Approve</button>
                  <button class="btn btn-danger  btn-xs" onclick="App.rejectApplication('${task.id}','${app.userId}')">✗ Reject</button>` : ''}
                ${app.status === 'approved' ? `
                  <button class="btn btn-primary btn-xs" onclick="App.openAddHoursModal('${task.id}','${app.userId}','${app.userName}')">+ Hours</button>` : ''}
              ` : `<button class="btn btn-ghost btn-xs" onclick="App.openProfileModal('${app.userId}')">👤</button>`}
            </div>
          </div>`;
        }).join('')}
      </div>` : '';

    // Smart match result container
    const matchContainer = `<div id="match-result-${task.id}"></div>`;

    return `
    <div class="task-card priority-${task.priority}" id="tc-${task.id}">
      <div class="task-card-header">
        <div>
          <div class="task-card-title">${task.title}</div>
          <div class="task-card-ngo">by ${task.ngoName} · posted ${task.postedDate}</div>
        </div>
        <div class="task-card-badges">
          ${_priorityBadge(task.priority)}
          ${_statusBadge(task.status)}
          ${apps.length > 0 ? `<span class="badge badge-purple">${apps.length} applied</span>` : ''}
        </div>
      </div>
      <div class="task-desc">${task.description}</div>
      <div class="task-skills">
        ${skillsHtml}
        ${task.customRole ? `<span class="badge badge-purple">🎭 ${task.customRole}</span>` : ''}
      </div>
      <div class="task-meta">
        <span class="task-meta-item">📍 ${task.location}</span>
        <span class="task-meta-item">👥 ${task.volunteersNeeded || '?'} needed</span>
        <span class="task-meta-item">⏱️ ${task.duration || 'TBD'}</span>
      </div>
      <div class="task-actions">
        <button class="btn btn-primary btn-sm" onclick="App.runSmartMatch('${task.id}')">🤖 Smart Match</button>
        <button class="btn btn-ghost btn-sm" onclick="App.showTaskDetailModal('${task.id}')">View Details</button>
        ${isOwner ? `
          <button class="btn btn-ghost btn-sm" onclick="App.toggleTaskStatus('${task.id}')">
            ${task.status === 'Complete' ? '🔄 Reopen' : '✅ Mark Complete'}
          </button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="App.confirmDeleteTask('${task.id}')">🗑 Delete</button>
        ` : ''}
      </div>
      ${appsHtml}
      ${matchContainer}
    </div>`;
  }

  function _renderNgoVolPool() {
    const user  = Auth.getCurrentUser();
    const vols  = DB.users.getVolunteers();
    const tasks = DB.tasks.getAll().filter(t => t.ngoId === user?.uid);
    const badge = _el('vol-pool-count');
    if (badge) badge.textContent = `${vols.length} volunteers`;

    // Categorise per-volunteer across this NGO's tasks
    const workingIds = new Set();
    const appliedIds = new Set();
    tasks.forEach(task => {
      (task.applications || []).forEach(app => {
        if (app.status === 'approved') workingIds.add(app.userId);
        else if (app.status === 'pending') appliedIds.add(app.userId);
      });
    });

    const container = _el('ngo-vol-list');
    if (!container) return;
    if (!vols.length) {
      container.innerHTML = `<div style="grid-column:span 2">${_emptyState('👥','No volunteers yet','Volunteers will appear here once they sign up.')}</div>`;
      return;
    }

    const buildCard = (vol, tag) => {
      const color  = _avatarColor(vol.displayName);
      const age    = _ageFromDob(vol.dob);
      const logged = tasks.reduce((s, t) => s + ((t.hoursLogged || {})[vol.uid] || 0), 0);
      const avgR   = vol.ratings?.length ? (vol.ratings.reduce((s,r)=>s+r.score,0)/vol.ratings.length).toFixed(1) : null;
      return `
      <div class="vol-card">
        <div class="vol-card-header">
          <div class="vol-avatar-md" style="background:${color}">${_initials(vol.displayName)}</div>
          <div style="flex:1;min-width:0">
            <div class="vol-card-name">${vol.displayName} ${tag}</div>
            <div class="vol-card-loc">📍 ${vol.location} · ${vol.availability}${age ? ` · ${age}y` : ''}${avgR ? ` · ⭐${avgR}` : ''}</div>
          </div>
        </div>
        <div class="vol-card-skills">${(vol.skills||[]).map(s=>`<span class="badge badge-blue">${_skillEmoji(s)} ${s}</span>`).join('')}</div>
        <div class="vol-card-meta" style="margin-bottom:10px">
          <span>⏱️ ${vol.hours||0}h total · ${logged}h for us</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-xs" onclick="App.openProfileModal('${vol.uid}')">👤 Profile</button>
          <button class="btn btn-primary btn-xs" onclick="App.openAddHoursModal('${tasks.find(t=>(t.applications||[]).some(a=>a.userId===vol.uid))?.id||''}','${vol.uid}','${_esc(vol.displayName)}')">+ Hours</button>
          <button class="btn btn-amber btn-xs" onclick="App.openBonusModal('${vol.uid}','${_esc(vol.displayName)}')">₹ Bonus</button>
          <button class="btn btn-ghost btn-xs" onclick="App.openRateVolModal('${vol.uid}','${_esc(vol.displayName)}')">⭐ Rate</button>
          <button class="btn btn-ghost btn-xs" onclick="App.openMessageModal('${vol.uid}','${_esc(vol.displayName)}')">💬</button>
        </div>
      </div>`;
    };

    const working = vols.filter(v => workingIds.has(v.uid));
    const applied = vols.filter(v => appliedIds.has(v.uid) && !workingIds.has(v.uid));
    const others  = vols.filter(v => !workingIds.has(v.uid) && !appliedIds.has(v.uid));

    container.innerHTML = `
      ${working.length ? `
        <div style="grid-column:1/-1;font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--green-mid);padding:4px 0;border-bottom:2px solid var(--green-100);margin-bottom:2px">
          ✅ Currently Working (${working.length})
        </div>
        ${working.map(v => buildCard(v, `<span class="badge badge-green" style="font-size:.65rem">Working</span>`)).join('')}
      ` : ''}
      ${applied.length ? `
        <div style="grid-column:1/-1;font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--amber);padding:4px 0;border-bottom:2px solid var(--amber-100);margin-top:12px;margin-bottom:2px">
          ⏳ Applied — Pending Review (${applied.length})
        </div>
        ${applied.map(v => buildCard(v, `<span class="badge badge-amber" style="font-size:.65rem">Pending</span>`)).join('')}
      ` : ''}
      ${others.length ? `
        <div style="grid-column:1/-1;font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted);padding:4px 0;border-bottom:1px solid var(--border);margin-top:12px;margin-bottom:2px">
          👥 General Pool (${others.length})
        </div>
        ${others.map(v => buildCard(v, '')).join('')}
      ` : ''}`;
  }

  function _renderNgoQuickStats() {
    const tasks = DB.tasks.getAll();
    const vols  = DB.users.getVolunteers();
    const user  = Auth.getCurrentUser();
    const myTasks = tasks.filter(t => t.ngoId === user?.uid);
    _setHtml('ngo-quick-stats', `
      <div class="label-sm" style="font-size:0.67rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-muted);margin-bottom:10px">Quick Stats</div>
      ${[
        ['Open Tasks',  myTasks.filter(t=>t.status==='Open').length,     'var(--blue-mid)'],
        ['Completed',   myTasks.filter(t=>t.status==='Complete').length,  'var(--green-mid)'],
        ['Total Applied', myTasks.reduce((s,t)=>s+(t.applications?.length||0),0), 'var(--purple)'],
        ['Vol. Pool',   vols.length,                                      'var(--text)'],
      ].map(([lbl,val,color]) => `
        <div class="quick-stat-row">
          <span style="font-size:0.82rem;color:var(--text-3)">${lbl}</span>
          <span class="quick-stat-val" style="color:${color}">${val}</span>
        </div>`).join('')}
    `);
  }

  // ─────────────────────────────────────────────────────────────
  // NGO — APPROVE / REJECT APPLICATIONS
  // ─────────────────────────────────────────────────────────────
  function approveApplication(taskId, userId) {
    DB.tasks.updateApplicationStatus(taskId, userId, 'approved');
    const vol  = DB.users.getById(userId);
    const task = DB.tasks.getById(taskId);
    DB.notifications.create({
      userId,
      message: `You have been approved for "${task?.title}"! Get ready to make an impact. 🎉`,
      type: 'success', icon: '✅',
    });
    showToast(`${vol?.displayName || 'Volunteer'} approved!`, 'success');
    _renderNgoTasks();
    _updateNotifBadge();
  }

  function rejectApplication(taskId, userId) {
    _showConfirmDialog(
      'Reject this volunteer\'s application? They will be notified.',
      () => {
        DB.tasks.updateApplicationStatus(taskId, userId, 'rejected');
        const vol  = DB.users.getById(userId);
        const task = DB.tasks.getById(taskId);
        DB.notifications.create({
          userId,
          message: `Your application for "${task?.title}" was not selected this time. Keep volunteering!`,
          type: 'alert', icon: '📬',
        });
        showToast('Application rejected.', 'info');
        _renderNgoTasks();
        _updateNotifBadge();
      },
      'Reject'
    );
  }

  // ─────────────────────────────────────────────────────────────
  // NGO — ADD HOURS MODAL
  // ─────────────────────────────────────────────────────────────
  function openAddHoursModal(taskId, userId, userName) {
    _el('modal-hours-task-id').value = taskId;
    _el('modal-hours-user-id').value = userId;
    _el('modal-hours-input').value   = '';
    _setHtml('modal-hours-desc',
      `Log hours for <strong>${userName}</strong> on task: <em>${DB.tasks.getById(taskId)?.title || taskId}</em>.`
    );
    const errEl = _el('modal-hours-error');
    if (errEl) { errEl.classList.add('hidden'); errEl.textContent = ''; }
    openModal('modal-add-hours');
  }

  function submitAddHours() {
    const taskId = _el('modal-hours-task-id')?.value;
    const userId = _el('modal-hours-user-id')?.value;
    const hours  = parseFloat(_el('modal-hours-input')?.value || '');
    const errEl  = _el('modal-hours-error');
    if (!hours || hours <= 0 || hours > 500) {
      if (errEl) { errEl.textContent = '⚠️ Please enter a valid number of hours (1–500).'; errEl.classList.remove('hidden'); }
      return;
    }
    DB.tasks.logHours(taskId, userId, hours);
    const vol = DB.users.getById(userId);
    DB.notifications.create({
      userId,
      message: `${hours} hours have been logged to your profile for "${DB.tasks.getById(taskId)?.title}". Total: ${DB.users.getById(userId)?.hours}h.`,
      type: 'success', icon: '⏱️',
    });
    closeModal('modal-add-hours');
    showToast(`${hours}h logged for ${vol?.displayName || 'volunteer'}. ✓`, 'success');
    _renderNgoTasks();
    _updateNotifBadge();
  }

  // ─────────────────────────────────────────────────────────────
  // NGO — TOGGLE COMPLETE / DELETE TASK
  // ─────────────────────────────────────────────────────────────
  function _issueCertificatesForCompletedTask(task) {
    if (!task || task.status !== 'Complete') return;
    (task.applications || []).filter(a => a.status === 'approved').forEach(app => {
      if (DB.certificates.existsFor(task.id, app.userId)) return;
      DB.certificates.create({
        taskId: task.id,
        taskTitle: task.title,
        ngoId: task.ngoId,
        ngoName: task.ngoName,
        recipientId: app.userId,
        recipientName: app.userName,
        hoursContributed: (task.hoursLogged || {})[app.userId] || 0,
        message: 'In recognition of outstanding contribution to community service.',
      });
      DB.notifications.create({
        userId: app.userId,
        message: `Your certificate for "${task.title}" is ready. Open Certificates in your dashboard to download it. 🎖️`,
        type: 'success',
        icon: '📜',
      });
    });
  }

  function toggleTaskStatus(taskId) {
    const task = DB.tasks.getById(taskId);
    if (!task) return;
    const newStatus = task.status === 'Complete' ? 'Open' : 'Complete';
    DB.tasks.update(taskId, { status: newStatus, completedDate: newStatus === 'Complete' ? new Date().toISOString().split('T')[0] : task.completedDate });
    if (newStatus === 'Complete') {
      const updated = DB.tasks.getById(taskId);
      _issueCertificatesForCompletedTask(updated);
    }
    showToast(`Task marked as "${newStatus}".`, 'success');
    _renderNgoTasks();
    _renderNgoQuickStats();
  }

  function confirmDeleteTask(taskId) {
    _showConfirmDialog(
      'Permanently delete this task and all its applications? This cannot be undone.',
      () => {
        DB.tasks.delete(taskId);
        showToast('Task deleted.', 'info');
        _renderNgoTasks();
        _renderNgoQuickStats();
      },
      'Delete Task'
    );
  }

  // ─────────────────────────────────────────────────────────────
  // SMART MATCH — NGO UI
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
  // CREATE TASK
  // ─────────────────────────────────────────────────────────────
  function toggleTaskSkill(el) {
    const skill = el.dataset.skill;
    el.classList.toggle('selected');
    if (el.classList.contains('selected')) {
      if (!_s.taskSkills.includes(skill)) _s.taskSkills.push(skill);
    } else {
      _s.taskSkills = _s.taskSkills.filter(s => s !== skill);
    }
  }

  function _resetCreateTaskForm() {
    _s.taskSkills = [];
    ['ct-title','ct-desc','ct-count','ct-custom-role'].forEach(id => { const e = _el(id); if (e) e.value = ''; });
    ['ct-priority','ct-location','ct-duration'].forEach(id => { const e = _el(id); if (e) e.selectedIndex = 0; });
    document.querySelectorAll('#ct-skill-chips .skill-chip').forEach(c => c.classList.remove('selected'));
    const errEl = _el('ct-error');
    if (errEl) { errEl.classList.add('hidden'); errEl.textContent = ''; }
  }

  function createTask() {
    const user   = Auth.getCurrentUser();
    if (!user) return;
    const title      = (_el('ct-title')?.value        || '').trim();
    const desc       = (_el('ct-desc')?.value         || '').trim();
    const priority   = _el('ct-priority')?.value      || '';
    const location   = _el('ct-location')?.value      || '';
    const count      = parseInt(_el('ct-count')?.value || '1');
    const duration   = _el('ct-duration')?.value      || '';
    const customRole = (_el('ct-custom-role')?.value   || '').trim();

    if (!title)    { _showFormError('ct-error', 'Task title is required.');         return; }
    if (!desc)     { _showFormError('ct-error', 'Full description is required.');    return; }
    if (!priority) { _showFormError('ct-error', 'Please select a priority level.');  return; }
    if (!location) { _showFormError('ct-error', 'Please select a location.');        return; }

    const ngoUser = DB.users.getById(user.uid);
    const taskId  = DB.tasks.create({
      title, description: desc,
      requiredSkills: [..._s.taskSkills],
      customRole,
      priority, location,
      volunteersNeeded: isNaN(count) ? 1 : count,
      duration: duration || 'TBD',
      ngoId:    user.uid,
      ngoName:  user.displayName,
      ngoContact: `${ngoUser?.contactEmail || user.email} | ${ngoUser?.contactPhone || ''}`,
    });

    // Notify volunteers with 60%+ match score
    const newTask = DB.tasks.getById(taskId);
    DB.users.getVolunteers().forEach(vol => {
      const score = _calcMatchScore(vol, newTask);
      if (score >= 60) {
        DB.notifications.create({
          userId:  vol.uid,
          message: `New task "${title}" matches your profile ${score}%! Check opportunities.`,
          type: 'match', icon: '🎯',
        });
      }
    });

    _updateNotifBadge();
    showToast(`Task "${title}" published successfully! 🚀`, 'success');
    showPage('ngo-dash');
  }

  // ─────────────────────────────────────────────────────────────
  // MAP VIEW
  // ─────────────────────────────────────────────────────────────
  function _renderMap(containerId) {
    const container = _el(containerId);
    if (!container) return;
    const tasks    = DB.tasks.getAll().filter(t => t.status !== 'Complete');
    const pinHtml  = tasks.map(task => {
      const pos = MAP_POSITIONS[task.location] || { x:50, y:50 };
      const emo = { Critical:'🚨', High:'⚡', Medium:'📌', Low:'✅' }[task.priority] || '📌';
      return `
      <div class="map-pin" style="left:${pos.x}%;top:${pos.y}%">
        <div class="pin-body pin-${task.priority}"><span>${emo}</span></div>
        <div class="pin-tooltip">${task.title}<br><small>${task.location} · ${task.priority}</small></div>
      </div>`;
    }).join('');

    const cityLabels = Object.entries(MAP_POSITIONS).map(([city, pos]) =>
      `<div class="map-city-label" style="left:${pos.x}%;top:${pos.y + 6}%">${city}</div>`
    ).join('');

    container.innerHTML = `
      <div class="map-bg">
        <div class="map-road-h" style="top:30%;left:5%;width:90%"></div>
        <div class="map-road-h" style="top:55%;left:10%;width:80%"></div>
        <div class="map-road-h" style="top:70%;left:15%;width:65%"></div>
        <div class="map-road-v" style="left:35%;top:10%;height:80%"></div>
        <div class="map-road-v" style="left:60%;top:5%;height:75%"></div>
        <div class="map-road-v" style="left:80%;top:20%;height:60%"></div>
        <div class="map-block"  style="left:12%;top:40%;width:8%;height:10%"></div>
        <div class="map-block"  style="left:40%;top:22%;width:12%;height:8%"></div>
        <div class="map-block"  style="left:62%;top:38%;width:10%;height:12%"></div>
        <div class="map-water"  style="left:5%;top:60%;width:13%;height:22%"></div>
        <div class="map-water"  style="left:73%;top:20%;width:9%;height:14%"></div>
        ${cityLabels}
        ${pinHtml}
        <div class="map-legend">
          <div style="font-size:0.72rem;font-weight:700;margin-bottom:7px">Priority</div>
          <div class="legend-item"><div class="legend-dot" style="background:var(--red)"></div>Critical</div>
          <div class="legend-item"><div class="legend-dot" style="background:var(--amber)"></div>High</div>
          <div class="legend-item"><div class="legend-dot" style="background:var(--blue-mid)"></div>Medium</div>
          <div class="legend-item"><div class="legend-dot" style="background:var(--green-mid)"></div>Low</div>
        </div>
      </div>`;
  }

  // ─────────────────────────────────────────────────────────────
  // ANALYTICS (NGO ONLY)
  // ─────────────────────────────────────────────────────────────
  function _renderAnalytics() {
    if (!Auth.hasRole('ngo')) {
      showToast('Analytics is only available for NGOs.', 'warning');
      showPage('landing'); return;
    }
    const summary = DB.analytics.getSummary();
    _renderKPIs(summary);
    _renderMoneySavedFilter();
    _renderSkillChart(summary.skillCounts);
    _renderActivityTimeline(summary.recentActivity);
    _renderCrisisLocations(summary.locationMap);
  }

  function _renderMoneySavedFilter() {
    const el = _el('money-saved-filter-container');
    if (!el) return;

    const completedTasks = DB.moneySavedFilter.getCompletedTaskList();
    const filterVal      = _s.moneySavedFilter || 'week';
    const projectId      = _s.moneySavedProjectId;
    const result         = DB.moneySavedFilter.get(filterVal, projectId);

    el.innerHTML = `
      <div class="chart-card" style="margin-bottom:16px">
        <div class="chart-title">💰 Money Saved Breakdown (demo ₹ equiv. @ ₹1,850/hr)</div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">
          <div style="display:flex;background:var(--slate-100);border-radius:var(--radius-md);padding:3px;gap:2px">
            ${['day','week','project'].map(f=>`
              <button onclick="App._setMoneySavedFilter('${f}')" style="padding:5px 14px;border-radius:var(--radius-sm);font-size:.8rem;font-weight:600;border:none;cursor:pointer;transition:all .18s;background:${filterVal===f?'white':'transparent'};color:${filterVal===f?'var(--blue-mid)':'var(--text-3)'};box-shadow:${filterVal===f?'var(--shadow-sm)':'none'}">${f==='day'?'Today':f==='week'?'This Week':'By Project'}</button>`).join('')}
          </div>
          ${filterVal === 'project' ? `
            <select class="form-select" style="width:220px;padding:6px 12px" onchange="App._setMoneySavedProject(this.value)">
              <option value="">Select a project…</option>
              ${completedTasks.map(t=>`<option value="${t.id}" ${t.id===projectId?'selected':''}>${t.title.slice(0,40)}</option>`).join('')}
            </select>` : ''}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div style="text-align:center;padding:20px;background:var(--blue-50);border-radius:var(--radius-lg)">
            <div style="font-size:1.8rem;font-weight:800;color:var(--blue-mid)">${result.hours}h</div>
            <div style="font-size:.78rem;color:var(--text-muted)">Hours Contributed</div>
          </div>
          <div style="text-align:center;padding:20px;background:var(--amber-50);border-radius:var(--radius-lg)">
            <div style="font-size:1.8rem;font-weight:800;color:var(--amber)">₹${_fmtNum(result.hours * 1850)}</div>
            <div style="font-size:.78rem;color:var(--text-muted)">Estimated Value Saved</div>
          </div>
        </div>
      </div>`;
  }

  function _setMoneySavedFilter(f) {
    _s.moneySavedFilter = f;
    if (f !== 'project') _s.moneySavedProjectId = null;
    _renderMoneySavedFilter();
  }

  function _setMoneySavedProject(id) {
    _s.moneySavedProjectId = id || null;
    _renderMoneySavedFilter();
  }

  function _renderKPIs(s) {
    _setHtml('kpi-grid', [
      { label:'Total Volunteers', val:s.totalVolunteers, icon:'👥', color:'kpi-blue',   suffix:'', change:`+${Math.max(1,Math.floor(s.totalVolunteers*0.12))} this month` },
      { label:'Hours Contributed', val:s.totalHours, icon:'⏱️',  color:'kpi-green',  suffix:'h',change:`+${Math.max(2,Math.floor(s.totalHours*0.08))}h this month` },
      { label:'Task Success Rate', val:s.successRate, icon:'🎯',  color:'kpi-purple', suffix:'%',change:s.completedTasks+' tasks completed' },
      { label:'Money Saved (est.)', val:'$'+_fmtNum(s.moneySaved), icon:'💰', color:'kpi-amber', suffix:'', change:`@ $25/hr · ${s.totalHours}h` },
    ].map(k => `
      <div class="kpi-card ${k.color}">
        <div class="kpi-icon" style="background:var(--slate-100)">${k.icon}</div>
        <div class="kpi-val">${typeof k.val === 'number' ? k.val + k.suffix : k.val}</div>
        <div class="kpi-lbl">${k.label}</div>
        <div class="kpi-change kpi-up">↑ ${k.change}</div>
      </div>`).join(''));
  }

  function _renderSkillChart(skillCounts) {
    const SKILL_COLORS = {
      Medical:'#dc2626', Tech:'#1d4ed8', Logistics:'#d97706',
      Teaching:'#7c3aed', Counseling:'#16a34a', Construction:'#ea580c',
    };
    const max = Math.max(...Object.values(skillCounts), 1);
    _setHtml('skill-chart',
      Object.entries(skillCounts).map(([skill, count]) => `
        <div class="skill-bar-row">
          <div class="skill-bar-name">${_skillEmoji(skill)} ${skill}</div>
          <div class="skill-bar-track">
            <div class="skill-bar-fill" style="width:0%;background:${SKILL_COLORS[skill]||'var(--blue-mid)'}" data-pct="${Math.round((count/max)*100)}"></div>
          </div>
          <div class="skill-bar-count" style="color:${SKILL_COLORS[skill]||'var(--blue-mid)'}">${count}</div>
        </div>`).join('')
    );
    requestAnimationFrame(() => {
      document.querySelectorAll('#skill-chart .skill-bar-fill').forEach(el => {
        el.style.width = el.dataset.pct + '%';
      });
    });
  }

  function _renderActivityTimeline(activities) {
    if (!activities.length) {
      _setHtml('activity-timeline', `<div style="font-size:0.85rem;color:var(--text-muted);padding:20px 0">No activity yet.</div>`);
      return;
    }
    _setHtml('activity-timeline', activities.map(a => `
      <div class="timeline-item">
        <div class="timeline-dot" style="background:${a.color}"></div>
        <div>
          <div class="timeline-msg">${a.icon} ${a.msg}</div>
          <div class="timeline-time">${a.time}</div>
        </div>
      </div>`).join(''));
  }

  function _renderCrisisLocations(locationMap) {
    const entries = Object.entries(locationMap);
    if (!entries.length) {
      _setHtml('crisis-list', `<div style="font-size:0.85rem;color:var(--text-muted);padding:10px 0">No task data.</div>`);
      return;
    }
    _setHtml('crisis-list', entries.map(([loc, data]) => {
      const pct = data.total > 0 ? Math.round((data.complete / data.total) * 100) : 0;
      return `
      <div class="crisis-item">
        <div class="crisis-header">
          <span class="crisis-loc">📍 ${loc}</span>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:0.78rem;color:var(--text-muted)">${data.complete}/${data.total} completed</span>
            <span style="font-weight:700;font-size:0.88rem;color:${pct===100?'var(--green-mid)':pct>50?'var(--amber)':'var(--red)'}">${pct}%</span>
          </div>
        </div>
        <div class="crisis-track">
          <div class="crisis-fill-done" style="width:${pct}%;transition:width 1.2s cubic-bezier(0.4,0,0.2,1)"></div>
        </div>
        <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:5px">
          ${data.tasks.map(t => `<span class="badge ${t.status==='Complete'?'badge-green':'badge-slate'}">${t.title.slice(0,28)}${t.title.length>28?'…':''}</span>`).join('')}
        </div>
      </div>`;
    }).join(''));

    // Animate crisis bars
    setTimeout(() => {
      document.querySelectorAll('.crisis-fill-done').forEach(el => {
        const w = el.style.width;
        el.style.width = '0%';
        requestAnimationFrame(() => { el.style.width = w; });
      });
    }, 50);
  }

  // ─────────────────────────────────────────────────────────────
  // GLOBAL CLICK — close panels when clicking outside
  // ─────────────────────────────────────────────────────────────
  document.addEventListener('click', e => {
    const panel   = _el('notif-panel');
    const notifBtn = _el('notif-btn');
    if (panel?.classList.contains('open') && !panel.contains(e.target) && !notifBtn?.contains(e.target)) {
      _closeNotifPanel();
    }
  });

  // Confirm modal button
  document.addEventListener('DOMContentLoaded', () => {
    const confirmBtn = _el('modal-confirm-btn');
    if (confirmBtn) confirmBtn.addEventListener('click', _executeConfirm);
  });

  function handleGlobalSearch(term) {
    const q = (term || '').toLowerCase().trim();
    const dd = _el('global-search-dropdown');
    if (!dd) return;

    if (q.length < 2) { dd.classList.add('hidden'); return; }

    const user    = Auth.getCurrentUser();
    const isNgo   = user?.role === 'ngo';
    const vols    = DB.users.getVolunteers().filter(v =>
      v.displayName.toLowerCase().includes(q) || (v.email || '').toLowerCase().includes(q)
    );
    const ngos    = DB.users.getNGOs ? DB.users.getNGOs().filter(n =>
      n.displayName.toLowerCase().includes(q) || (n.orgName || '').toLowerCase().includes(q)
    ) : [];
    const tasks   = DB.tasks.getAll().filter(t =>
      t.title.toLowerCase().includes(q) || (t.location || '').toLowerCase().includes(q)
    );

    if (!vols.length && !ngos.length && !tasks.length) {
      dd.innerHTML = `<div class="gs-no-results">No results for "<b>${_esc(term)}</b>"</div>`;
      dd.classList.remove('hidden'); return;
    }

    let html = '';

    if (vols.length) {
      html += `<div class="gs-group-label">Volunteers</div>`;
      html += vols.slice(0, 3).map(v => {
        const color = _avatarColor(v.displayName);
        const avg   = DB.ngoRatings ? DB.ngoRatings.getAvg(v.uid) : null;
        return `
        <div class="gs-item">
          <div class="gs-avatar" style="background:${color}">${_initials(v.displayName)}</div>
          <div class="gs-info">
            <div class="gs-name">${v.displayName}</div>
            <div class="gs-sub">🙌 ${v.location} · ${(v.skills||[]).join(', ')}${avg ? ` · ⭐${avg}` : ''}</div>
          </div>
          <div class="gs-actions">
            <button class="btn btn-ghost btn-xs" onclick="App.openProfileModal('${v.uid}');App.closeSearch()">Profile</button>
            ${isNgo ? `<button class="btn btn-primary btn-xs" onclick="App.openInviteToTaskModal('${v.uid}','${_esc(v.displayName)}');App.closeSearch()">Invite</button>` : ''}
            <button class="btn btn-ghost btn-xs" onclick="App.openMessageModal('${v.uid}','${_esc(v.displayName)}');App.closeSearch()">💬</button>
          </div>
        </div>`;
      }).join('');
    }

    if (ngos.length) {
      html += `<div class="gs-group-label">NGOs</div>`;
      html += ngos.slice(0, 3).map(n => {
        const avg = DB.ngoRatings ? DB.ngoRatings.getAvg(n.uid) : null;
        return `
        <div class="gs-item">
          <div class="gs-avatar" style="background:var(--green-mid)">🏢</div>
          <div class="gs-info">
            <div class="gs-name">${n.displayName}</div>
            <div class="gs-sub">${n.city || n.location}${avg ? ` · ⭐${avg}` : ''}</div>
          </div>
          <div class="gs-actions">
            <button class="btn btn-ghost btn-xs" onclick="App.openNgoProfilePage('${n.uid}');App.closeSearch()">View Tasks</button>
            <button class="btn btn-ghost btn-xs" onclick="App.openMessageModal('${n.uid}','${_esc(n.displayName)}');App.closeSearch()">💬</button>
          </div>
        </div>`;
      }).join('');
    }

    if (tasks.length) {
      html += `<div class="gs-group-label">Tasks</div>`;
      html += tasks.slice(0, 3).map(t => `
        <div class="gs-item">
          <div class="gs-avatar" style="background:var(--blue-mid)">📋</div>
          <div class="gs-info">
            <div class="gs-name">${t.title}</div>
            <div class="gs-sub">${t.priority} · ${t.location} · ${t.ngoName}</div>
          </div>
          <div class="gs-actions">
            <button class="btn btn-ghost btn-xs" onclick="App.showTaskDetailModal('${t.id}');App.closeSearch()">Details</button>
          </div>
        </div>`).join('');
    }

    dd.innerHTML = html;
    dd.classList.remove('hidden');
  }

  function closeSearch() {
    _el('global-search-dropdown')?.classList.add('hidden');
    const inp = _el('global-search-input');
    if (inp) inp.value = '';
  }

  // helper — HTML escape for inline strings
  function _esc(str) { return (str||'').replace(/'/g, '&#39;').replace(/"/g, '&quot;'); }


// ────────────────────────────────────────────────────────────
// [3] NGO PROFILE PAGE — ADD before _init()
// ────────────────────────────────────────────────────────────
//
// Also: in showNgoTab(), ADD 'ngo-profile' to the tab list.
// The page element is added to index.html (see index_additions).
//
  function openNgoProfilePage(ngoId) {
    const ngo   = DB.users.getById(ngoId);
    if (!ngo)   { showToast('NGO not found.', 'error'); return; }
    const user  = Auth.getCurrentUser();
    const isVol = user?.role === 'volunteer';
    const tasks = DB.tasks.getAll().filter(t => t.ngoId === ngoId);
    const avg   = DB.ngoRatings ? DB.ngoRatings.getAvg(ngoId) : null;
    const ratings = DB.ngoRatings ? DB.ngoRatings.getByNgo(ngoId) : [];
    const donTotal = DB.donations ? DB.donations.getTotalForNgo(ngoId) : 0;
    const color = _avatarColor(ngo.displayName);

    // Render into the dedicated NGO profile page
    const page = _el('page-ngo-profile');
    if (!page) return;

    const starsHtml = avg
      ? `<div style="display:flex;align-items:center;gap:6px;margin-top:4px">
          ${[1,2,3,4,5].map(i=>`<span style="color:${i<=Math.round(avg)?'var(--amber)':'var(--slate-200)'}">★</span>`).join('')}
          <span style="font-size:.82rem;color:rgba(255,255,255,.6)">${avg}/5 (${ratings.length} rating${ratings.length!==1?'s':''})</span>
         </div>`
      : '<div style="font-size:.78rem;color:rgba(255,255,255,.5);margin-top:4px">No ratings yet</div>';

    page.innerHTML = `
      <div class="section-wrapper">
        <!-- Hero -->
        <div class="ngo-profile-hero" style="background:linear-gradient(135deg,var(--navy),var(--navy-mid));border-radius:var(--radius-xl);padding:28px;margin-bottom:24px;display:flex;align-items:flex-start;gap:20px;flex-wrap:wrap">
          <div style="width:64px;height:64px;border-radius:var(--radius-lg);background:${color};display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:800;color:white;flex-shrink:0">${_initials(ngo.displayName)}</div>
          <div style="flex:1;min-width:200px">
            <div style="font-size:1.3rem;font-weight:800;color:white">${ngo.displayName}</div>
            <div style="font-size:.82rem;color:rgba(255,255,255,.55);margin-top:3px">📍 ${ngo.city||ngo.location} · ${ngo.contactEmail||ngo.email}</div>
            ${starsHtml}
            <div style="margin-top:12px;font-size:.88rem;color:rgba(255,255,255,.7);line-height:1.6">${ngo.bio||'No description provided.'}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0">
            ${isVol ? `
              <button class="btn btn-emerald btn-sm" onclick="App.openDonationModal('${ngo.uid}','${_esc(ngo.displayName)}')">💚 Donate ₹</button>
              <button class="btn btn-outline-light btn-sm" onclick="App.openRateNgoModal('${ngo.uid}','${_esc(ngo.displayName)}')">⭐ Rate NGO</button>
              <button class="btn btn-ghost btn-sm" style="color:rgba(255,255,255,.6)" onclick="App.openMessageModal('${ngo.uid}','${_esc(ngo.displayName)}')">💬 Message</button>
            ` : ''}
            <button class="btn btn-ghost btn-sm" style="color:rgba(255,255,255,.6)" onclick="App._goBack()">← Back</button>
          </div>
        </div>

        <!-- Stats row -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px">
          ${[
            ['📋','Total Tasks', tasks.length],
            ['✅','Completed', tasks.filter(t=>t.status==='Complete').length],
            ['👥','Total Applied', tasks.reduce((s,t)=>s+(t.applications||[]).length,0)],
            ['💚','Donations', donTotal>0?`₹${_fmtNum(donTotal)}`:'—'],
          ].map(([ic,lb,val])=>`
            <div class="kpi-card" style="padding:16px">
              <div style="font-size:1.2rem;margin-bottom:6px">${ic}</div>
              <div style="font-size:1.4rem;font-weight:800;letter-spacing:-.02em">${val}</div>
              <div style="font-size:.75rem;color:var(--text-muted)">${lb}</div>
            </div>`).join('')}
        </div>

        <!-- Tasks published by this NGO -->
        <h3 style="font-size:1rem;font-weight:700;margin-bottom:14px">Tasks by ${ngo.displayName}</h3>
        ${tasks.length === 0
          ? _emptyState('📋','No tasks posted yet','')
          : tasks.map(task => {
              const vol  = user ? DB.users.getById(user.uid) : null;
              const applied = vol ? (task.applications||[]).find(a=>a.userId===vol.uid) : null;
              const skillsHtml = (task.requiredSkills||[]).map(s=>`<span class="badge badge-navy">${_skillEmoji(s)} ${s}</span>`).join('');
              return `
              <div class="task-card priority-${task.priority}" style="cursor:default">
                <div class="task-card-header">
                  <div>
                    <div class="task-card-title">${task.title}</div>
                    <div class="task-card-ngo">📍 ${task.location} · ⏱️ ${task.duration||'TBD'}</div>
                  </div>
                  <div class="task-card-badges">${_priorityBadge(task.priority)} ${_statusBadge(task.status)}</div>
                </div>
                <div class="task-desc">${task.description}</div>
                <div class="task-skills">${skillsHtml}</div>
                <div class="task-actions">
                  <button class="btn btn-ghost btn-sm" onclick="App.showTaskDetailModal('${task.id}')">View Details</button>
                  ${isVol && task.status==='Open' && !applied ? `<button class="btn btn-emerald btn-sm" onclick="App.applyToTask('${task.id}')">Apply Now</button>` : ''}
                  ${applied ? `<span class="badge badge-green">Applied ✓</span>` : ''}
                </div>
              </div>`;
            }).join('')}

        <!-- Ratings section -->
        ${ratings.length ? `
          <h3 style="font-size:1rem;font-weight:700;margin:24px 0 14px">Volunteer Ratings</h3>
          <div class="card">
            ${ratings.map(r=>`
              <div class="rating-item">
                <div>
                  <div style="font-size:.82rem;font-weight:600">${r.byName}</div>
                  <div style="font-size:.72rem;color:var(--text-muted)">${r.date}</div>
                  <div style="display:flex;gap:2px;margin-top:3px">${[1,2,3,4,5].map(i=>`<span style="color:${i<=r.score?'var(--amber)':'var(--slate-200)'}">★</span>`).join('')}</div>
                  ${r.note?`<div style="font-size:.8rem;color:var(--text-3);margin-top:4px">"${r.note}"</div>`:''}
                </div>
              </div>`).join('')}
          </div>` : ''}
      </div>`;

    showPage('ngo-profile');
  }

  function _goBack() {
    const user = Auth.getCurrentUser();
    if (!user) { showPage('landing'); return; }
    showPage(user.role === 'volunteer' ? 'vol-dash' : 'ngo-dash');
  }


// ────────────────────────────────────────────────────────────
// [4] RATE NGO MODAL — ADD before _init()
// ────────────────────────────────────────────────────────────

  let _rateNgoTarget = null; // { uid, name }
  let _selectedNgoStars = 0;

  function openRateNgoModal(ngoId, ngoName) {
    if (!Auth.requireAuth()) return;
    _rateNgoTarget = { uid: ngoId, name: ngoName };
    _selectedNgoStars = 0;
    _set('modal-rate-ngo-title', `Rate: ${ngoName}`);
    _set('modal-rate-ngo-note', '');
    // Reset stars UI
    document.querySelectorAll('#modal-rate-ngo .star-btn').forEach(b => b.classList.remove('active'));
    openModal('modal-rate-ngo');
  }

  function selectNgoStar(val) {
    _selectedNgoStars = val;
    document.querySelectorAll('#modal-rate-ngo .star-btn').forEach(b => {
      b.classList.toggle('active', Number(b.dataset.val) <= val);
    });
  }

  function submitNgoRating() {
    if (!_rateNgoTarget) return;
    if (!_selectedNgoStars) { showToast('Please select a star rating.', 'warning'); return; }
    const user = Auth.getCurrentUser();
    const note = (_el('modal-rate-ngo-note-input')?.value || '').trim();
    DB.ngoRatings.add({
      ngoId:   _rateNgoTarget.uid,
      ngoName: _rateNgoTarget.name,
      byId:    user.uid,
      byName:  user.displayName,
      score:   _selectedNgoStars,
      note,
    });
    // Notify the NGO
    DB.notifications.create({
      userId:  _rateNgoTarget.uid,
      message: `${user.displayName} gave you ${_selectedNgoStars}★${note ? `: "${note}"` : ''}`,
      type: 'success', icon: '⭐',
    });
    closeModal('modal-rate-ngo');
    showToast(`Rated ${_rateNgoTarget.name} ${_selectedNgoStars}★ — thank you!`, 'success');
    _rateNgoTarget = null; _selectedNgoStars = 0;
    // Refresh NGO profile if visible
    if (_el('page-ngo-profile') && !_el('page-ngo-profile').classList.contains('hidden')) {
      openNgoProfilePage(DB.ngoRatings.getByNgo ? undefined : undefined);
    }
  }


// ────────────────────────────────────────────────────────────
// [5] DONATION MODAL (₹) — ADD before _init()
//     Replaces old openAddHoursModal approach.
//     Works for both "Support this NGO" and hero "Donate Now".
// ────────────────────────────────────────────────────────────

  function openDonationModal(ngoId, ngoName) {
    if (!Auth.requireAuth()) return;
    const el = _el('modal-donation-ngo-id');   if (el) el.value = ngoId;
    const en = _el('modal-donation-ngo-name'); if (en) en.value = ngoName;
    _set('modal-donation-ngo-label', `Donating to: <strong>${ngoName}</strong>`);
    const amtEl = _el('modal-donation-amount'); if (amtEl) amtEl.value = '';
    const noteEl = _el('modal-donation-note');  if (noteEl) noteEl.value = '';
    const errEl = _el('modal-donation-error');  if (errEl) errEl.classList.add('hidden');
    document.querySelectorAll('#modal-donation .donation-preset').forEach(b => b.classList.remove('active'));
    openModal('modal-donation');
  }

  function setDonationAmount(amt) {
    const el = _el('modal-donation-amount'); if (el) el.value = amt;
    document.querySelectorAll('#modal-donation .donation-preset').forEach(b =>
      b.classList.toggle('active', Number(b.dataset.amount) === amt)
    );
  }

  function submitDonation() {
    const ngoId   = _el('modal-donation-ngo-id')?.value;
    const ngoName = _el('modal-donation-ngo-name')?.value;
    const amount  = parseFloat(_el('modal-donation-amount')?.value || '');
    const note    = (_el('modal-donation-note')?.value || '').trim();
    const errEl   = _el('modal-donation-error');
    if (!amount || amount <= 0) {
      if (errEl) { errEl.textContent = '⚠️ Please enter a valid amount.'; errEl.classList.remove('hidden'); }
      return;
    }
    const user = Auth.getCurrentUser();
    DB.donations.create({
      fromUserId: user?.uid || 'guest',
      fromName:   user?.displayName || 'Anonymous',
      toNgoId:    ngoId,
      toNgoName:  ngoName,
      amount,
      note,
    });
    DB.notifications.create({
      userId:  ngoId,
      message: `${user?.displayName||'Someone'} donated ₹${amount}${note ? ` — "${note}"` : ''}`,
      type: 'success', icon: '💚',
    });
    closeModal('modal-donation');
    showToast(`₹${amount} donated to ${ngoName}! Thank you 💚`, 'success');
  }


// ────────────────────────────────────────────────────────────
// [6] BONUS MODAL (₹) — ADD before _init()
// ────────────────────────────────────────────────────────────

  function openBonusModal(volId, volName) {
    const el = _el('modal-bonus-vol-id');   if (el) el.value = volId;
    const en = _el('modal-bonus-vol-name'); if (en) en.value = volName;
    _set('modal-bonus-vol-label', `Rewarding: <strong>${volName}</strong>`);
    const amtEl = _el('modal-bonus-amount'); if (amtEl) amtEl.value = '';
    const noteEl = _el('modal-bonus-note');  if (noteEl) noteEl.value = '';
    document.querySelectorAll('#modal-bonus .donation-preset').forEach(b => b.classList.remove('active'));
    openModal('modal-bonus');
  }

  function setBonusAmount(amt) {
    const el = _el('modal-bonus-amount'); if (el) el.value = amt;
    document.querySelectorAll('#modal-bonus .donation-preset').forEach(b =>
      b.classList.toggle('active', Number(b.dataset.amount) === amt)
    );
  }

  function submitBonus() {
    const volId   = _el('modal-bonus-vol-id')?.value;
    const volName = _el('modal-bonus-vol-name')?.value;
    const amount  = parseFloat(_el('modal-bonus-amount')?.value || '');
    const note    = (_el('modal-bonus-note')?.value || '').trim();
    if (!amount || amount <= 0) { showToast('Please enter a valid bonus amount.', 'warning'); return; }
    const user = Auth.getCurrentUser();
    DB.bonuses.create({
      fromNgoId:  user?.uid,
      fromNgoName: user?.displayName,
      toVolId:    volId,
      toVolName:  volName,
      amount,
      note,
    });
    DB.notifications.create({
      userId:  volId,
      message: `🏆 ${user?.displayName} sent you a bonus of ₹${amount}${note ? ` — "${note}"` : ''}`,
      type: 'success', icon: '🏆',
    });
    closeModal('modal-bonus');
    showToast(`₹${amount} bonus sent to ${volName}! 🏆`, 'success');
    _renderNgoTasks();
  }


// ────────────────────────────────────────────────────────────
// [7] RATE VOLUNTEER MODAL (NGO side) — ADD before _init()
// ────────────────────────────────────────────────────────────

  let _rateVolTarget = null;
  let _selectedVolStars = 0;

  function openRateVolModal(volId, volName) {
    _rateVolTarget = { uid: volId, name: volName };
    _selectedVolStars = 0;
    _set('modal-rate-vol-title', `Rate: ${volName}`);
    const noteEl = _el('modal-rate-vol-note-input'); if (noteEl) noteEl.value = '';
    document.querySelectorAll('#modal-rate-vol .star-btn').forEach(b => b.classList.remove('active'));
    openModal('modal-rate-vol');
  }

  function selectVolStar(val) {
    _selectedVolStars = val;
    document.querySelectorAll('#modal-rate-vol .star-btn').forEach(b =>
      b.classList.toggle('active', Number(b.dataset.val) <= val)
    );
  }

  function submitVolRating() {
    if (!_rateVolTarget || !_selectedVolStars) { showToast('Please select a star rating.', 'warning'); return; }
    const user = Auth.getCurrentUser();
    const note = (_el('modal-rate-vol-note-input')?.value || '').trim();
    // Store on the volunteer user record
    const vol = DB.users.getById(_rateVolTarget.uid);
    if (vol) {
      const ratings = vol.ratings || [];
      const existing = ratings.findIndex(r => r.by === user.uid);
      const newRating = { by: user.uid, byName: user.displayName, score: _selectedVolStars, note, date: new Date().toISOString().split('T')[0] };
      if (existing > -1) ratings[existing] = newRating; else ratings.push(newRating);
      DB.users.update(_rateVolTarget.uid, { ratings });
    }
    DB.notifications.create({
      userId:  _rateVolTarget.uid,
      message: `${user.displayName} rated you ${_selectedVolStars}★${note ? ` — "${note}"` : ''}`,
      type: 'success', icon: '⭐',
    });
    closeModal('modal-rate-vol');
    showToast(`Rated ${_rateVolTarget.name} ${_selectedVolStars}★`, 'success');
    _rateVolTarget = null; _selectedVolStars = 0;
    _renderNgoVolPool();
  }


// ────────────────────────────────────────────────────────────
// [8] INVITE VOLUNTEER TO TASK (NGO global search action)
// ────────────────────────────────────────────────────────────

  function openInviteToTaskModal(volId, volName) {
    if (!Auth.requireAuth()) return;
    const user  = Auth.getCurrentUser();
    const tasks = DB.tasks.getAll().filter(t => t.ngoId === user.uid && t.status === 'Open');
    const el    = _el('modal-invite-body');
    if (!el) return;
    _set('modal-invite-title', `Invite ${volName} to a Task`);
    if (!tasks.length) {
      el.innerHTML = `<p class="modal-desc">You have no open tasks. <button class="link-btn" onclick="App.showPage('create-task');App.closeModal('modal-invite')">Post one now</button></p>`;
    } else {
      el.innerHTML = `
        <p class="modal-desc" style="margin-bottom:14px">Select a task to invite <strong>${volName}</strong> to:</p>
        ${tasks.map(t => `
          <div class="task-card priority-${t.priority}" style="margin-bottom:10px;cursor:pointer" onclick="App._sendInvite('${t.id}','${volId}','${_esc(volName)}')">
            <div class="task-card-title">${t.title}</div>
            <div class="task-card-ngo">📍 ${t.location} · ${t.priority} priority</div>
          </div>`).join('')}
        <div style="margin-top:14px;display:flex;justify-content:flex-end">
          <button class="btn btn-ghost" onclick="App.closeModal('modal-invite')">Cancel</button>
        </div>`;
    }
    openModal('modal-invite');
  }

  function _sendInvite(taskId, volId, volName) {
    const user = Auth.getCurrentUser();
    const task = DB.tasks.getById(taskId);
    DB.notifications.create({
      userId:  volId,
      message: `${user.displayName} (${user.displayName}) invited you to "${task.title}". Check Opportunities!`,
      type: 'match', icon: '📩',
    });
    // Also send a message
    DB.messages.send({
      fromId:   user.uid, fromName: user.displayName,
      toId:     volId,    toName:   volName,
      text: `Hi ${volName}! I'd like to invite you to volunteer for "${task.title}" (${task.location}). Check the task in your opportunities. Looking forward to working with you!`,
    });
    closeModal('modal-invite');
    showToast(`Invitation sent to ${volName}!`, 'success');
    _updateNotifBadge();
  }


// ────────────────────────────────────────────────────────────
// [9] MESSAGING SYSTEM — ADD before _init()
// ────────────────────────────────────────────────────────────

  let _activeChatContact = null;

  function openMessageModal(contactId, contactName) {
    if (!Auth.requireAuth()) return;
    _activeChatContact = { uid: contactId, name: contactName };
    _set('modal-message-title', `Message: ${contactName}`);
    _el('modal-message-input') && (_el('modal-message-input').value = '');
    _renderChatThread(contactId);
    openModal('modal-message');
    DB.messages.markThreadRead(Auth.getCurrentUser().uid, contactId);
    _updateMsgBadge();
  }

  function _renderChatThread(contactId) {
    const user    = Auth.getCurrentUser();
    const thread  = DB.messages.getThread(user.uid, contactId);
    const el      = _el('modal-message-thread');
    if (!el) return;
    if (!thread.length) {
      el.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:.85rem">Start the conversation 👋</div>`;
      return;
    }
    el.innerHTML = thread.map(m => {
      const isMine = m.fromId === user.uid;
      return `
      <div class="chat-bubble-wrap ${isMine ? 'mine' : 'theirs'}">
        <div class="chat-bubble ${isMine ? 'bubble-mine' : 'bubble-theirs'}">${m.text}</div>
        <div class="chat-time">${_timeAgo(m.createdAt)}</div>
      </div>`;
    }).join('');
    el.scrollTop = el.scrollHeight;
  }

  function sendChatMessage() {
    const user  = Auth.getCurrentUser();
    if (!user || !_activeChatContact) return;
    const input = _el('modal-message-input');
    const text  = (input?.value || '').trim();
    if (!text) return;
    DB.messages.send({
      fromId: user.uid, fromName: user.displayName,
      toId:   _activeChatContact.uid, toName: _activeChatContact.name,
      text,
    });
    if (input) input.value = '';
    _renderChatThread(_activeChatContact.uid);
  }

  function openInbox() {
    const user = Auth.getCurrentUser();
    if (!user) return;
    const threads = DB.messages.getInbox(user.uid);
    const el      = _el('inbox-panel');
    if (!el) return;
    el.classList.toggle('open');
    const list = _el('inbox-thread-list');
    if (!list) return;
    if (!threads.length) {
      list.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:.85rem">No messages yet.</div>`;
      return;
    }
    list.innerHTML = threads.map(t => `
      <div class="inbox-thread ${t.unread ? 'inbox-unread' : ''}" onclick="App.openMessageModal('${t.contactId}','${_esc(t.contactName)}')">
        <div class="inbox-thread-avatar" style="background:${_avatarColor(t.contactName)}">${_initials(t.contactName)}</div>
        <div class="inbox-thread-info">
          <div class="inbox-thread-name">${t.contactName}</div>
          <div class="inbox-thread-preview">${t.lastMessage.slice(0, 45)}${t.lastMessage.length > 45 ? '…' : ''}</div>
        </div>
        ${t.unread ? '<div class="inbox-unread-dot"></div>' : ''}
      </div>`).join('');
  }

  function _updateMsgBadge() {
    const user = Auth.getCurrentUser();
    const badge = _el('msg-badge');
    if (!badge || !user) return;
    const n = DB.messages.getUnreadCount(user.uid);
    badge.textContent = n > 9 ? '9+' : n;
    badge.classList.toggle('hidden', n === 0);
  }


// ────────────────────────────────────────────────────────────
// [10] VOLUNTEER — INCENTIVES TAB — ADD before _init()
// ────────────────────────────────────────────────────────────

  function _renderIncentives() {
    const user = Auth.getCurrentUser();
    if (!user) return;
    const el = _el('vol-tab-incentives');
    if (!el) return;

    const bonuses = DB.bonuses.getByVol(user.uid);
    const total   = DB.bonuses.getTotalForVol(user.uid);

    el.innerHTML = `
      <div class="dash-tab-header">
        <div><h2 class="dash-title">Incentives Received</h2><p class="dash-sub">Bonuses awarded by NGOs for your outstanding work</p></div>
      </div>
      ${total > 0 ? `
        <div class="highlight-box" style="background:linear-gradient(135deg,var(--amber-50),#fffbeb);border:1px solid var(--amber-100);border-radius:var(--radius-lg);padding:20px;margin-bottom:20px;display:flex;align-items:center;gap:16px">
          <div style="font-size:2rem">🏆</div>
          <div>
            <div style="font-size:1.5rem;font-weight:800;color:var(--amber)">₹${_fmtNum(total)}</div>
            <div style="font-size:.82rem;color:var(--text-3)">Total incentives earned · ${bonuses.length} bonus${bonuses.length!==1?'es':''}</div>
          </div>
        </div>` : ''}
      ${bonuses.length === 0 ? _emptyState('🏆', 'No incentives yet', 'NGOs can send you bonus rewards after you complete tasks. Keep contributing!') : `
        <div style="display:flex;flex-direction:column;gap:10px">
          ${bonuses.map(b => `
            <div class="card" style="display:flex;align-items:center;gap:14px;padding:16px 20px">
              <div style="width:42px;height:42px;border-radius:50%;background:var(--amber-50);border:2px solid var(--amber-100);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">🏆</div>
              <div style="flex:1">
                <div style="font-weight:700;font-size:.95rem">₹${_fmtNum(Number(b.amount))}</div>
                <div style="font-size:.8rem;color:var(--text-3)">From ${b.fromNgoName} · ${new Date(b.date).toLocaleDateString('en-IN')}</div>
                ${b.note ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:3px;font-style:italic">"${b.note}"</div>` : ''}
              </div>
              <span class="badge badge-amber">₹${_fmtNum(Number(b.amount))}</span>
            </div>`).join('')}
        </div>`}`;
  }


// ────────────────────────────────────────────────────────────
// [11] NGO — DONATIONS RECEIVED TAB — ADD before _init()
// ────────────────────────────────────────────────────────────

  function _renderNgoDonations() {
    const user = Auth.getCurrentUser();
    if (!user) return;
    const el = _el('ngo-tab-donations');
    if (!el) return;

    const donations = DB.donations.getByNgo(user.uid);
    const total     = DB.donations.getTotalForNgo(user.uid);

    el.innerHTML = `
      <div class="dash-tab-header">
        <div><h2 class="dash-title">Donations Received</h2><p class="dash-sub">Demo ₹ contributions from supporters</p></div>
      </div>
      ${total > 0 ? `
        <div style="background:var(--green-50);border:1px solid var(--green-100);border-radius:var(--radius-lg);padding:20px;margin-bottom:20px;display:flex;align-items:center;gap:16px">
          <div style="font-size:2rem">💚</div>
          <div>
            <div style="font-size:1.5rem;font-weight:800;color:var(--green-mid)">₹${_fmtNum(total)}</div>
            <div style="font-size:.82rem;color:var(--text-3)">Total received · ${donations.length} donation${donations.length!==1?'s':''} (demo)</div>
          </div>
        </div>` : ''}
      ${donations.length === 0 ? _emptyState('💚', 'No donations yet', 'When supporters donate to your NGO, they will appear here.') : `
        <div style="display:flex;flex-direction:column;gap:10px">
          ${donations.map(d => `
            <div class="card" style="display:flex;align-items:center;gap:14px;padding:16px 20px">
              <div style="width:42px;height:42px;border-radius:50%;background:var(--green-50);border:2px solid var(--green-100);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">💚</div>
              <div style="flex:1">
                <div style="font-weight:700;font-size:.95rem">₹${_fmtNum(Number(d.amount))}</div>
                <div style="font-size:.8rem;color:var(--text-3)">From ${d.fromName} · ${new Date(d.date).toLocaleDateString('en-IN')}</div>
                ${d.note ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:3px;font-style:italic">"${d.note}"</div>` : ''}
              </div>
              <span class="badge badge-green">₹${_fmtNum(Number(d.amount))}</span>
            </div>`).join('')}
        </div>`}`;
  }

// ────────────────────────────────────────────────────────────────
// VOLUNTEER — INCENTIVES TAB
// ────────────────────────────────────────────────────────────────

  function _renderIncentives() {
    const el = _el('vol-incentives');
    if (!el) return;

    const user = Auth.getCurrentUser();
    if (!user) return;

    const bonuses = Object.values((function() {
      try { return JSON.parse(localStorage.getItem('vb2_database') || '{}').bonuses || {}; } catch { return {}; }
    }())).filter(b => b.volId === user.uid);

    el.innerHTML = bonuses.length === 0
      ? _emptyState('💰', 'No bonuses yet', 'Complete tasks to earn bonuses from NGOs.')
      : bonuses.map(b => `
        <div class="card">
          <div class="card-header">
            <div class="card-title">₹${_fmtNum(b.amount)} Bonus</div>
            <div class="card-meta">${new Date(b.date).toLocaleDateString('en-IN')}</div>
          </div>
          <div class="card-body">
            <p>From <strong>${b.fromName}</strong> for task: <em>${b.taskTitle}</em></p>
            ${b.note ? `<p style="font-style:italic;color:var(--text-3)">"${b.note}"</p>` : ''}
          </div>
        </div>`).join('');
  }

// ────────────────────────────────────────────────────────────────
// CERTIFICATES TAB — Volunteer achievements
// ────────────────────────────────────────────────────────────────

  function _renderCertificates() {
    const el = _el('vol-tab-certificates');
    if (!el) { console.warn('Certificates element not found'); return; }

    const user = Auth.getCurrentUser();
    if (!user) { el.innerHTML = '<p style="padding:20px">Please log in to view certificates.</p>'; return; }

    const issued = Object.values(DB._read().certificates || {}).filter(c => c.recipientId === user.uid);
    const issuedByTask = new Map(issued.map(c => [c.taskId, c]));

    const eligibleTasks = DB.tasks.getAll().filter(t => {
      if (t.status !== 'Complete') return false;
      const app = (t.applications || []).find(a => a.userId === user.uid && a.status === 'approved');
      return !!app;
    });

    const rows = [];
    eligibleTasks.forEach(t => {
      const cert = issuedByTask.get(t.id);
      const sortKey = new Date(cert?.issuedDate || t.completedDate || t.postedDate || 0).getTime();
      if (cert) {
        rows.push({ sortKey, kind: 'issued', cert });
      } else {
        rows.push({
          sortKey,
          kind: 'eligible',
          taskId: t.id,
          taskTitle: t.title,
          ngoName: t.ngoName,
          hours: (t.hoursLogged || {})[user.uid] || 0,
          labelDate: t.completedDate || t.postedDate,
        });
      }
    });

    rows.sort((a, b) => b.sortKey - a.sortKey);

    let html = `
      <div class="dash-tab-header">
        <div>
          <h2 class="dash-title">🎖️ My Certificates</h2>
          <p class="dash-sub">Download certificates for tasks you completed with an NGO (approved volunteers only).</p>
        </div>
      </div>
    `;

    if (!rows.length) {
      html += _emptyState('🏅', 'No certificates yet', 'When you are approved on a task and the NGO marks it complete, your certificate appears here.');
      el.innerHTML = html;
      return;
    }

    html += rows.map(row => {
      if (row.kind === 'issued') {
        const cert = row.cert;
        return `
        <div class="card" style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:12px">
            <div style="flex:1">
              <div style="font-size:1.1rem;font-weight:700">${cert.taskTitle || 'Task'}</div>
              <div style="font-size:.85rem;color:var(--text-2);margin-top:2px">by <strong>${cert.ngoName || 'NGO'}</strong></div>
            </div>
            <span class="badge badge-blue">${cert.hoursContributed || 0}h</span>
          </div>
          <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:12px">
            📅 Issued ${new Date(cert.issuedDate || Date.now()).toLocaleDateString('en-IN')}
          </div>
          <div style="padding-top:12px;border-top:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" onclick="App.downloadCertificate('${cert.id}')">📥 Download certificate</button>
          </div>
        </div>`;
      }
      return `
        <div class="card" style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:12px">
            <div style="flex:1">
              <div style="font-size:1.1rem;font-weight:700">${row.taskTitle || 'Task'}</div>
              <div style="font-size:.85rem;color:var(--text-2);margin-top:2px">by <strong>${row.ngoName || 'NGO'}</strong></div>
            </div>
            <span class="badge badge-green">Ready</span>
          </div>
          <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:12px">
            📅 Task completed ${new Date(row.labelDate || Date.now()).toLocaleDateString('en-IN')} · ${row.hours}h logged
          </div>
          <div style="padding-top:12px;border-top:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" onclick="App.generateCertificateForVol('${row.taskId}','${user.uid}')">📥 Download certificate</button>
          </div>
        </div>`;
    }).join('');

    el.innerHTML = html;
  }

// ────────────────────────────────────────────────────────────────
// HELPERS  (helpers used across new features)
// ────────────────────────────────────────────────────────────────

  /** ₹ formatted number */
  function _rupee(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }

  /** Verified badge HTML */
  function _verifiedBadge(user) {
    return user?.verified
      ? `<span class="verified-badge" title="Verified">✓</span>`
      : '';
  }

  /** Average star rating */
  function _avgRating(ratings) {
    if (!ratings || !ratings.length) return null;
    return (ratings.reduce((s, r) => s + r.score, 0) / ratings.length).toFixed(1);
  }

  /** Star HTML display */
  function _starDisplay(avg) {
    if (!avg) return '';
    const full = Math.round(avg);
    return [1,2,3,4,5].map(i =>
      `<span style="color:${i<=full?'var(--amber)':'var(--slate-200)'};font-size:.8rem">★</span>`
    ).join('');
  }


// ────────────────────────────────────────────────────────────────
// LEADERBOARD PAGE
// ────────────────────────────────────────────────────────────────

  function _renderLeaderboard() {
    const el = _el('page-leaderboard');
    if (!el) return;

    const vols = DB.users.getVolunteers()
      .sort((a, b) => (b.hours || 0) - (a.hours || 0));

    const medals = ['🥇', '🥈', '🥉'];
    const rankColors = ['#d97706', '#64748b', '#7c3aed'];

    el.innerHTML = `
      <div class="section-wrapper">
        <div class="page-header-row">
          <div>
            <div class="eyebrow dark">✦ Community</div>
            <h2 class="page-title">Volunteer Leaderboard</h2>
            <p class="page-sub">Ranked by total hours contributed to the community.</p>
          </div>
        </div>

        <!-- Top 3 podium -->
        <div class="leaderboard-podium">
          ${vols.slice(0, 3).map((v, i) => {
            const color = _avatarColor(v.displayName);
            const avg   = _avgRating(v.ratings);
            return `
            <div class="podium-card podium-rank-${i+1}">
              <div class="podium-medal">${medals[i]}</div>
              <div class="podium-avatar" style="background:${color}">${_initials(v.displayName)}</div>
              <div class="podium-name">${v.displayName} ${_verifiedBadge(v)}</div>
              <div class="podium-location">📍 ${v.location}</div>
              <div class="podium-hours" style="color:${rankColors[i]}">${v.hours || 0}h</div>
              ${avg ? `<div class="podium-stars">${_starDisplay(avg)} ${avg}</div>` : ''}
              <button class="btn btn-outline btn-xs" style="margin-top:8px" onclick="App.openProfileModal('${v.uid}')">View Profile</button>
            </div>`;
          }).join('')}
        </div>

        <!-- Full ranked table -->
        <div class="leaderboard-table card" style="margin-top:24px">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:2px solid var(--border)">
                <th class="lb-th">Rank</th>
                <th class="lb-th">Volunteer</th>
                <th class="lb-th">Location</th>
                <th class="lb-th">Skills</th>
                <th class="lb-th">Hours</th>
                <th class="lb-th">Rating</th>
                <th class="lb-th"></th>
              </tr>
            </thead>
            <tbody>
              ${vols.map((v, i) => {
                const color = _avatarColor(v.displayName);
                const avg   = _avgRating(v.ratings);
                return `
                <tr class="lb-row" style="${i < 3 ? 'background:var(--amber-50)' : ''}">
                  <td class="lb-td" style="font-weight:800;color:${i<3?rankColors[i]:'var(--text-muted)'}">
                    ${i < 3 ? medals[i] : `#${i+1}`}
                  </td>
                  <td class="lb-td">
                    <div style="display:flex;align-items:center;gap:9px">
                      <div style="width:32px;height:32px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;color:white;flex-shrink:0">${_initials(v.displayName)}</div>
                      <div>
                        <div style="font-weight:600;font-size:.88rem">${v.displayName} ${_verifiedBadge(v)}</div>
                        <div style="font-size:.72rem;color:var(--text-muted)">${v.availability}</div>
                      </div>
                    </div>
                  </td>
                  <td class="lb-td" style="font-size:.84rem">📍 ${v.location}</td>
                  <td class="lb-td">${(v.skills||[]).map(s=>`<span class="badge badge-navy" style="font-size:.65rem">${_skillEmoji(s)} ${s}</span>`).join(' ')}</td>
                  <td class="lb-td" style="font-weight:800;color:var(--blue-mid);font-size:1rem">${v.hours || 0}<span style="font-size:.72rem;color:var(--text-muted)">h</span></td>
                  <td class="lb-td">${avg ? `<span style="font-size:.82rem">${_starDisplay(avg)} <b>${avg}</b></span>` : '<span style="color:var(--text-muted);font-size:.78rem">—</span>'}</td>
                  <td class="lb-td"><button class="btn btn-ghost btn-xs" onclick="App.openProfileModal('${v.uid}')">Profile →</button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }


// ────────────────────────────────────────────────────────────
// GENERAL USER ROLE — Auth extensions
// ────────────────────────────────────────────────────────────

  function setSignupRoleGeneral() {
    _el('signup-vol-fields')?.classList.add('hidden');
    _el('signup-ngo-fields')?.classList.add('hidden');
    _el('signup-gen-fields')?.classList.remove('hidden');
    _el('srole-vol')?.classList.remove('active');
    _el('srole-ngo')?.classList.remove('active');
    _el('srole-gen')?.classList.add('active');
    if (window.App) window.App._signupRoleOverride = 'general';
  }

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

// ────────────────────────────────────────────────────────────
// REPORT INCIDENT — Floating Button + Modal
// ────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────
// INCIDENTS PAGE — public board
// ────────────────────────────────────────────────────────────

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
          <button class="btn btn-danger" onclick="App.openReportModal()">
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
                              onclick="App.respondToIncident('${inc.id}')">
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

// ────────────────────────────────────────────────────────────
// NGO ANALYTICS — Completed Tasks + Ex-Volunteers
// ────────────────────────────────────────────────────────────

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
                <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--slate-100)">
                  <div>
                    <div style="font-weight:600;font-size:.88rem">${task.title}</div>
                    <div style="font-size:.75rem;color:var(--text-muted)">📍 ${task.location} · ${approvedApps.length} volunteers · ${hrs}h logged</div>
                  </div>
                  <span class="badge badge-green">₹${_fmtNum(hrs * 25)}</span>
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
                ${exVols.map(v => `
                  <div class="vol-card" onclick="App.openProfileModal('${v.uid}')">
                    <div class="vol-avatar" style="background:${_avatarColor(v.displayName)}">${_initials(v.displayName)}</div>
                    <div class="vol-info">
                      <div class="vol-name">${v.displayName}</div>
                      <div class="vol-meta">${v.location || 'Unknown'} · ${v.hours || 0}h</div>
                    </div>
                    <div class="vol-rating">${_starDisplay(_avgRating(v.ratings || []))}</div>
                  </div>`).join('')}
              </div>`}
        </div>
      </div>`;
  }


// ────────────────────────────────────────────────────────────────
// LIVE ACTIVITY FEED TICKER
// ────────────────────────────────────────────────────────────────

  let _activityTimer = null;
  let _activityIndex = 0;

  function _startActivityFeed() {
    const ticker = _el('activity-ticker');
    if (!ticker) return;

    function _tick() {
      const feed = DB.activityFeed ? DB.activityFeed.getRecent(12) : [];
      if (!feed.length) return;
      _activityIndex = (_activityIndex + 1) % feed.length;
      const item = feed[_activityIndex];
      const isCritical = item.type === 'critical';
      ticker.innerHTML = `
        <span class="ticker-dot" style="background:${isCritical?'var(--red)':'var(--green-mid)'}"></span>
        <span class="ticker-text ${isCritical?'ticker-critical':''}">${item.msg}</span>
        <span class="ticker-time">${_timeAgo(item.createdAt)}</span>`;
      ticker.classList.add('ticker-flash');
      setTimeout(() => ticker.classList.remove('ticker-flash'), 600);
    }

    _tick();
    clearInterval(_activityTimer);
    _activityTimer = setInterval(_tick, 5000);
  }

  function _stopActivityFeed() {
    clearInterval(_activityTimer);
    _activityTimer = null;
  }


// ────────────────────────────────────────────────────────────────
// CERTIFICATE SYSTEM
// ────────────────────────────────────────────────────────────────

  function downloadCertificate(certId) {
    let cert = null;
    if (certId) {
      // Try to find by certId across all certificates
      const all = Object.values(DB._read().certificates || {});
      cert = all.find(c => c.id === certId) || null;
    }
    if (!cert) { showToast('Certificate not found.', 'error'); return; }
    _openCertificateOverlay(cert);
  }

  function generateCertificateForVol(taskId, volId) {
    const task = DB.tasks.getById(taskId);
    const vol  = DB.users.getById(volId);
    if (!task || !vol) {
      showToast('Task or volunteer not found.', 'error');
      return;
    }

    const caller = Auth.getCurrentUser();
    if (!caller) {
      showToast('Please sign in.', 'warning');
      return;
    }
    const app = (task.applications || []).find(a => a.userId === volId);
    const approved = app && app.status === 'approved';
    const isNgoOwner = caller.role === 'ngo' && task.ngoId === caller.uid;
    const isRecipientVol = caller.role === 'volunteer' && caller.uid === volId;

    if (task.status !== 'Complete') {
      showToast('Certificates are available only after the NGO marks the task complete.', 'warning');
      return;
    }
    if (!approved) {
      showToast('Only volunteers approved for this task receive a certificate.', 'warning');
      return;
    }
    if (!isNgoOwner && !isRecipientVol) {
      showToast('You cannot open this certificate.', 'error');
      return;
    }

    // Check if already issued
    let cert = null;
    const existing = Object.values(DB._read().certificates || {}).find(c => c.taskId === taskId && c.recipientId === volId);
    if (existing) {
      cert = existing;
    } else {
      const hours = (task.hoursLogged || {})[volId] || 0;
      const id = DB.certificates.create({
        taskId, taskTitle: task.title,
        ngoId: task.ngoId, ngoName: task.ngoName,
        recipientId: volId, recipientName: vol.displayName,
        hoursContributed: hours,
        message: 'In recognition of outstanding contribution to community service.',
      });
      cert = DB.certificates ? { ...DB._read().certificates[id] } : null;
    }
    if (cert) _openCertificateOverlay(cert);
  }

  function _openCertificateOverlay(cert) {
    const el = _el('certificate-overlay');
    if (!el) return;

    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    el.innerHTML = `
      <div class="cert-backdrop" onclick="">
        <div class="cert-container" id="cert-printable">
          <div class="cert-border-outer">
            <div class="cert-border-inner">
              <!-- Header -->
              <div class="cert-header">
                <div class="cert-logo">🤝</div>
                <div class="cert-org-name">${cert.ngoName}</div>
                <div class="cert-subtitle">VolunteerBridge · Community Impact Programme</div>
              </div>

              <div class="cert-divider"></div>

              <!-- Body -->
              <div class="cert-body">
                <div class="cert-presents">This certifies that</div>
                <div class="cert-recipient">${cert.recipientName}</div>
                <div class="cert-presents" style="margin-top:8px">has successfully completed</div>
                <div class="cert-task">"${cert.taskTitle}"</div>
                <div class="cert-hours">
                  contributing <strong>${cert.hoursContributed} hour${cert.hoursContributed !== 1 ? 's' : ''}</strong>
                  of dedicated volunteer service.
                </div>
                <div class="cert-message">${cert.message}</div>
              </div>

              <div class="cert-divider"></div>

              <!-- Footer -->
              <div class="cert-footer">
                <div class="cert-date">
                  <div class="cert-date-val">${cert.issuedDate || today}</div>
                  <div class="cert-date-lbl">Date of Issue</div>
                </div>
                <div class="cert-seal">
                  <div class="cert-seal-circle">
                    <div class="cert-seal-inner">✓</div>
                  </div>
                  <div class="cert-seal-label">Verified</div>
                </div>
                <div class="cert-sig">
                  <div class="cert-sig-line"></div>
                  <div class="cert-sig-name">${cert.ngoName}</div>
                  <div class="cert-sig-title">Authorised Signatory</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions (outside printable area) -->
        <div class="cert-actions">
          <button class="btn btn-primary" onclick="window.print()">🖨 Print / Save as PDF</button>
          <button class="btn btn-ghost" style="color:white;border:1px solid rgba(255,255,255,.3)" onclick="App.closeCertificate()">✕ Close</button>
        </div>
      </div>`;

    el.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeCertificate() {
    _el('certificate-overlay')?.classList.add('hidden');
    document.body.style.overflow = '';
  }


// ────────────────────────────────────────────────────────────────
// VOLUNTEER SQUADS
// ────────────────────────────────────────────────────────────────

  function _renderSquadsTab() {
    const el = _el('vol-tab-squads');
    if (!el) { console.warn('Squads element not found'); return; }

    const user = Auth.getCurrentUser();
    if (!user) { el.innerHTML = '<p style="padding:20px">Please log in to view squads.</p>'; return; }

    const allSquads = Object.values(DB._read().squads || {});
    const mySquads = allSquads.filter(s => s.members && s.members.some(m => m.uid === user.uid));
    const allVols = DB.users.getVolunteers().filter(v => v.uid !== user.uid);

    let html = `
      <div class="dash-tab-header">
        <div>
          <h2 class="dash-title">My Squad</h2>
          <p class="dash-sub">Build a squad, message members, and coordinate together.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="App._openCreateSquadModal()">⚔️ Build a squad</button>
          <button class="btn btn-outline" onclick="App.openInbox()">✉️ Messages</button>
        </div>
      </div>
    `;

    if (mySquads.length === 0) {
      html += _emptyState('⚔️', 'No squad yet', 'Use Build a squad to create one, then invite volunteers from the directory below.');
    } else {
      html += mySquads.map(squad => {
        const isAdmin = squad.leaderId === user.uid;
        const totalHrs = (squad.members || []).reduce((s, m) => {
          const vol = DB.users.getById(m.uid);
          return s + (vol?.hours || 0);
        }, 0);
        return `
        <div class="card" style="margin-bottom:16px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
            <div style="flex:1">
              <div style="font-size:1.1rem;font-weight:700">
                ${squad.name || 'Squad'}
                ${isAdmin ? '<span class="badge badge-amber" style="font-size:.65rem;vertical-align:middle;margin-left:6px">You are admin</span>' : ''}
              </div>
              <div style="font-size:.8rem;color:var(--text-muted);margin-top:3px">${squad.description || ''} · ${squad.members.length} member${squad.members.length!==1?'s':''} · ${totalHrs}h total</div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${isAdmin ? `<button class="btn btn-ghost btn-xs" onclick="App._openInviteSquadModal('${squad.id}')">+ Invite</button>` : ''}
              <button class="btn btn-ghost btn-xs" style="color:var(--red)" onclick="App.leaveSquad('${squad.id}')">Leave</button>
              <button class="btn btn-primary btn-xs" onclick="App.openSquadChat('${squad.id}')">💬 Message squad</button>
            </div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:10px">
            ${(squad.members || []).map(m => {
              const vol = DB.users.getById(m.uid);
              const color = _avatarColor(m.name);
              const isSquadAdmin = squad.leaderId === m.uid;
              const roleBadge = isSquadAdmin
                ? '<span class="badge badge-amber" style="font-size:.58rem">Admin</span>'
                : '<span class="badge badge-slate" style="font-size:.58rem">Member</span>';
              return `
              <div style="display:flex;align-items:center;gap:7px;padding:8px 12px;background:var(--slate-50);border-radius:var(--radius-md);border:1px solid var(--border);flex:1;min-width:200px;max-width:320px">
                <div style="width:28px;height:28px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:.62rem;font-weight:700;color:white">${_initials(m.name)}</div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:.82rem;font-weight:600;display:flex;align-items:center;gap:6px;flex-wrap:wrap">${m.name} ${_verifiedBadge(vol)} ${roleBadge}</div>
                  <div style="font-size:.7rem;color:var(--text-muted)">${vol?.hours||0}h · ${vol?.location||''}</div>
                </div>
                <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
                  ${m.uid !== user.uid ? `<button type="button" class="btn btn-ghost btn-xs" onclick="App.openMessageModal('${m.uid}', ${JSON.stringify(m.name)})">✉️</button>` : ''}
                  ${isAdmin && m.uid !== user.uid ? `<button type="button" class="btn btn-ghost btn-xs" style="color:var(--red);padding:2px 6px" onclick="App._removeFromSquad('${squad.id}','${m.uid}')">✕</button>` : ''}
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>`;
      }).join('');
    }

    // All volunteers section
    html += `
      <div class="dash-section-title" style="margin-top:24px">All Volunteers (invite to squad)</div>
      <div class="vol-grid">
        ${allVols.map(v => {
          const color = _avatarColor(v.displayName);
          const inSquad = mySquads.some(sq => sq.members.some(m => m.uid === v.uid));
          return `
          <div class="vol-card">
            <div class="vol-card-header">
              <div class="vol-avatar-md" style="background:${color}">${_initials(v.displayName)}</div>
              <div>
                <div class="vol-card-name">${v.displayName} ${_verifiedBadge(v)}</div>
                <div class="vol-card-loc">📍 ${v.location || 'Unknown'} · ${v.hours||0}h</div>
              </div>
            </div>
            <div class="vol-card-skills">${(v.skills||[]).map(s=>`<span class="badge badge-blue">${_skillEmoji(s)} ${s}</span>`).join('')}</div>
            <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn btn-ghost btn-xs" onclick="App.openProfileModal('${v.uid}')">Profile</button>
              ${mySquads.length && !inSquad
                ? `<button class="btn btn-primary btn-xs" onclick="App.joinSquad('${mySquads[0].id}','${v.uid}','${v.displayName.replace(/'/g,"\\'")}')">+ Add to Squad</button>`
                : inSquad ? `<span class="badge badge-green" style="font-size:.65rem">In Squad</span>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
    `;

    el.innerHTML = html;
  }

  function _openCreateSquadModal() {
    const el = _el('modal-create-squad-body');
    if (!el) { showToast('Squad creation modal not found in HTML.', 'error'); return; }
    el.innerHTML = `
      <div class="form-group">
        <label class="form-label">Squad Name *</label>
        <input class="form-input" type="text" id="sq-name" placeholder="e.g. Pune Heroes 💪" />
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="sq-desc" rows="2" placeholder="What does your squad stand for?"></textarea>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="App.closeModal('modal-create-squad')">Cancel</button>
        <button class="btn btn-primary" onclick="App.createSquad()">Build squad ⚔️</button>
      </div>`;
    openModal('modal-create-squad');
  }

  function createSquad() {
    const user = Auth.getCurrentUser();
    if (!user) return;
    const name = (_el('sq-name')?.value || '').trim();
    const desc = (_el('sq-desc')?.value || '').trim();
    if (!name) { showToast('Squad name is required.', 'warning'); return; }
    DB.squads.create({
      name, description: desc,
      leaderId: user.uid, leaderName: user.displayName,
      members: [{ uid: user.uid, name: user.displayName, joinedAt: new Date().toISOString().split('T')[0] }],
    });
    DB.activityFeed?.push(`${user.displayName} created a new squad "${name}" ⚔️`, 'squad');
    closeModal('modal-create-squad');
    showToast(`Squad "${name}" created!`, 'success');
    _renderSquadsTab();
  }

  function joinSquad(squadId, volId, volName) {
    const vol = DB.users.getById(volId || Auth.getCurrentUser()?.uid);
    if (!vol) return;
    const ok = DB.squads.addMember(squadId, { uid: vol.uid, name: vol.displayName });
    if (!ok) { showToast('Already a member.', 'info'); return; }
    // Notify the new member
    DB.notifications.create({ userId: vol.uid, message: `You have been added to a squad! Check the Squads tab.`, type: 'success', icon: '⚔️' });
    DB.activityFeed?.push(`${vol.displayName} joined a volunteer squad!`, 'squad');
    showToast(`${vol.displayName} added to squad!`, 'success');
    _renderSquadsTab();
  }

  function leaveSquad(squadId) {
    const user = Auth.getCurrentUser();
    if (!user) return;
    _showConfirmDialog('Leave this squad? You can rejoin later.', () => {
      DB.squads.removeMember(squadId, user.uid);
      showToast('Left squad.', 'info');
      _renderSquadsTab();
    }, 'Leave Squad');
  }

  function _removeFromSquad(squadId, uid) {
    const vol = DB.users.getById(uid);
    _showConfirmDialog(`Remove ${vol?.displayName || 'this member'} from the squad?`, () => {
      DB.squads.removeMember(squadId, uid);
      showToast('Member removed.', 'info');
      _renderSquadsTab();
    }, 'Remove');
  }

  function _openInviteSquadModal(squadId) {
    const user = Auth.getCurrentUser();
    const squad = DB.squads.getById(squadId);
    if (!user || !squad) return;
    if (squad.leaderId !== user.uid) {
      showToast('Only the squad admin can invite members.', 'info');
      return;
    }
    const memberIds = new Set((squad.members || []).map(m => m.uid));
    const candidates = DB.users.getVolunteers().filter(v => v.uid !== user.uid && !memberIds.has(v.uid));
    const body = _el('modal-invite-squad-body');
    if (!body) {
      showToast('Invite dialog is not available.', 'error');
      return;
    }
    if (!candidates.length) {
      body.innerHTML = `
        <p class="modal-desc">Every volunteer is already in this squad or there is no one else to add yet.</p>
        <div class="modal-footer" style="margin-top:16px">
          <button type="button" class="btn btn-primary" onclick="App.closeModal('modal-invite-squad')">OK</button>
        </div>`;
    } else {
      body.innerHTML = `
        <p class="modal-desc" style="margin-bottom:14px">Add someone to <strong>${(squad.name || 'your squad').replace(/</g, '')}</strong>.</p>
        <div style="display:flex;flex-direction:column;gap:10px;max-height:50vh;overflow-y:auto">
          ${candidates.map(v => `
            <div class="card" style="padding:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
              <div>
                <div style="font-weight:600">${v.displayName}</div>
                <div style="font-size:.75rem;color:var(--text-muted)">${v.location || ''} · ${v.hours || 0}h</div>
              </div>
              <button type="button" class="btn btn-primary btn-xs"
                onclick="App.joinSquad('${squadId}','${v.uid}');App.closeModal('modal-invite-squad')">Add</button>
            </div>`).join('')}
        </div>
        <div class="modal-footer" style="margin-top:16px">
          <button type="button" class="btn btn-ghost" onclick="App.closeModal('modal-invite-squad')">Close</button>
        </div>`;
    }
    openModal('modal-invite-squad');
  }


// ────────────────────────────────────────────────────────────────
// SQUAD CHAT — renders inside squad details
// ────────────────────────────────────────────────────────────────

  let _activeSquadChatId = null;

  function openSquadChat(squadId) {
    _activeSquadChatId = squadId;
    const squad = DB.squads?.getById(squadId);
    if (!squad) return;
    const titleEl = _el('modal-squad-chat-title');
    if (titleEl) titleEl.textContent = `⚔️ ${squad.name} — Squad chat`;
    renderSquadChat();
    openModal('modal-squad-chat');
  }

  function closeSquadChatModal() {
    _activeSquadChatId = null;
    closeModal('modal-squad-chat');
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


// ────────────────────────────────────────────────────────────────
// MESSAGING SYSTEM (fully implemented)
// ────────────────────────────────────────────────────────────────

  let _activeChatContactId   = null;
  let _activeChatContactName = null;
  let _msgRefreshTimer       = null;

  function openMessageModal(contactId, contactName) {
    if (!Auth.requireAuth()) return;
    _activeChatContactId   = contactId;
    _activeChatContactName = contactName;

    const titleEl = _el('modal-message-title');
    if (titleEl) titleEl.textContent = `💬 ${contactName}`;
    const inp = _el('modal-message-input');
    if (inp) inp.value = '';
    _renderChatThread();
    openModal('modal-message');

    // Mark thread as read
    const user = Auth.getCurrentUser();
    if (user) DB.messages.markThreadRead(user.uid, contactId);
    _updateMsgBadge();

    // Auto-refresh every 3 seconds while modal is open
    clearInterval(_msgRefreshTimer);
    _msgRefreshTimer = setInterval(() => {
      if (!_el('modal-message')?.classList.contains('hidden')) {
        _renderChatThread();
      } else {
        clearInterval(_msgRefreshTimer);
      }
    }, 3000);
  }

  function _renderChatThread() {
    const user    = Auth.getCurrentUser();
    const threadEl = _el('modal-message-thread');
    if (!threadEl || !user || !_activeChatContactId) return;

    const thread = DB.messages.getThread(user.uid, _activeChatContactId);
    if (!thread.length) {
      threadEl.innerHTML = `<div class="chat-empty">Start the conversation 👋</div>`;
      return;
    }

    threadEl.innerHTML = thread.map(m => {
      const isMine = m.fromId === user.uid;
      return `
      <div class="chat-bubble-wrap ${isMine ? 'mine' : 'theirs'}">
        ${!isMine ? `<div class="chat-sender-name">${m.fromName}</div>` : ''}
        <div class="chat-bubble ${isMine ? 'bubble-mine' : 'bubble-theirs'}">${m.text}</div>
        <div class="chat-time">${_timeAgo(m.createdAt)}</div>
      </div>`;
    }).join('');

    threadEl.scrollTop = threadEl.scrollHeight;
  }

  function sendChatMessage() {
    const user   = Auth.getCurrentUser();
    const inp    = _el('modal-message-input');
    const text   = (inp?.value || '').trim();
    if (!user || !text || !_activeChatContactId) return;

    DB.messages.send({
      fromId: user.uid, fromName: user.displayName,
      toId: _activeChatContactId, toName: _activeChatContactName,
      text,
    });

    // Notify recipient
    DB.notifications.create({
      userId: _activeChatContactId,
      message: `New message from ${user.displayName}: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`,
      type: 'message', icon: '💬',
    });

    // Push to activity feed for critical
    DB.activityFeed?.push(`${user.displayName} sent a message`, 'message');

    if (inp) inp.value = '';
    _renderChatThread();
    _updateMsgBadge();
  }

  function openInbox() {
    const user = Auth.getCurrentUser();
    if (!user) return;

    const panel = _el('inbox-panel');
    if (!panel) return;
    const isOpen = panel.classList.contains('open');
    panel.classList.toggle('open', !isOpen);
    if (isOpen) return;

    const threads = DB.messages.getInbox(user.uid);
    const list    = _el('inbox-thread-list');
    if (!list) return;

    if (!threads.length) {
      list.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:.85rem">No messages yet 📭</div>`;
      return;
    }

    list.innerHTML = threads.map(t => `
      <div class="inbox-thread ${t.unread ? 'inbox-unread' : ''}"
           onclick="App.openMessageModal('${t.contactId}','${t.contactName.replace(/'/g,"\\'")}')">
        <div class="inbox-thread-avatar" style="background:${_avatarColor(t.contactName)}">${_initials(t.contactName)}</div>
        <div class="inbox-thread-info">
          <div class="inbox-thread-name">${t.contactName}</div>
          <div class="inbox-thread-preview">${t.lastMessage.slice(0, 48)}${t.lastMessage.length > 48 ? '…' : ''}</div>
        </div>
        ${t.unread ? '<div class="inbox-unread-dot"></div>' : ''}
      </div>`).join('');
  }

  function _updateMsgBadge() {
    const user  = Auth.getCurrentUser();
    const badge = _el('msg-badge');
    if (!badge || !user) return;
    const n = DB.messages.getUnreadCount(user.uid);
    badge.textContent = n > 9 ? '9+' : n;
    badge.classList.toggle('hidden', n === 0);
  }


// ────────────────────────────────────────────────────────────────
// REPLACE _renderMyTasks — Active + Completed History split
// SEARCH: function _renderMyTasks() {
// REPLACE the ENTIRE function with:
// ────────────────────────────────────────────────────────────────

  function _renderMyTasks() {
    const user = Auth.getCurrentUser();
    if (!user) return;
    const all = DB.tasks.getAll().filter(t => (t.applications || []).some(a => a.userId === user.uid));
    const el  = _el('vol-my-tasks-list');
    if (!el) return;

    if (!all.length) {
      el.innerHTML = _emptyState('📋', 'No commitments yet', 'Browse Opportunities and apply to tasks that match your skills.');
      return;
    }

    const active    = all.filter(t => { const a = t.applications.find(x => x.userId === user.uid); return (a?.status === 'pending' || a?.status === 'approved') && t.status !== 'Complete'; });
    const completed = all.filter(t => t.status === 'Complete' || t.applications.find(x => x.userId === user.uid)?.status === 'revoked');

    const buildCard = task => {
      const app    = task.applications.find(a => a.userId === user.uid);
      const logged = (task.hoursLogged || {})[user.uid] || 0;
      const stCls  = { pending:'badge-slate', approved:'badge-green', rejected:'badge-red', revoked:'badge-slate' };
      const stLbl  = { pending:'⏳ Pending', approved:'✅ Approved', rejected:'❌ Rejected', revoked:'↩ Revoked' };
      const skills = (task.requiredSkills || []).map(s => `<span class="badge badge-navy">${_skillEmoji(s)} ${s}</span>`).join('');

      // Check if certificate available
      const hasCert = DB.certificates && task.status === 'Complete' && app?.status === 'approved';
      const certObj = hasCert ? Object.values(DB._read().certificates || {}).find(c => c.taskId === task.id && c.recipientId === user.uid) : null;

      return `
      <div class="task-card priority-${task.priority}">
        <div class="task-card-header">
          <div>
            <div class="task-card-title">${task.title}</div>
            <div class="task-card-ngo">by ${task.ngoName} · 📍 ${task.location}</div>
          </div>
          <div class="task-card-badges">
            <span class="badge ${stCls[app?.status]||'badge-slate'}">${stLbl[app?.status]||app?.status}</span>
            ${_priorityBadge(task.priority)}
          </div>
        </div>
        <div class="task-desc">${task.description}</div>
        <div class="task-skills">${skills}</div>
        <div class="task-meta">
          <span class="task-meta-item">📞 ${task.ngoContact||'—'}</span>
          <span class="task-meta-item">⏱️ ${task.duration||'TBD'}</span>
          <span class="task-meta-item">📅 Applied: ${app?.appliedDate||'—'}</span>
          ${logged > 0 ? `<span class="task-meta-item" style="color:var(--green-mid);font-weight:600">✓ ${logged}h logged</span>` : ''}
        </div>
        <div class="task-actions">
          ${(app?.status === 'pending' || app?.status === 'approved') && task.status !== 'Complete'
            ? `<button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="App.confirmRevokeCommitment('${task.id}')">Revoke</button>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="App.showTaskDetailModal('${task.id}')">View Details</button>
          ${hasCert
            ? (certObj
                ? `<button class="btn btn-amber btn-sm" onclick="App.downloadCertificate('${certObj.id}')">🏅 Certificate</button>`
                : `<button class="btn btn-amber btn-sm" onclick="App.generateCertificateForVol('${task.id}','${user.uid}')">🏅 Get Certificate</button>`)
            : ''}
        </div>
      </div>`;
    };

    el.innerHTML = `
      <div class="commitments-section">
        <div class="commitments-section-header">
          <h3 class="commitments-section-title">Active Tasks</h3>
          <span class="badge badge-blue">${active.length}</span>
        </div>
        ${active.length ? active.map(buildCard).join('') : `<p style="color:var(--text-muted);font-size:.85rem;padding:12px 0">No active commitments.</p>`}
      </div>

      <div class="commitments-section" style="margin-top:28px">
        <div class="commitments-section-header">
          <h3 class="commitments-section-title">Volunteering History</h3>
          <span class="badge badge-slate">${completed.length}</span>
        </div>
        ${completed.length ? completed.map(buildCard).join('') : `<p style="color:var(--text-muted);font-size:.85rem;padding:12px 0">No past activity yet.</p>`}
      </div>`;
  }


// ────────────────────────────────────────────────────────────────
// REPLACE _renderNgoVolPool — Working vs Pending stats + actions
// SEARCH: function _renderNgoVolPool() {
// REPLACE the ENTIRE function with:
// ────────────────────────────────────────────────────────────────

  function _renderNgoVolPool() {
    const user    = Auth.getCurrentUser();
    const allVols = DB.users.getVolunteers();
    const myTasks = DB.tasks.getAll().filter(t => t.ngoId === user?.uid);
    const badge   = _el('vol-pool-count');

    // Compute Working vs Pending
    const workingSet = new Set();
    const pendingSet = new Set();
    myTasks.forEach(task => {
      (task.applications || []).forEach(app => {
        if (app.status === 'approved') workingSet.add(app.userId);
        else if (app.status === 'pending') pendingSet.add(app.userId);
      });
    });

    if (badge) badge.innerHTML = `
      ${allVols.length} volunteers &nbsp;·&nbsp;
      <span style="color:var(--green-mid);font-weight:700">${workingSet.size} working</span> &nbsp;·&nbsp;
      <span style="color:var(--amber);font-weight:700">${pendingSet.size} pending</span>`;

    const container = _el('ngo-vol-list');
    if (!container) return;
    if (!allVols.length) {
      container.innerHTML = `<div style="grid-column:span 2">${_emptyState('👥','No volunteers yet','')}</div>`;
      return;
    }

    // Sort: working first, then pending, then others
    const sorted = [
      ...allVols.filter(v => workingSet.has(v.uid)),
      ...allVols.filter(v => pendingSet.has(v.uid) && !workingSet.has(v.uid)),
      ...allVols.filter(v => !workingSet.has(v.uid) && !pendingSet.has(v.uid)),
    ];

    container.innerHTML = sorted.map(vol => {
      const color   = _avatarColor(vol.displayName);
      const age     = _ageFromDob(vol.dob);
      const avg     = _avgRating(vol.ratings);
      const loggedForUs = myTasks.reduce((s, t) => s + ((t.hoursLogged || {})[vol.uid] || 0), 0);
      const isWorking  = workingSet.has(vol.uid);
      const isPending  = pendingSet.has(vol.uid);
      const statusTag  = isWorking
        ? `<span class="badge badge-green" style="font-size:.65rem">✅ Working</span>`
        : isPending
          ? `<span class="badge badge-amber" style="font-size:.65rem">⏳ Pending</span>`
          : '';
      // Find a relevant task for Hours button
      const relevantTask = myTasks.find(t => (t.applications||[]).some(a => a.userId === vol.uid && a.status === 'approved'));

      return `
      <div class="vol-card" style="${isWorking?'border-color:var(--green-mid)':isPending?'border-color:var(--amber)':''}">
        <div class="vol-card-header">
          <div class="vol-avatar-md" style="background:${color}">${_initials(vol.displayName)}</div>
          <div style="flex:1;min-width:0">
            <div class="vol-card-name">${vol.displayName} ${_verifiedBadge(vol)} ${statusTag}</div>
            <div class="vol-card-loc">📍 ${vol.location} · ${vol.availability}${age ? ` · ${age}y` : ''}</div>
            ${avg ? `<div>${_starDisplay(avg)} <span style="font-size:.72rem;color:var(--amber)">${avg}</span></div>` : ''}
          </div>
        </div>
        <div class="vol-card-skills">${(vol.skills||[]).map(s=>`<span class="badge badge-blue">${_skillEmoji(s)} ${s}</span>`).join('')}</div>
        <div class="vol-card-meta" style="margin-bottom:10px">
          <span>⏱️ ${vol.hours||0}h total · ${loggedForUs}h with us</span>
          <span>💼 ${DB.wallets ? _rupee(DB.wallets.getBalance(vol.uid)) : '₹0'} wallet</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-xs" onclick="App.openProfileModal('${vol.uid}')">👤 Profile</button>
          ${relevantTask ? `<button class="btn btn-primary btn-xs" onclick="App.openAddHoursModal('${relevantTask.id}','${vol.uid}','${vol.displayName.replace(/'/g,"\\'")}')">+ Hours</button>` : ''}
          <button class="btn btn-amber btn-xs" onclick="App.openBonusModal('${vol.uid}','${vol.displayName.replace(/'/g,"\\'")}')">₹ Bonus</button>
          <button class="btn btn-ghost btn-xs" onclick="App.openRateVolModal('${vol.uid}','${vol.displayName.replace(/'/g,"\\'")}')">⭐ Rate</button>
          <button class="btn btn-ghost btn-xs" onclick="App.openMessageModal('${vol.uid}','${vol.displayName.replace(/'/g,"\\'")}')">💬</button>
          ${relevantTask && isWorking ? `<button class="btn btn-ghost btn-xs" onclick="App.generateCertificateForVol('${relevantTask.id}','${vol.uid}')">🏅 Cert</button>` : ''}
        </div>
      </div>`;
    }).join('');
  }


// ────────────────────────────────────────────────────────────────
// REPLACE _renderAnalytics — adds ended tasks detail section
// SEARCH: function _renderAnalytics() {
// REPLACE the ENTIRE function with:
// ────────────────────────────────────────────────────────────────

  function _renderAnalytics() {
    if (!Auth.hasRole('ngo')) {
      showToast('Analytics is only available for NGOs.', 'warning');
      showPage('landing'); return;
    }
    const summary = DB.analytics.getSummary();
    _renderKPIs(summary);
    _renderMoneySavedFilter();
    _renderSkillChart(summary.skillCounts);
    _renderActivityTimeline(summary.recentActivity);
    _renderCrisisLocations(summary.locationMap);
    _renderEndedTasksDetail();
  }

  function _renderEndedTasksDetail() {
    const el = _el('ended-tasks-detail');
    if (!el) return;
    const completed = DB.tasks.getAll().filter(t => t.status === 'Complete');
    if (!completed.length) {
      el.innerHTML = _emptyState('✅', 'No completed tasks yet', 'Close a task to see its impact breakdown here.');
      return;
    }

    el.innerHTML = completed.map(task => {
      const approvedApps = (task.applications || []).filter(a => a.status === 'approved');
      const taskHours    = Object.values(task.hoursLogged || {}).reduce((s, h) => s + h, 0);
      const moneySaved   = taskHours * 1850; // ₹1850/hr
      return `
      <div class="card" style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:12px">
          <div>
            <div style="font-weight:700;font-size:.97rem">${task.title}</div>
            <div style="font-size:.78rem;color:var(--text-muted);margin-top:2px">
              📍 ${task.location} · Completed ${task.completedDate || task.postedDate} · ${task.ngoName}
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <div class="kpi-mini"><span>${taskHours}h</span><div>Hours</div></div>
            <div class="kpi-mini" style="color:var(--amber)"><span>${_rupee(moneySaved)}</span><div>Value Saved</div></div>
            <div class="kpi-mini" style="color:var(--green-mid)"><span>${approvedApps.length}</span><div>Volunteers</div></div>
          </div>
        </div>
        ${approvedApps.length ? `
          <div style="display:flex;flex-wrap:wrap;gap:8px;padding-top:10px;border-top:1px solid var(--border)">
            ${approvedApps.map(app => {
              const vol   = DB.users.getById(app.userId);
              const color = _avatarColor(app.userName);
              const hrs   = (task.hoursLogged || {})[app.userId] || 0;
              return `
              <div style="display:flex;align-items:center;gap:7px;padding:6px 10px;background:var(--slate-50);border-radius:var(--radius-md);border:1px solid var(--border)">
                <div style="width:26px;height:26px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:.6rem;font-weight:700;color:white">${_initials(app.userName)}</div>
                <div>
                  <div style="font-size:.8rem;font-weight:600">${app.userName} ${_verifiedBadge(vol)}</div>
                  <div style="font-size:.68rem;color:var(--text-muted)">${hrs}h logged</div>
                </div>
              </div>`;
            }).join('')}
          </div>` : ''}
        <div class="task-actions" style="margin-top:10px">
          ${approvedApps.map(app => `<button class="btn btn-ghost btn-xs" onclick="App.generateCertificateForVol('${task.id}','${app.userId}')">🏅 ${app.userName.split(' ')[0]}'s Cert</button>`).join('')}
        </div>
      </div>`;
    }).join('');
  }


// ────────────────────────────────────────────────────────────────
// FINANCIAL SYSTEM — fully operational with wallet updates
// REPLACE existing submitDonation & submitBonus if present
// ────────────────────────────────────────────────────────────────

  function openDonationModal(ngoId, ngoName) {
    if (!Auth.requireAuth()) return;
    const idEl  = _el('modal-donation-ngo-id');   if (idEl)  idEl.value  = ngoId;
    const nmEl  = _el('modal-donation-ngo-name'); if (nmEl)  nmEl.value  = ngoName;
    const lblEl = _el('modal-donation-ngo-label');
    if (lblEl) lblEl.innerHTML = `Donating to: <strong>${ngoName}</strong>`;
    const amtEl = _el('modal-donation-amount'); if (amtEl) amtEl.value = '';
    const noteEl= _el('modal-donation-note');   if (noteEl) noteEl.value = '';
    const errEl = _el('modal-donation-error');  if (errEl) { errEl.classList.add('hidden'); errEl.textContent = ''; }
    document.querySelectorAll('#modal-donation .donation-preset').forEach(b => b.classList.remove('active'));

    // Show user's current wallet balance
    const user = Auth.getCurrentUser();
    const bal  = DB.wallets ? DB.wallets.getBalance(user?.uid) : 0;
    const balEl = _el('modal-donation-balance');
    if (balEl) balEl.textContent = `Your wallet: ${_rupee(bal)}`;
    openModal('modal-donation');
  }

  function setDonationAmount(amt) {
    const el = _el('modal-donation-amount'); if (el) el.value = amt;
    document.querySelectorAll('#modal-donation .donation-preset').forEach(b =>
      b.classList.toggle('active', Number(b.dataset.amount) === amt)
    );
  }

  function submitDonation() {
    const ngoId   = _el('modal-donation-ngo-id')?.value;
    const ngoName = _el('modal-donation-ngo-name')?.value;
    const amount  = parseFloat(_el('modal-donation-amount')?.value || '');
    const note    = (_el('modal-donation-note')?.value || '').trim();
    const errEl   = _el('modal-donation-error');

    if (!amount || amount <= 0) {
      if (errEl) { errEl.textContent = '⚠️ Please enter a valid amount.'; errEl.classList.remove('hidden'); }
      return;
    }

    const user = Auth.getCurrentUser();

    // Debit from donor wallet if sufficient
    let deducted = false;
    if (DB.wallets) {
      const bal = DB.wallets.getBalance(user?.uid);
      if (bal >= amount) {
        DB.wallets.debit(user.uid, amount);
        DB.wallets.credit(ngoId, amount);
        deducted = true;
      }
    }

    DB.donations.create({ fromUserId: user?.uid || 'guest', fromName: user?.displayName || 'Anonymous', toNgoId: ngoId, toNgoName: ngoName, amount, note });
    DB.notifications.create({ userId: ngoId, message: `${user?.displayName||'Someone'} donated ${_rupee(amount)}${note ? ` — "${note}"` : ''}`, type: 'success', icon: '💚' });
    DB.activityFeed?.push(`${user?.displayName||'A supporter'} donated ${_rupee(amount)} to ${ngoName}`, 'donation');
    Auth.refreshSession();

    closeModal('modal-donation');
    showToast(`${_rupee(amount)} donated to ${ngoName}!${deducted ? ' Wallet debited.' : ' (Demo — wallet balance insufficient, no deduction)'}`, 'success');
  }

  function openBonusModal(volId, volName) {
    const idEl  = _el('modal-bonus-vol-id');   if (idEl)  idEl.value  = volId;
    const nmEl  = _el('modal-bonus-vol-name'); if (nmEl)  nmEl.value  = volName;
    const lblEl = _el('modal-bonus-vol-label');
    if (lblEl) lblEl.innerHTML = `Rewarding: <strong>${volName}</strong>`;
    const amtEl = _el('modal-bonus-amount'); if (amtEl) amtEl.value = '';
    const noteEl= _el('modal-bonus-note');   if (noteEl) noteEl.value = '';
    document.querySelectorAll('#modal-bonus .donation-preset').forEach(b => b.classList.remove('active'));

    // Show NGO's wallet balance
    const user = Auth.getCurrentUser();
    const bal  = DB.wallets ? DB.wallets.getBalance(user?.uid) : 0;
    const balEl = _el('modal-bonus-balance');
    if (balEl) balEl.textContent = `NGO wallet: ${_rupee(bal)}`;
    openModal('modal-bonus');
  }

  function setBonusAmount(amt) {
    const el = _el('modal-bonus-amount'); if (el) el.value = amt;
    document.querySelectorAll('#modal-bonus .donation-preset').forEach(b =>
      b.classList.toggle('active', Number(b.dataset.amount) === amt)
    );
  }

  function submitBonus() {
    const volId   = _el('modal-bonus-vol-id')?.value;
    const volName = _el('modal-bonus-vol-name')?.value;
    const amount  = parseFloat(_el('modal-bonus-amount')?.value || '');
    const note    = (_el('modal-bonus-note')?.value || '').trim();
    if (!amount || amount <= 0) { showToast('Please enter a valid bonus amount.', 'warning'); return; }

    const user = Auth.getCurrentUser();

    // Debit from NGO wallet, credit volunteer wallet
    let deducted = false;
    if (DB.wallets) {
      const bal = DB.wallets.getBalance(user?.uid);
      if (bal >= amount) {
        DB.wallets.debit(user.uid, amount);
        DB.wallets.credit(volId, amount);
        deducted = true;
      }
    }

    DB.bonuses.create({ fromNgoId: user?.uid, fromNgoName: user?.displayName, toVolId: volId, toVolName: volName, amount, note });
    DB.notifications.create({ userId: volId, message: `🏆 ${user?.displayName} sent you a bonus of ${_rupee(amount)}${note ? ` — "${note}"` : ''}`, type: 'success', icon: '🏆' });
    DB.activityFeed?.push(`${user?.displayName} rewarded ${volName} with ${_rupee(amount)}`, 'bonus');
    Auth.refreshSession();

    closeModal('modal-bonus');
    showToast(`${_rupee(amount)} bonus sent to ${volName}!${deducted ? ' Wallet updated.' : ''}`, 'success');
    _renderNgoVolPool();
  }


// ────────────────────────────────────────────────────────────────
// INCENTIVES TAB — updated with wallet balance
// SEARCH: function _renderIncentives() {
// REPLACE the ENTIRE function with:
// ────────────────────────────────────────────────────────────────

  function _renderIncentives() {
    const user = Auth.getCurrentUser();
    if (!user) return;
    const el = _el('vol-tab-incentives');
    if (!el) return;

    const bonuses  = DB.bonuses.getByVol(user.uid);
    const total    = DB.bonuses.getTotalForVol(user.uid);
    const balance  = DB.wallets ? DB.wallets.getBalance(user.uid) : 0;

    el.innerHTML = `
      <div class="dash-tab-header">
        <div><h2 class="dash-title">Incentives & Wallet</h2><p class="dash-sub">Bonuses awarded by NGOs and your current ₹ balance.</p></div>
      </div>

      <!-- Wallet Card -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">
        <div class="card" style="text-align:center;background:linear-gradient(135deg,var(--navy),var(--navy-mid));color:white;border:none">
          <div style="font-size:.78rem;color:rgba(255,255,255,.5);margin-bottom:6px">CURRENT WALLET BALANCE</div>
          <div style="font-size:2rem;font-weight:800">${_rupee(balance)}</div>
          <div style="font-size:.75rem;color:rgba(255,255,255,.4);margin-top:4px">Demo ₹ — Not real money</div>
        </div>
        <div class="card" style="text-align:center;background:var(--amber-50);border:1px solid var(--amber-100)">
          <div style="font-size:.78rem;color:var(--amber);margin-bottom:6px;font-weight:600">TOTAL BONUSES RECEIVED</div>
          <div style="font-size:2rem;font-weight:800;color:var(--amber)">${_rupee(total)}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${bonuses.length} bonus transaction${bonuses.length!==1?'s':''}</div>
        </div>
      </div>

      ${bonuses.length === 0 ? _emptyState('🏆', 'No incentives yet', 'Complete tasks and NGOs can award you bonuses here!') : `
        <div class="dash-section-title">Bonus Transactions</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${bonuses.map(b => `
            <div class="card" style="display:flex;align-items:center;gap:14px;padding:14px 18px">
              <div style="width:42px;height:42px;border-radius:50%;background:var(--amber-50);border:2px solid var(--amber-100);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">🏆</div>
              <div style="flex:1">
                <div style="font-weight:700">${_rupee(Number(b.amount))}</div>
                <div style="font-size:.8rem;color:var(--text-3)">From ${b.fromNgoName} · ${new Date(b.date).toLocaleDateString('en-IN')}</div>
                ${b.note ? `<div style="font-size:.78rem;color:var(--text-muted);font-style:italic">"${b.note}"</div>` : ''}
              </div>
              <span class="badge badge-amber">${_rupee(Number(b.amount))}</span>
            </div>`).join('')}
        </div>`}`;
  }


// ────────────────────────────────────────────────────────────────
// DONATIONS PAGE (NGO) — with wallet balance
// SEARCH: function _renderNgoDonations() {
// REPLACE the ENTIRE function with:
// ────────────────────────────────────────────────────────────────

  function _renderNgoDonations() {
    const user = Auth.getCurrentUser();
    if (!user) return;
    const el = _el('ngo-tab-donations');
    if (!el) return;

    const donations = DB.donations.getByNgo(user.uid);
    const total     = DB.donations.getTotalForNgo(user.uid);
    const balance   = DB.wallets ? DB.wallets.getBalance(user.uid) : 0;

    el.innerHTML = `
      <div class="dash-tab-header">
        <div><h2 class="dash-title">Donations Received</h2><p class="dash-sub">Demo ₹ contributions from supporters.</p></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">
        <div class="card" style="text-align:center;background:linear-gradient(135deg,var(--navy),var(--navy-mid));color:white;border:none">
          <div style="font-size:.78rem;color:rgba(255,255,255,.5);margin-bottom:6px">NGO WALLET BALANCE</div>
          <div style="font-size:2rem;font-weight:800">${_rupee(balance)}</div>
          <div style="font-size:.75rem;color:rgba(255,255,255,.4);margin-top:4px">Demo ₹ — Not real money</div>
        </div>
        <div class="card" style="text-align:center;background:var(--green-50);border:1px solid var(--green-100)">
          <div style="font-size:.78rem;color:var(--green-mid);margin-bottom:6px;font-weight:600">TOTAL DONATIONS RECEIVED</div>
          <div style="font-size:2rem;font-weight:800;color:var(--green-mid)">${_rupee(total)}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${donations.length} donation${donations.length!==1?'s':''}</div>
        </div>
      </div>

      ${donations.length === 0 ? _emptyState('💚', 'No donations yet', '') : `
        <div class="dash-section-title">Transaction History</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${donations.map(d => `
            <div class="card" style="display:flex;align-items:center;gap:14px;padding:14px 18px">
              <div style="width:42px;height:42px;border-radius:50%;background:var(--green-50);border:2px solid var(--green-100);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">💚</div>
              <div style="flex:1">
                <div style="font-weight:700">${_rupee(Number(d.amount))}</div>
                <div style="font-size:.8rem;color:var(--text-3)">From ${d.fromName} · ${new Date(d.date).toLocaleDateString('en-IN')}</div>
                ${d.note ? `<div style="font-size:.78rem;color:var(--text-muted);font-style:italic">"${d.note}"</div>` : ''}
              </div>
              <span class="badge badge-green">${_rupee(Number(d.amount))}</span>
            </div>`).join('')}
        </div>`}`;
  }


  // ─────────────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────────────
  function _init() {
    _updateNavbar();
    const user = Auth.getCurrentUser();
    // If session exists, go to their dashboard; otherwise show landing
    if (user) {
      showPage(user.role === 'volunteer' ? 'vol-dash' : 'ngo-dash');
    } else {
      showPage('landing');
    }
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────
  function _notifyMatchedVolunteer(volId, taskId) {
    showToast('Match notification sent to volunteer!', 'success');
  }
  return {
    // Navigation
    showPage,
    runSmartMatch,
    guardPage,

    // Auth
    setAuthTab,
    setAuthMode,
    selectRole,
    setSignupRole,
    setSignupRoleGeneral,
    toggleSignupSkill,
    toggleDayChip,
    togglePasswordVisibility,
    fillDemoLogin,
    handleLogin,
    handleSignup,
    handleGeneralSignup,
    handleLogout,

    // Notifications
    toggleNotifPanel,
    markAllNotifRead,
    _markNotifRead,

    // Modals
    openModal,
    closeModal,
    handleModalOverlayClick,
    openProfileModal,
    _saveProfile,
    _handlePhotoChange,
    showTaskDetailModal,
    openAddHoursModal,
    submitAddHours,
    openReportModal,
    submitIncidentReport,
    showIncidentsPage,
    renderIncidentsPage,
    respondToIncident,

    // Volunteer dashboard
    showVolTab,
    filterByPriority,
    handleVolSearch,
    applyToTask,
    confirmRevokeCommitment,
    toggleAvailDay,
    saveAvailability,

    // NGO dashboard
    showNgoTab,
    approveApplication,
    rejectApplication,
    runSmartMatch,
    
    toggleTaskStatus,
    confirmDeleteTask,
    renderNgoAnalyticsPage,

    // Create task
    toggleTaskSkill,
    createTask,

    // Leaderboard
    _renderLeaderboard,
    // Squads
    _renderSquadsTab,
    createSquad,
    joinSquad,
    leaveSquad,
    openSquadChat,
    closeSquadChatModal,
    renderSquadChat,
    sendSquadChatMessage,
    _openCreateSquadModal,
    _openInviteSquadModal,
    _removeFromSquad,
    // Certificate
    downloadCertificate,
    generateCertificateForVol,
    _openCertificateOverlay,
    closeCertificate,
    _renderCertificates,
    // Activity feed
    _startActivityFeed,
    // Messaging (replace existing stubs with these)
    openMessageModal,
    sendChatMessage,
    openInbox,
    _markNotifRead,
    // Financial
    submitDonation,
    submitBonus,
    setDonationAmount,
    setBonusAmount,
    openDonationModal,
    openBonusModal,
    _renderIncentives,
    _renderNgoDonations,
    // Analytics
    _renderEndedTasksDetail,
    _setMoneySavedFilter,
    _setMoneySavedProject,

    // Messaging
    openMessageModal,
    sendChatMessage,
    openInbox,
    _renderChatThread,
    _updateMsgBadge,

    // Search
    handleGlobalSearch,
    closeSearch,
    handleLogin,
    handleSignup,
    handleLogout,
    _clearFormErrors,

    // NGO Profile page
    openNgoProfilePage,
    _goBack,

    // Rate NGO
    openRateNgoModal,
    selectNgoStar,
    submitNgoRating,

    // Rate Volunteer
    openRateVolModal,
    selectVolStar,
    submitVolRating,

    // Donation / Bonus
    openDonationModal,
    setDonationAmount,
    submitDonation,
    openBonusModal,
    setBonusAmount,
    submitBonus,

    // Invite
    openInviteToTaskModal,
    _sendInvite,

    // Analytics filter
    _setMoneySavedFilter,
    _setMoneySavedProject,
    _notifyMatchedVolunteer,
  };

})();

window.App = App;
console.info('[VolunteerBridge] App module ready.');