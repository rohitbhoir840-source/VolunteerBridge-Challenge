/**
 * ================================================================
 * demo_init.js — Demo Data Initialiser
 * VolunteerBridge v2.1
 * ================================================================
 * Load order in index.html (add BEFORE app.js):
 *   <script src="backend.js"></script>
 *   <script src="auth.js"></script>
 *   <script src="demo_init.js"></script>   ← NEW
 *   <script src="app.js"></script>
 *
 * This file:
 *   1. Checks whether demo data has already been seeded.
 *   2. If NOT seeded, injects:
 *        • 5 Squads (with members and squad-chat messages)
 *        • 10 Commitments (6 active, 4 history) across volunteers
 *        • 5 Donations with donor names + notes
 *        • 3 Live Incidents (mix of High/Low criticality)
 *        • Matching activity-feed entries
 *        • Wallet balances for all seeded users
 *        • 3 Certificates for completed tasks
 *        • Sample NGO ratings
 *        • Sample volunteer bonus records
 *        • Sample messages between users
 *   3. Marks localStorage so it never runs twice.
 * ================================================================
 */

'use strict';

(function DemoInit() {

  const DEMO_FLAG_KEY = 'vb2_demo_seeded_v2';
  const DB_KEY        = 'vb2_database';

  // Skip if already seeded
  if (localStorage.getItem(DEMO_FLAG_KEY)) {
    console.info('[DemoInit] Already seeded — skipping.');
    return;
  }

  // Read current DB (may already have seed users/tasks from backend.js _SEED)
  let db = {};
  try { db = JSON.parse(localStorage.getItem(DB_KEY) || '{}'); } catch { db = {}; }

  // Helpers
  function _iso(daysAgo = 0) {
    const d = new Date(Date.now() - daysAgo * 86400000);
    return d.toISOString();
  }
  function _date(daysAgo = 0) { return _iso(daysAgo).split('T')[0]; }
  function _uid() { return 'uid_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6); }

  // Ensure all collections exist
  ['squads','incidents','messages','donations','bonuses',
   'certificates','ngoRatings','activityFeed','wallets'].forEach(k => {
    if (!db[k]) db[k] = {};
  });
  if (!db.users)  db.users  = {};
  if (!db.tasks)  db.tasks  = {};
  if (!db.notifications) db.notifications = {};

  // ── KNOWN SEED IDs ──────────────────────────────────────────
  const VOL_IDS  = Object.keys(db.users).filter(uid => db.users[uid]?.role === 'volunteer');
  const NGO_IDS  = Object.keys(db.users).filter(uid => db.users[uid]?.role === 'ngo');
  const TASK_IDS = Object.keys(db.tasks);

  const V1 = VOL_IDS[0] || 'vol_001';
  const V2 = VOL_IDS[1] || 'vol_002';
  const V3 = VOL_IDS[2] || 'vol_003';
  const V4 = VOL_IDS[3] || 'vol_004';
  const V5 = VOL_IDS[4] || 'vol_005';
  const V6 = VOL_IDS[5] || 'vol_006';
  const N1 = NGO_IDS[0] || 'ngo_001';
  const N2 = NGO_IDS[1] || 'ngo_002';
  const T1 = TASK_IDS[0] || 't_001';
  const T2 = TASK_IDS[1] || 't_002';
  const T3 = TASK_IDS[2] || 't_003';
  const T4 = TASK_IDS[3] || 't_004';
  const T5 = TASK_IDS[4] || 't_005';

  // Helper to read volunteer/ngo name safely
  function vname(uid) { return db.users[uid]?.displayName || uid; }
  function tname(tid) { return db.tasks[tid]?.title || tid; }

  // ── 1. WALLET BALANCES ──────────────────────────────────────
  VOL_IDS.forEach(uid => { if (db.users[uid]) db.users[uid].wallet = db.users[uid].wallet || 1200; });
  NGO_IDS.forEach(uid => { if (db.users[uid]) db.users[uid].wallet = db.users[uid].wallet || 8000; });

  // ── 2. MARK SEED USERS AS VERIFIED ─────────────────────────
  VOL_IDS.forEach(uid => { if (db.users[uid]) db.users[uid].verified = true; });
  NGO_IDS.forEach(uid => { if (db.users[uid]) db.users[uid].verified = true; });
  // Give volunteers rating arrays if missing
  VOL_IDS.forEach(uid => { if (db.users[uid] && !db.users[uid].ratings) db.users[uid].ratings = []; });

  // ── 3. COMMITMENTS (applications on tasks) ──────────────────
  // Active: 6 pending/approved applications on open tasks
  // History: 4 revoked/rejected or on completed task
  function addApp(taskId, volId, status) {
    if (!db.tasks[taskId]) return;
    if (!db.tasks[taskId].applications) db.tasks[taskId].applications = [];
    const already = db.tasks[taskId].applications.some(a => a.userId === volId);
    if (already) return;
    const vol = db.users[volId];
    db.tasks[taskId].applications.push({
      userId: volId,
      userName: vol?.displayName || volId,
      userEmail: vol?.email || '',
      userSkills: vol?.skills || [],
      userLocation: vol?.location || '',
      status,
      appliedDate: _date(Math.floor(Math.random() * 10) + 1),
    });
  }

  // Active commitments (6)
  addApp(T1, V1, 'approved');
  addApp(T1, V5, 'pending');
  addApp(T2, V2, 'approved');
  addApp(T2, V3, 'pending');
  addApp(T3, V4, 'approved');
  addApp(T4, V6, 'pending');

  // History (4 — make one task "Complete" with revoked/approved history)
  if (db.tasks[T5]) {
    db.tasks[T5].status = 'Complete';
    db.tasks[T5].completedDate = _date(5);
  }
  addApp(T5, V1, 'approved');
  addApp(T5, V2, 'approved');
  addApp(T3, V3, 'rejected');
  addApp(T4, V4, 'revoked');

  // Log some hours
  if (db.tasks[T5]) {
    db.tasks[T5].hoursLogged = db.tasks[T5].hoursLogged || {};
    db.tasks[T5].hoursLogged[V1] = 12;
    db.tasks[T5].hoursLogged[V2] = 8;
    if (db.users[V1]) db.users[V1].hours = (db.users[V1].hours || 0) + 12;
    if (db.users[V2]) db.users[V2].hours = (db.users[V2].hours || 0) + 8;
  }

  // ── 4. FIVE SQUADS ──────────────────────────────────────────
  const squads = [
    {
      id: 'squad_001', name: 'Pune Heroes 💪',
      description: 'Pune-based volunteers for health and tech causes.',
      leaderId: V1, leaderName: vname(V1),
      members: [
        { uid: V1, name: vname(V1), joinedAt: _date(30) },
        { uid: V2, name: vname(V2), joinedAt: _date(25) },
        { uid: V6, name: vname(V6), joinedAt: _date(20) },
      ],
      chat: [
        { id: 'sc_001', fromId: V1, fromName: vname(V1), text: 'Hey team! Medical camp this Saturday at Hadapsar — who can make it? 🏥', createdAt: _iso(2) },
        { id: 'sc_002', fromId: V2, fromName: vname(V2), text: 'Count me in! I can also bring some tech equipment for registration.', createdAt: _iso(1) },
        { id: 'sc_003', fromId: V6, fromName: vname(V6), text: 'I will be there too. Should we coordinate transport?', createdAt: _iso(0) },
      ],
      totalHours: (db.users[V1]?.hours || 0) + (db.users[V2]?.hours || 0),
      createdAt: _date(30),
    },
    {
      id: 'squad_002', name: 'Delhi Relief Force 🌊',
      description: 'Focused on disaster relief and logistics in Delhi NCR.',
      leaderId: V4, leaderName: vname(V4),
      members: [
        { uid: V4, name: vname(V4), joinedAt: _date(45) },
        { uid: V3, name: vname(V3), joinedAt: _date(40) },
      ],
      chat: [
        { id: 'sc_004', fromId: V4, fromName: vname(V4), text: 'Flood relief deployment starts Monday. Please confirm availability by Sunday.', createdAt: _iso(3) },
        { id: 'sc_005', fromId: V3, fromName: vname(V3), text: 'Confirmed! Will be at the assembly point by 6 AM.', createdAt: _iso(2) },
      ],
      totalHours: (db.users[V4]?.hours || 0) + (db.users[V3]?.hours || 0),
      createdAt: _date(45),
    },
    {
      id: 'squad_003', name: 'Bangalore Counselors 🧠',
      description: 'Mental health awareness and education volunteers.',
      leaderId: V5, leaderName: vname(V5),
      members: [
        { uid: V5, name: vname(V5), joinedAt: _date(20) },
        { uid: V3, name: vname(V3), joinedAt: _date(18) },
      ],
      chat: [
        { id: 'sc_006', fromId: V5, fromName: vname(V5), text: 'Session materials for the college drive are ready. Sharing the drive link.', createdAt: _iso(1) },
      ],
      totalHours: (db.users[V5]?.hours || 0),
      createdAt: _date(20),
    },
    {
      id: 'squad_004', name: 'Tech4Good India 💻',
      description: 'Digital literacy and tech-for-social-good volunteers.',
      leaderId: V2, leaderName: vname(V2),
      members: [
        { uid: V2, name: vname(V2), joinedAt: _date(60) },
        { uid: V6, name: vname(V6), joinedAt: _date(55) },
      ],
      chat: [
        { id: 'sc_007', fromId: V2, fromName: vname(V2), text: 'Workshop curriculum for the elderly session is finalized — 4 modules.', createdAt: _iso(5) },
        { id: 'sc_008', fromId: V6, fromName: vname(V6), text: 'Great! I can handle the hands-on practice portion.', createdAt: _iso(4) },
      ],
      totalHours: (db.users[V2]?.hours || 0) + (db.users[V6]?.hours || 0),
      createdAt: _date(60),
    },
    {
      id: 'squad_005', name: 'Medical Response Unit 🏥',
      description: 'Rapid medical response and community health outreach.',
      leaderId: V5, leaderName: vname(V5),
      members: [
        { uid: V5, name: vname(V5), joinedAt: _date(90) },
        { uid: V1, name: vname(V1), joinedAt: _date(85) },
      ],
      chat: [
        { id: 'sc_009', fromId: V5, fromName: vname(V5), text: 'Stock check: BP monitors x10, glucometers x5. All confirmed.', createdAt: _iso(7) },
        { id: 'sc_010', fromId: V1, fromName: vname(V1), text: 'I have extra gloves and masks — bringing 200 pairs.', createdAt: _iso(6) },
      ],
      totalHours: (db.users[V5]?.hours || 0) + (db.users[V1]?.hours || 0),
      createdAt: _date(90),
    },
  ];
  squads.forEach(s => { db.squads[s.id] = s; });

  // ── 5. FIVE DONATIONS WITH NOTES ────────────────────────────
  const donations = [
    { id:'don_001', fromUserId:V5, fromName:vname(V5), toNgoId:N1, toNgoName:db.users[N1]?.displayName||'Health First NGO', amount:500,  note:'Great cause! Keep healing our communities.', currency:'INR', date:_iso(3) },
    { id:'don_002', fromUserId:V1, fromName:vname(V1), toNgoId:N1, toNgoName:db.users[N1]?.displayName||'Health First NGO', amount:1000, note:'Proud to support the medical camp initiative.', currency:'INR', date:_iso(6) },
    { id:'don_003', fromUserId:V4, fromName:vname(V4), toNgoId:N2, toNgoName:db.users[N2]?.displayName||'TechForAll Foundation', amount:250, note:'Digital literacy matters — keep it up!', currency:'INR', date:_iso(10) },
    { id:'don_004', fromUserId:V3, fromName:vname(V3), toNgoId:N1, toNgoName:db.users[N1]?.displayName||'Health First NGO', amount:750, note:'For the rural healthcare drive.', currency:'INR', date:_iso(15) },
    { id:'don_005', fromUserId:'guest', fromName:'Anonymous Donor', toNgoId:N2, toNgoName:db.users[N2]?.displayName||'TechForAll Foundation', amount:2000, note:'Technology is the great equalizer. You have my support.', currency:'INR', date:_iso(20) },
  ];
  donations.forEach(d => { db.donations[d.id] = d; });

  // Credit NGO wallets
  const n1total = donations.filter(d=>d.toNgoId===N1).reduce((s,d)=>s+d.amount,0);
  const n2total = donations.filter(d=>d.toNgoId===N2).reduce((s,d)=>s+d.amount,0);
  if (db.users[N1]) db.users[N1].wallet = (db.users[N1].wallet || 8000) + n1total;
  if (db.users[N2]) db.users[N2].wallet = (db.users[N2].wallet || 8000) + n2total;

  // ── 6. THREE LIVE INCIDENTS ─────────────────────────────────
  const incidents = [
    {
      id: 'inc_001',
      type: 'Flood / Water Logging',
      description: 'Severe waterlogging in low-lying areas. 3 families stranded. Rescue boats needed.',
      fatalities: 0, injuries: 4, criticality: 'High',
      location: 'Delhi', state: 'Delhi',
      reporterId: V4, reporterName: vname(V4), reporterRole: 'volunteer',
      status: 'Open',
      responders: [
        { uid: N1, name: db.users[N1]?.displayName||'Health First NGO', role: 'ngo', respondedAt: _iso(1) },
      ],
      reportedAt: _iso(2),
    },
    {
      id: 'inc_002',
      type: 'Mass Casualty — Road Accident',
      description: 'Multi-vehicle pile-up on NH-48. Approx 15 vehicles involved. Ambulances en route but medical volunteers urgently needed.',
      fatalities: 2, injuries: 12, criticality: 'High',
      location: 'Pune', state: 'Maharashtra',
      reporterId: 'gen_demo_01', reporterName: 'Ravi Kulkarni', reporterRole: 'general',
      status: 'Open',
      responders: [],
      reportedAt: _iso(0),
    },
    {
      id: 'inc_003',
      type: 'Community Health Concern — Dengue Outbreak',
      description: 'Rising dengue cases in Marathahalli area. 30+ confirmed cases this week. Awareness drive and fumigation support needed.',
      fatalities: 0, injuries: 0, criticality: 'Low',
      location: 'Bangalore', state: 'Karnataka',
      reporterId: V5, reporterName: vname(V5), reporterRole: 'volunteer',
      status: 'Open',
      responders: [
        { uid: V3, name: vname(V3), role: 'volunteer', respondedAt: _iso(1) },
      ],
      reportedAt: _iso(4),
    },
  ];
  incidents.forEach(i => { db.incidents[i.id] = i; });

  // ── 7. CERTIFICATES for completed tasks ─────────────────────
  const certs = [
    {
      id: 'cert_001', taskId: T5, taskTitle: tname(T5),
      ngoId: N1, ngoName: db.users[N1]?.displayName || 'Health First NGO',
      recipientId: V1, recipientName: vname(V1),
      hoursContributed: 12, issuedDate: _date(5),
      message: 'In recognition of outstanding contribution to community development and tireless service to the people of Pune.',
    },
    {
      id: 'cert_002', taskId: T5, taskTitle: tname(T5),
      ngoId: N1, ngoName: db.users[N1]?.displayName || 'Health First NGO',
      recipientId: V2, recipientName: vname(V2),
      hoursContributed: 8, issuedDate: _date(5),
      message: 'In recognition of outstanding contribution to community development and tireless service to the people of Pune.',
    },
  ];
  certs.forEach(c => { db.certificates[c.id] = c; });

  // ── 8. NGO RATINGS ──────────────────────────────────────────
  db.ngoRatings['ngort_001'] = { id:'ngort_001', ngoId:N1, ngoName:db.users[N1]?.displayName||'', byId:V1, byName:vname(V1), score:5, note:'Amazing organization — truly making a difference!', date:_date(15) };
  db.ngoRatings['ngort_002'] = { id:'ngort_002', ngoId:N1, ngoName:db.users[N1]?.displayName||'', byId:V5, byName:vname(V5), score:4, note:'Great coordination and support throughout.', date:_date(20) };
  db.ngoRatings['ngort_003'] = { id:'ngort_003', ngoId:N2, ngoName:db.users[N2]?.displayName||'', byId:V2, byName:vname(V2), score:5, note:'The bootcamp changed lives. Exceptional work!', date:_date(30) };

  // ── 9. VOLUNTEER RATINGS ─────────────────────────────────────
  if (db.users[V1]) db.users[V1].ratings = [{ by:N1, byName:db.users[N1]?.displayName||'', score:5, note:'Exceptional medical professional and leader.', date:_date(6) }];
  if (db.users[V5]) db.users[V5].ratings = [{ by:N1, byName:db.users[N1]?.displayName||'', score:5, note:'Incredible dedication — our top volunteer.', date:_date(10) }, { by:N2, byName:db.users[N2]?.displayName||'', score:4, note:'Great at community engagement.', date:_date(20) }];
  if (db.users[V4]) db.users[V4].ratings = [{ by:N1, byName:db.users[N1]?.displayName||'', score:4, note:'Very reliable and hard-working.', date:_date(8) }];

  // ── 10. BONUSES ──────────────────────────────────────────────
  db.bonuses['bon_001'] = { id:'bon_001', fromNgoId:N1, fromNgoName:db.users[N1]?.displayName||'', toVolId:V1, toVolName:vname(V1), amount:1500, note:'Outstanding leadership at the medical camp!', currency:'INR', date:_iso(7) };
  db.bonuses['bon_002'] = { id:'bon_002', fromNgoId:N1, fromNgoName:db.users[N1]?.displayName||'', toVolId:V4, toVolName:vname(V4), amount:2000, note:'Exceptional fieldwork during flood relief.', currency:'INR', date:_iso(8) };
  if (db.users[V1]) db.users[V1].wallet = (db.users[V1].wallet || 1200) + 1500;
  if (db.users[V4]) db.users[V4].wallet = (db.users[V4].wallet || 1200) + 2000;

  // ── 11. MESSAGES (sample threads) ────────────────────────────
  const msgs = [
    { id:'msg_001', fromId:N1, fromName:db.users[N1]?.displayName||'', toId:V1, toName:vname(V1), text:'Hi Anjali! Please arrive by 7:30 AM Saturday for the medical camp. Bring your stethoscope.', read:true, createdAt:_iso(3) },
    { id:'msg_002', fromId:V1, fromName:vname(V1), toId:N1, toName:db.users[N1]?.displayName||'', text:'Will be there! Should I bring extra gloves?', read:true, createdAt:_iso(2) },
    { id:'msg_003', fromId:N1, fromName:db.users[N1]?.displayName||'', toId:V1, toName:vname(V1), text:'Yes please! We will provide disposables. Thank you 🙏', read:false, createdAt:_iso(1) },
    { id:'msg_004', fromId:N2, fromName:db.users[N2]?.displayName||'', toId:V2, toName:vname(V2), text:'Rohan, can you prepare the intro slide deck for the Digital Literacy workshop?', read:false, createdAt:_iso(1) },
    { id:'msg_005', fromId:V5, fromName:vname(V5), toId:N1, toName:db.users[N1]?.displayName||'', text:'Quick question — are we covering pediatric cases at the camp too?', read:false, createdAt:_iso(0) },
  ];
  msgs.forEach(m => { db.messages[m.id] = m; });

  // ── 12. ACTIVITY FEED ────────────────────────────────────────
  const feed = [
    { id:'act_001', msg:`${vname(V1)} joined a Critical Medical Camp task 🏥`, type:'critical', createdAt:_iso(12) },
    { id:'act_002', msg:`${vname(V4)} joined a Critical Flood Relief task 🌊`, type:'critical', createdAt:_iso(25) },
    { id:'act_003', msg:`${vname(V2)} completed 8 hours for Digital Literacy Workshop 💻`, type:'hours', createdAt:_iso(40) },
    { id:'act_004', msg:`${vname(V5)} applied to Medical Camp — Hadapsar 🎯`, type:'apply', createdAt:_iso(55) },
    { id:'act_005', msg:`Squad "Pune Heroes" created — 3 members strong ⚔️`, type:'squad', createdAt:_iso(70) },
    { id:'act_006', msg:`🔴 High incident reported: Flood in Delhi — ${vname(V4)} responding`, type:'critical', createdAt:_iso(2) },
    { id:'act_007', msg:`${db.users[N2]?.displayName||'TechForAll'} posted a new High priority task 📋`, type:'task', createdAt:_iso(120) },
    { id:'act_008', msg:`${vname(V1)} donated ₹1,000 to ${db.users[N1]?.displayName||''} 💚`, type:'donation', createdAt:_iso(6) },
  ];
  feed.forEach(f => { db.activityFeed[f.id] = f; });

  // ── 13. NOTIFICATIONS ─────────────────────────────────────────
  // Notify volunteers about the high-criticality incident
  const incNotifId = 'notif_inc_001';
  if (!db.notifications[incNotifId]) {
    VOL_IDS.forEach(vid => {
      const nid = 'notif_inc_' + vid;
      db.notifications[nid] = {
        id: nid, userId: vid,
        message: '🔴 New Critical Incident reported in Delhi — Flood victims need help. Check the Incidents board.',
        type: 'alert', icon: '🚨', read: false, createdAt: _iso(2),
      };
    });
    NGO_IDS.forEach(nid => {
      const notifId = 'notif_inc_ngo_' + nid;
      db.notifications[notifId] = {
        id: notifId, userId: nid,
        message: '🔴 Critical Incident in Delhi requires NGO response. View the Incidents board.',
        type: 'alert', icon: '🚨', read: false, createdAt: _iso(2),
      };
    });
  }

  // ── WRITE ─────────────────────────────────────────────────────
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  localStorage.setItem(DEMO_FLAG_KEY, '1');
  console.info('[DemoInit] Demo data seeded successfully.');

})();