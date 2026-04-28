const firebaseConfig = {
  apiKey: "AIzaSyCHbbUc6C9ZknQfSW-Ofjx4beut98we_zY",
  authDomain: "smartresourceallocation-dbbcc.firebaseapp.com",
  projectId: "smartresourceallocation-dbbcc",
  storageBucket: "smartresourceallocation-dbbcc.firebasestorage.app",
  messagingSenderId: "89897140322",
  appId: "1:89897140322:web:da4dae3048cd17fc5bd13b",
  measurementId: "G-MS0F6V96XV"
};
// 2. Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
// 3. Create global variables for the database and auth
window.db = firebase.firestore();
window.auth = firebase.auth();
/**
 * =============================================================
 * backend.js — Mock Firebase Database Engine
 * VolunteerBridge v2.0
 * =============================================================
 *
 * Simulates Firestore using localStorage.
 * All data persists across browser refreshes.
 *
 * ═══════════════════════════════════════════════════════════
 * HOW TO CONNECT REAL FIREBASE (Migration Guide)
 * ═══════════════════════════════════════════════════════════
 *
 * STEP 1 — Add Firebase CDN to index.html (before other scripts):
 *   <script src="https://www.gstatic.com/firebasejs/10.x.x/firebase-app-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/10.x.x/firebase-firestore-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/10.x.x/firebase-auth-compat.js"></script>
 *
 * STEP 2 — Initialize Firebase (replace MockFirebaseDB):
 *   const firebaseConfig = { apiKey: "...", authDomain: "...", projectId: "..." };
 *   firebase.initializeApp(firebaseConfig);
 *   const firestoreDB = firebase.firestore();
 *
 * STEP 3 — Replace DB.users.getAll() with:
 *   firestoreDB.collection('users').get().then(snap => snap.docs.map(d => d.data()))
 *
 * STEP 4 — Replace DB.users.create() with:
 *   firebase.auth().createUserWithEmailAndPassword(email, password)
 *     .then(cred => firestoreDB.collection('users').doc(cred.user.uid).set(data))
 *
 * STEP 5 — Replace DB.tasks methods with Firestore queries:
 *   firestoreDB.collection('tasks').where('ngoId', '==', ngoId).get()
 *
 * All localStorage reads/writes in this file → Firestore get/set calls.
 * =============================================================
 */

'use strict';

const _DB_STORAGE_KEY = 'vb2_database';
const _SALT = '_vb2_salt_2025';

// ─────────────────────────────────────────────────────────────
// PASSWORD HASH  (demo only — replace with bcrypt in production)
// ─────────────────────────────────────────────────────────────
function _hashPassword(plain) {
  const str = plain + _SALT;
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 2654435761);
    h ^= h >>> 16;
  }
  return 'vbh_' + (h >>> 0).toString(16).padStart(8, '0');
}

function _verifyPassword(plain, stored) {
  return _hashPassword(plain) === stored;
}

// ─────────────────────────────────────────────────────────────
// SEED DATA
// ─────────────────────────────────────────────────────────────
const _SEED = {

  /* ── USERS ──────────────────────────────────────────────────── */
  users: {
    ngo_001: {
      uid: 'ngo_001', role: 'ngo',
      displayName: 'Health First NGO', orgName: 'Health First India',
      email: 'healthfirst@ngo.org', passwordHash: _hashPassword('health2025'),
      contactEmail: 'healthfirst@ngo.org', contactPhone: '+91-98765-43210',
      bio: 'Dedicated to bringing healthcare to underserved communities across India since 2010.',
      location: 'Pune', photoURL: null, createdAt: '2024-01-15',
      verified: true,   // ✅ Verified NGO
      wallet: 5000,    // ₹ demo balance
    },
    ngo_002: {
      uid: 'ngo_002', role: 'ngo',
      displayName: 'TechForAll Foundation', orgName: 'TechForAll Foundation',
      email: 'techforall@ngo.org', passwordHash: _hashPassword('tech2025'),
      contactEmail: 'info@techforall.org', contactPhone: '+91-87654-32109',
      bio: 'Bridging the digital divide through community-driven education programs.',
      location: 'Mumbai', photoURL: null, createdAt: '2024-03-20',
      verified: true,
      wallet: 5000,
    },
    vol_001: {
      uid: 'vol_001', role: 'volunteer',
      displayName: 'Anjali Krishnan', email: 'anjali@example.com',
      passwordHash: _hashPassword('anjali2025'), dob: '1995-04-12',
      bio: 'Passionate nurse with 5 years of community health experience.',
      photoURL: null, skills: ['Medical', 'Teaching'],
      location: 'Pune', availability: 'Weekends',
      availableDays: ['Saturday', 'Sunday'],
      hours: 48, createdAt: '2024-11-10',
      verified: true,   // ✅ Verified volunteer
      wallet: 500,     // ₹ demo bonus wallet
      ratings: [{ by: 'ngo_001', byName: 'Health First NGO', score: 5, note: 'Exceptional work!', date: '2025-05-10' }],
    },
    vol_002: {
      uid: 'vol_002', role: 'volunteer',
      displayName: 'Rohan Verma', email: 'rohan@example.com',
      passwordHash: _hashPassword('rohan2025'), dob: '1998-08-23',
      bio: 'Full-stack developer passionate about using technology for social good.',
      photoURL: null, skills: ['Tech', 'Logistics'],
      location: 'Pune', availability: 'Flexible',
      availableDays: ['Monday', 'Wednesday', 'Saturday'],
      hours: 32, createdAt: '2024-12-01',
      verified: true,
      wallet: 500,
      ratings: [],
    },
    vol_003: {
      uid: 'vol_003', role: 'volunteer',
      displayName: 'Priya Mehta', email: 'priya@example.com',
      passwordHash: _hashPassword('priya2025'), dob: '1992-03-17',
      bio: 'School teacher and counselor with 8 years of experience.',
      photoURL: null, skills: ['Teaching', 'Counseling'],
      location: 'Mumbai', availability: 'Weekends',
      availableDays: ['Saturday', 'Sunday'],
      hours: 20, createdAt: '2025-01-15',
      verified: true,
      wallet: 500,
      ratings: [],
    },
    vol_004: {
      uid: 'vol_004', role: 'volunteer',
      displayName: 'Siddharth Nair', email: 'siddharth@example.com',
      passwordHash: _hashPassword('sidd2025'), dob: '1990-11-05',
      bio: 'Civil engineer with expertise in community infrastructure.',
      photoURL: null, skills: ['Construction', 'Logistics'],
      location: 'Delhi', availability: 'Weekdays',
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      hours: 60, createdAt: '2024-10-20',
      verified: true,
      wallet: 500,
      ratings: [{ by: 'ngo_001', byName: 'Health First NGO', score: 4, note: 'Very dependable.', date: '2025-04-22' }],
    },
    vol_005: {
      uid: 'vol_005', role: 'volunteer',
      displayName: 'Kavya Sharma', email: 'kavya@example.com',
      passwordHash: _hashPassword('kavya2025'), dob: '1988-07-30',
      bio: 'MBBS doctor with 10 years in rural healthcare outreach.',
      photoURL: null, skills: ['Medical', 'Counseling'],
      location: 'Bangalore', availability: 'Full-time',
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      hours: 80, createdAt: '2024-09-05',
      verified: true,
      wallet: 500,
      ratings: [{ by: 'ngo_001', byName: 'Health First NGO', score: 5, note: 'Incredible dedication!', date: '2025-03-01' }],
    },
    vol_006: {
      uid: 'vol_006', role: 'volunteer',
      displayName: 'Arjun Patel', email: 'arjun@example.com',
      passwordHash: _hashPassword('arjun2025'), dob: '2000-06-15',
      bio: 'Computer science student eager to contribute technical skills.',
      photoURL: null, skills: ['Tech'],
      location: 'Pune', availability: 'Weekends',
      availableDays: ['Saturday', 'Sunday'],
      hours: 15, createdAt: '2025-02-10',
      verified: true,
      wallet: 500,
      ratings: [],
    },
  },

  /* ── TASKS ──────────────────────────────────────────────────── */
  tasks: {
    t_001: {
      id: 't_001', title: 'Medical Camp — Hadapsar',
      description: 'Set up and run a two-day free medical checkup camp for underprivileged residents in Hadapsar. We need medical professionals, nurses, and helpers to manage registration, vital checks, and patient flow. The camp is expected to serve approximately 500 families.',
      requiredSkills: ['Medical'], customRole: 'Camp Medical Officer',
      priority: 'Critical', location: 'Pune', status: 'Open',
      ngoId: 'ngo_001', ngoName: 'Health First NGO',
      ngoContact: 'healthfirst@ngo.org | +91-98765-43210',
      volunteersNeeded: 8, duration: 'Weekend', postedDate: '2025-06-01',
      applications: [
        { userId: 'vol_001', userName: 'Anjali Krishnan', userEmail: 'anjali@example.com', userSkills: ['Medical','Teaching'], userLocation: 'Pune', status: 'approved', appliedDate: '2025-06-02' },
        { userId: 'vol_005', userName: 'Kavya Sharma', userEmail: 'kavya@example.com', userSkills: ['Medical','Counseling'], userLocation: 'Bangalore', status: 'pending', appliedDate: '2025-06-03' },
      ],
      hoursLogged: { vol_001: 12 },
    },
    t_002: {
      id: 't_002', title: 'Digital Literacy Workshop',
      description: 'Teach basic computer skills and internet safety to elderly residents and teenagers at community centers across Mumbai. Sessions run 2 hours each morning, Monday–Friday.',
      requiredSkills: ['Tech', 'Teaching'], customRole: '',
      priority: 'High', location: 'Mumbai', status: 'Open',
      ngoId: 'ngo_002', ngoName: 'TechForAll Foundation',
      ngoContact: 'info@techforall.org | +91-87654-32109',
      volunteersNeeded: 4, duration: '1 Week', postedDate: '2025-06-03',
      applications: [
        { userId: 'vol_002', userName: 'Rohan Verma', userEmail: 'rohan@example.com', userSkills: ['Tech','Logistics'], userLocation: 'Pune', status: 'approved', appliedDate: '2025-06-04' },
        { userId: 'vol_003', userName: 'Priya Mehta', userEmail: 'priya@example.com', userSkills: ['Teaching','Counseling'], userLocation: 'Mumbai', status: 'pending', appliedDate: '2025-06-04' },
      ],
      hoursLogged: { vol_002: 8 },
    },
    t_003: {
      id: 't_003', title: 'Flood Relief Coordination',
      description: 'Coordinate distribution of relief materials — food packets, clean water, blankets, and medicine — to families affected by recent flooding in Delhi NCR.',
      requiredSkills: ['Logistics', 'Construction'], customRole: 'Relief Team Leader',
      priority: 'Critical', location: 'Delhi', status: 'Open',
      ngoId: 'ngo_001', ngoName: 'Health First NGO',
      ngoContact: 'healthfirst@ngo.org | +91-98765-43210',
      volunteersNeeded: 12, duration: '1 Week', postedDate: '2025-06-05',
      applications: [
        { userId: 'vol_004', userName: 'Siddharth Nair', userEmail: 'siddharth@example.com', userSkills: ['Construction','Logistics'], userLocation: 'Delhi', status: 'approved', appliedDate: '2025-06-06' },
      ],
      hoursLogged: { vol_004: 20 },
    },
    t_004: {
      id: 't_004', title: 'Mental Health Awareness Drive',
      description: 'Run counseling sessions and awareness workshops in 5 schools and 3 colleges across Bangalore. Topics include stress management, depression awareness, and mindfulness practices.',
      requiredSkills: ['Counseling', 'Teaching'], customRole: '',
      priority: 'Medium', location: 'Bangalore', status: 'Open',
      ngoId: 'ngo_001', ngoName: 'Health First NGO',
      ngoContact: 'healthfirst@ngo.org | +91-98765-43210',
      volunteersNeeded: 3, duration: '1 Month', postedDate: '2025-06-06',
      applications: [], hoursLogged: {},
    },
    t_005: {
      id: 't_005', title: 'Community School Renovation',
      description: 'Help renovate and paint classrooms in a rural government school near Pune. Work includes painting walls, repairing desks, laying floor tiles, and installing ceiling fans.',
      requiredSkills: ['Construction'], customRole: '',
      priority: 'Low', location: 'Pune', status: 'Complete',
      ngoId: 'ngo_001', ngoName: 'Health First NGO',
      ngoContact: 'healthfirst@ngo.org | +91-98765-43210',
      volunteersNeeded: 6, duration: 'Weekend', postedDate: '2025-05-10',
      completedDate: '2025-05-12',
      applications: [
        { userId: 'vol_002', userName: 'Rohan Verma', userEmail: 'rohan@example.com', userSkills: ['Tech','Logistics'], userLocation: 'Pune', status: 'approved', appliedDate: '2025-05-11' },
        { userId: 'vol_004', userName: 'Siddharth Nair', userEmail: 'siddharth@example.com', userSkills: ['Construction','Logistics'], userLocation: 'Delhi', status: 'approved', appliedDate: '2025-05-11' },
      ],
      hoursLogged: { vol_002: 16, vol_004: 16 },
      certificateIssued: true,
    },
  },

  /* ── NOTIFICATIONS ──────────────────────────────────────────── */
  notifications: {
    notif_001: { id: 'notif_001', userId: 'vol_001', message: 'You have been approved for "Medical Camp — Hadapsar"! 🎉', type: 'success', icon: '✅', read: false, createdAt: new Date(Date.now() - 5 * 60000).toISOString() },
    notif_002: { id: 'notif_002', userId: 'vol_001', message: 'New Critical task posted in Pune — Flood Relief Coordination!', type: 'alert', icon: '⚡', read: false, createdAt: new Date(Date.now() - 15 * 60000).toISOString() },
    notif_003: { id: 'notif_003', userId: 'vol_002', message: '"Digital Literacy Workshop" — you have been approved!', type: 'success', icon: '✅', read: false, createdAt: new Date(Date.now() - 30 * 60000).toISOString() },
    notif_004: { id: 'notif_004', userId: 'ngo_001', message: 'Kavya Sharma applied to "Medical Camp — Hadapsar".', type: 'application', icon: '📩', read: false, createdAt: new Date(Date.now() - 10 * 60000).toISOString() },
  },

  /* ── MESSAGES (seeded thread) ───────────────────────────────── */
  messages: {
    msg_001: { id: 'msg_001', fromId: 'ngo_001', fromName: 'Health First NGO', toId: 'vol_001', toName: 'Anjali Krishnan', text: 'Hi Anjali! We are excited to have you at the Medical Camp. Please arrive by 7:30 AM on Saturday.', read: true, createdAt: new Date(Date.now() - 2 * 3600000).toISOString() },
    msg_002: { id: 'msg_002', fromId: 'vol_001', fromName: 'Anjali Krishnan', toId: 'ngo_001', toName: 'Health First NGO', text: 'Thank you! I will be there. Should I bring my own stethoscope?', read: true, createdAt: new Date(Date.now() - 1.5 * 3600000).toISOString() },
    msg_003: { id: 'msg_003', fromId: 'ngo_001', fromName: 'Health First NGO', toId: 'vol_001', toName: 'Anjali Krishnan', text: 'Yes please! We will provide gloves and other disposables. See you Saturday! 🙏', read: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
    msg_004: { id: 'msg_004', fromId: 'ngo_002', fromName: 'TechForAll Foundation', toId: 'vol_002', toName: 'Rohan Verma', text: 'Rohan, can you please prepare the intro slide deck for the Digital Literacy workshop?', read: false, createdAt: new Date(Date.now() - 45 * 60000).toISOString() },
  },

  /* ── SQUADS ─────────────────────────────────────────────────── */
  squads: {
    squad_001: {
      id: 'squad_001',
      name: 'Pune Heroes 💪',
      leaderId: 'vol_001',
      leaderName: 'Anjali Krishnan',
      members: [
        { uid: 'vol_001', name: 'Anjali Krishnan', joinedAt: '2025-05-01' },
        { uid: 'vol_002', name: 'Rohan Verma',     joinedAt: '2025-05-03' },
        { uid: 'vol_006', name: 'Arjun Patel',     joinedAt: '2025-05-05' },
      ],
      description: 'Pune-based volunteers uniting for health and tech causes.',
      totalHours: 95,
      createdAt: '2025-05-01',
    },
  },

  /* ── CERTIFICATES ───────────────────────────────────────────── */
  certificates: {
    cert_001: {
      id: 'cert_001', taskId: 't_005', taskTitle: 'Community School Renovation',
      ngoId: 'ngo_001', ngoName: 'Health First NGO',
      recipientId: 'vol_002', recipientName: 'Rohan Verma',
      hoursContributed: 16, issuedDate: '2025-05-13',
      message: 'In recognition of outstanding contribution to community development.',
    },
    cert_002: {
      id: 'cert_002', taskId: 't_005', taskTitle: 'Community School Renovation',
      ngoId: 'ngo_001', ngoName: 'Health First NGO',
      recipientId: 'vol_004', recipientName: 'Siddharth Nair',
      hoursContributed: 16, issuedDate: '2025-05-13',
      message: 'In recognition of outstanding contribution to community development.',
    },
  },

  /* ── ACTIVITY FEED ──────────────────────────────────────────── */
  activityFeed: {
    act_001: { id: 'act_001', msg: 'Anjali Krishnan joined a Critical Medical Camp task 🏥', type: 'critical', createdAt: new Date(Date.now() - 12 * 60000).toISOString() },
    act_002: { id: 'act_002', msg: 'Siddharth Nair joined a Critical Flood Relief task 🌊', type: 'critical', createdAt: new Date(Date.now() - 25 * 60000).toISOString() },
    act_003: { id: 'act_003', msg: 'Rohan Verma completed 8 hours for Digital Literacy Workshop 💻', type: 'hours', createdAt: new Date(Date.now() - 40 * 60000).toISOString() },
    act_004: { id: 'act_004', msg: 'Kavya Sharma applied to Medical Camp — Hadapsar 🎯', type: 'apply', createdAt: new Date(Date.now() - 55 * 60000).toISOString() },
    act_005: { id: 'act_005', msg: 'Squad "Pune Heroes" completed Community School Renovation 🏫', type: 'squad', createdAt: new Date(Date.now() - 90 * 60000).toISOString() },
    act_006: { id: 'act_006', msg: 'TechForAll Foundation posted a new High priority task 📋', type: 'task', createdAt: new Date(Date.now() - 120 * 60000).toISOString() },
  },

  /* ── DONATIONS ──────────────────────────────────────────────── */
  donations: {
    don_001: { id: 'don_001', fromUserId: 'vol_005', fromName: 'Kavya Sharma', toNgoId: 'ngo_001', toNgoName: 'Health First NGO', amount: 500, note: 'Proud to support!', currency: 'INR', date: new Date(Date.now() - 3 * 86400000).toISOString() },
    don_002: { id: 'don_002', fromUserId: 'vol_001', fromName: 'Anjali Krishnan', toNgoId: 'ngo_001', toNgoName: 'Health First NGO', amount: 1000, note: 'Keep up the great work!', currency: 'INR', date: new Date(Date.now() - 86400000).toISOString() },
  },

  /* ── BONUSES ────────────────────────────────────────────────── */
  bonuses: {
    bon_001: { id: 'bon_001', fromNgoId: 'ngo_001', fromNgoName: 'Health First NGO', toVolId: 'vol_001', toVolName: 'Anjali Krishnan', amount: 1500, note: 'Outstanding leadership at the camp!', currency: 'INR', date: new Date(Date.now() - 2 * 86400000).toISOString() },
    bon_002: { id: 'bon_002', fromNgoId: 'ngo_001', fromNgoName: 'Health First NGO', toVolId: 'vol_004', toVolName: 'Siddharth Nair', amount: 2000, note: 'Exceptional fieldwork.', currency: 'INR', date: new Date(Date.now() - 86400000).toISOString() },
  },

  /* ── NGO RATINGS ────────────────────────────────────────────── */
  ngoRatings: {
    ngort_001: { id: 'ngort_001', ngoId: 'ngo_001', ngoName: 'Health First NGO', byId: 'vol_001', byName: 'Anjali Krishnan', score: 5, note: 'Amazing organization, very professional.', date: '2025-05-15' },
    ngort_002: { id: 'ngort_002', ngoId: 'ngo_001', ngoName: 'Health First NGO', byId: 'vol_005', byName: 'Kavya Sharma', score: 4, note: 'Great cause, good coordination.', date: '2025-05-20' },
  },

  /* ── INCIDENTS ─────────────────────────────────────────────── */
  incidents: {},

  /* ── WALLETS ───────────────────────────────────────────────── */
  wallets: {},
};

// ─────────────────────────────────────────────────────────────
// MOCK FIREBASE DB CLASS
// ─────────────────────────────────────────────────────────────
class MockFirebaseDB {
  constructor() {
    this._bootstrap();
  }

  _bootstrap() {
    if (!localStorage.getItem(_DB_STORAGE_KEY)) {
      localStorage.setItem(_DB_STORAGE_KEY, JSON.stringify(_SEED));
    }
  }

  _read() {
    try {
      return JSON.parse(localStorage.getItem(_DB_STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  _write(data) {
    localStorage.setItem(_DB_STORAGE_KEY, JSON.stringify(data));
  }

  /** Hard-reset to seed data (useful for dev/testing) */
  resetToSeed() {
    localStorage.setItem(_DB_STORAGE_KEY, JSON.stringify(_SEED));
    window.location.reload();
  }

  // ═══════════════════
  // USERS COLLECTION
  // ═══════════════════
  get users() {
    const self = this;
    return {
      /** Returns all users as array */
      getAll() {
        return Object.values(self._read().users || {});
      },

      /** Returns all volunteers */
      getVolunteers() {
        return Object.values(self._read().users || {}).filter(u => u.role === 'volunteer');
      },

      /** Get single user by uid */
      getById(uid) {
        return (self._read().users || {})[uid] ?? null;
      },

      /** Find user by email (case-insensitive) */
      getByEmail(email) {
        const users = Object.values(self._read().users || {});
        return users.find(u => u.email === email.toLowerCase().trim()) ?? null;
      },

      /** Create new user, returns assigned uid */
      create(data) {
        const db = self._read();
        if (!db.users) db.users = {};
        const uid = data.uid || ('uid_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
        db.users[uid] = {
          ...data,
          uid,
          email: data.email.toLowerCase().trim(),
          createdAt: new Date().toISOString().split('T')[0],
        };
        self._write(db);
        return uid;
      },

      /** Partial update — only provided fields are changed */
      update(uid, updates) {
        const db = self._read();
        if (!db.users?.[uid]) return false;
        db.users[uid] = { ...db.users[uid], ...updates };
        self._write(db);
        return true;
      },

      hashPassword: _hashPassword,
      verifyPassword: _verifyPassword,
    };
  }

  // ═══════════════════
  // TASKS COLLECTION
  // ═══════════════════
  get tasks() {
    const self = this;
    return {
      /** All tasks sorted newest-first */
      getAll() {
        return Object.values(self._read().tasks || {})
          .sort((a, b) => new Date(b.postedDate) - new Date(a.postedDate));
      },

      getById(id) {
        return (self._read().tasks || {})[id] ?? null;
      },

      getByNgo(ngoId) {
        return Object.values(self._read().tasks || {}).filter(t => t.ngoId === ngoId);
      },

      /** Create task — returns new task id */
      create(data) {
        const db = self._read();
        if (!db.tasks) db.tasks = {};
        const id = 't_' + Date.now();
        db.tasks[id] = {
          ...data,
          id,
          status: 'Open',
          postedDate: new Date().toISOString().split('T')[0],
          applications: [],
          hoursLogged: {},
        };
        self._write(db);
        return id;
      },

      update(id, updates) {
        const db = self._read();
        if (!db.tasks?.[id]) return false;
        db.tasks[id] = { ...db.tasks[id], ...updates };
        self._write(db);
        return true;
      },

      delete(id) {
        const db = self._read();
        if (!db.tasks) return false;
        delete db.tasks[id];
        self._write(db);
        return true;
      },

      // ── Application management ──

      /** Add volunteer application to a task. Returns false if already applied. */
      addApplication(taskId, appData) {
        const db = self._read();
        if (!db.tasks?.[taskId]) return false;
        const apps = db.tasks[taskId].applications || [];
        if (apps.find(a => a.userId === appData.userId)) return false; // duplicate
        apps.push({
          userId: appData.userId,
          userName: appData.userName,
          userEmail: appData.userEmail,
          userSkills: appData.userSkills || [],
          userLocation: appData.userLocation || '',
          status: 'pending',
          appliedDate: new Date().toISOString().split('T')[0],
        });
        db.tasks[taskId].applications = apps;
        self._write(db);
        return true;
      },

      /** Update application status: 'approved' | 'rejected' | 'revoked' */
      updateApplicationStatus(taskId, userId, status) {
        const db = self._read();
        if (!db.tasks?.[taskId]) return false;
        const app = (db.tasks[taskId].applications || []).find(a => a.userId === userId);
        if (!app) return false;
        app.status = status;
        self._write(db);
        return true;
      },

      /** Remove application entirely (used for revoke) */
      removeApplication(taskId, userId) {
        const db = self._read();
        if (!db.tasks?.[taskId]) return false;
        db.tasks[taskId].applications = (db.tasks[taskId].applications || []).filter(a => a.userId !== userId);
        self._write(db);
        return true;
      },

      /**
       * Log hours for a volunteer on a task.
       * Also increments the volunteer's cumulative hours total.
       */
      logHours(taskId, userId, hours) {
        const db = self._read();
        if (!db.tasks?.[taskId]) return false;
        const prevTask = db.tasks[taskId].hoursLogged[userId] || 0;
        db.tasks[taskId].hoursLogged[userId] = prevTask + hours;
        if (db.users?.[userId]) {
          db.users[userId].hours = (db.users[userId].hours || 0) + hours;
        }
        self._write(db);
        return true;
      },
    };
  }

  // ═══════════════════
  // NOTIFICATIONS
  // ═══════════════════
  get notifications() {
    const self = this;
    return {
      getByUser(userId) {
        return Object.values(self._read().notifications || {})
          .filter(n => n.userId === userId)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      },

      create(data) {
        const db = self._read();
        if (!db.notifications) db.notifications = {};
        const id = 'notif_' + Date.now();
        db.notifications[id] = {
          ...data,
          id,
          read: false,
          createdAt: new Date().toISOString(),
        };
        self._write(db);
        return id;
      },

      markRead(id) {
        const db = self._read();
        if (db.notifications?.[id]) {
          db.notifications[id].read = true;
          self._write(db);
          return true;
        }
        return false;
      },

      markAllRead(userId) {
        const db = self._read();
        Object.values(db.notifications || {}).forEach(n => {
          if (n.userId === userId) n.read = true;
        });
        self._write(db);
      },

      getUnreadCount(userId) {
        return Object.values(self._read().notifications || {})
          .filter(n => n.userId === userId && !n.read).length;
      },
    };
  }

  // ═══════════════════
  // ANALYTICS helpers
  // ═══════════════════
  get analytics() {
    const self = this;
    return {
      getSummary() {
        const db = self._read();
        const volunteers = Object.values(db.users || {}).filter(u => u.role === 'volunteer');
        const tasks = Object.values(db.tasks || {});
        const completed = tasks.filter(t => t.status === 'Complete');
        const totalHours = volunteers.reduce((s, v) => s + (v.hours || 0), 0);

        const skillCounts = {};
        volunteers.forEach(v => (v.skills || []).forEach(s => {
          skillCounts[s] = (skillCounts[s] || 0) + 1;
        }));

        const locationMap = {};
        tasks.forEach(t => {
          if (!locationMap[t.location]) {
            locationMap[t.location] = { total: 0, complete: 0, tasks: [] };
          }
          locationMap[t.location].total++;
          if (t.status === 'Complete') locationMap[t.location].complete++;
          locationMap[t.location].tasks.push(t);
        });

        return {
          totalVolunteers: volunteers.length,
          totalTasks: tasks.length,
          completedTasks: completed.length,
          openTasks: tasks.filter(t => t.status === 'Open').length,
          totalHours,
          moneySaved: totalHours * 25,
          successRate: tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0,
          skillCounts,
          locationMap,
          recentActivity: self._buildActivity(db),
        };
      },

      _buildActivity(db) {
        const events = [];
        const users = Object.values(db.users || {});
        const tasks = Object.values(db.tasks || {});
        users.slice(-3).forEach(u => events.push({ msg: `${u.displayName} joined as ${u.role}`, time: u.createdAt, color: '#16a34a', icon: '👤' }));
        tasks.slice(-3).forEach(t => events.push({ msg: `Task "${t.title}" posted`, time: t.postedDate, color: '#1d4ed8', icon: '📋' }));
        return events.sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 6);
      },
    };
  }

  // ═══════════════════════════════════════════
  // MESSAGES (Firestore collection: 'messages')
  // ═══════════════════════════════════════════
  //
  // FIREBASE MIGRATION:
  //   sendMessage()  → firestoreDB.collection('messages').add(data)
  //   getThread()    → firestoreDB.collection('messages')
  //                      .where('participants','array-contains', uid)
  //                      .orderBy('createdAt').get()
  //   markRead(id)   → firestoreDB.collection('messages').doc(id).update({read:true})
  //
  get messages() {
    const self = this;
    return {
      /** Send a message between two users */
      send(data) {
        // data: { fromId, fromName, toId, toName, text }
        const db = self._read();
        if (!db.messages) db.messages = {};
        const id = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
        db.messages[id] = {
          id,
          fromId:   data.fromId,
          fromName: data.fromName,
          toId:     data.toId,
          toName:   data.toName,
          text:     (data.text || '').trim(),
          read:     false,
          createdAt: new Date().toISOString(),
        };
        self._write(db);
        return id;
      },

      /** Get all messages in a thread between two users (sorted oldest first) */
      getThread(uid1, uid2) {
        return Object.values(self._read().messages || {})
          .filter(m =>
            (m.fromId === uid1 && m.toId === uid2) ||
            (m.fromId === uid2 && m.toId === uid1)
          )
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      },

      /** Get all unique conversations for a user (latest message per contact) */
      getInbox(uid) {
        const msgs = Object.values(self._read().messages || {})
          .filter(m => m.fromId === uid || m.toId === uid)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const seen = new Set();
        const threads = [];
        msgs.forEach(m => {
          const contactId = m.fromId === uid ? m.toId : m.fromId;
          const contactName = m.fromId === uid ? m.toName : m.fromName;
          if (!seen.has(contactId)) {
            seen.add(contactId);
            threads.push({ contactId, contactName, lastMessage: m.text, time: m.createdAt, unread: !m.read && m.toId === uid });
          }
        });
        return threads;
      },

      /** Unread count for a user */
      getUnreadCount(uid) {
        return Object.values(self._read().messages || {})
          .filter(m => m.toId === uid && !m.read).length;
      },

      /** Mark all messages from a sender as read */
      markThreadRead(myId, contactId) {
        const db = self._read();
        Object.values(db.messages || {}).forEach(m => {
          if (m.fromId === contactId && m.toId === myId) m.read = true;
        });
        self._write(db);
      },
    };
  }

  // ═══════════════════════════════════════════
  // NGO RATINGS (Firestore collection: 'ngoRatings')
  // ═══════════════════════════════════════════
  //
  // FIREBASE MIGRATION:
  //   addRating()  → firestoreDB.collection('ngoRatings').add(data)
  //               + firestoreDB.collection('users').doc(ngoId).update({ avgRating: newAvg })
  //   getByNgo()   → firestoreDB.collection('ngoRatings').where('ngoId','==', ngoId).get()
  //
  get ngoRatings() {
    const self = this;
    return {
      add(data) {
        // data: { ngoId, ngoName, byId, byName, score (1-5), note }
        const db = self._read();
        if (!db.ngoRatings) db.ngoRatings = {};
        // One rating per volunteer per NGO — overwrite existing
        const existingKey = Object.keys(db.ngoRatings).find(
          k => db.ngoRatings[k].ngoId === data.ngoId && db.ngoRatings[k].byId === data.byId
        );
        const id = existingKey || ('ngorat_' + Date.now());
        db.ngoRatings[id] = { ...data, id, date: new Date().toISOString().split('T')[0] };
        self._write(db);
        return id;
      },

      getByNgo(ngoId) {
        return Object.values(self._read().ngoRatings || {}).filter(r => r.ngoId === ngoId);
      },

      getAvg(ngoId) {
        const ratings = this.getByNgo(ngoId);
        if (!ratings.length) return null;
        return (ratings.reduce((s, r) => s + r.score, 0) / ratings.length).toFixed(1);
      },
    };
  }

  // ═══════════════════════════════════════════
  // DONATIONS  (demo ₹ — Firestore: 'donations')
  // ═══════════════════════════════════════════
  //
  // FIREBASE MIGRATION:
  //   create()    → firestoreDB.collection('donations').add(data)
  //   getByNgo()  → firestoreDB.collection('donations').where('toNgoId','==', ngoId).get()
  //
  get donations() {
    const self = this;
    return {
      create(data) {
        // data: { fromUserId, fromName, toNgoId, toNgoName, amount, note }
        const db = self._read();
        if (!db.donations) db.donations = {};
        const id = 'don_' + Date.now();
        db.donations[id] = { ...data, id, currency: 'INR', date: new Date().toISOString() };
        self._write(db);
        return id;
      },
      getByNgo(ngoId)       { return Object.values(self._read().donations || {}).filter(d => d.toNgoId === ngoId).sort((a,b) => new Date(b.date) - new Date(a.date)); },
      getTotalForNgo(ngoId) { return this.getByNgo(ngoId).reduce((s, d) => s + Number(d.amount || 0), 0); },
      getAll()              { return Object.values(self._read().donations || {}).sort((a,b) => new Date(b.date) - new Date(a.date)); },
    };
  }

  // ═══════════════════════════════════════════
  // BONUSES  (demo ₹ — Firestore: 'bonuses')
  // ═══════════════════════════════════════════
  //
  // FIREBASE MIGRATION:
  //   create()     → firestoreDB.collection('bonuses').add(data)
  //   getByVol()   → firestoreDB.collection('bonuses').where('toVolId','==', volId).get()
  //
  get bonuses() {
    const self = this;
    return {
      create(data) {
        // data: { fromNgoId, fromNgoName, toVolId, toVolName, amount, note }
        const db = self._read();
        if (!db.bonuses) db.bonuses = {};
        const id = 'bon_' + Date.now();
        db.bonuses[id] = { ...data, id, currency: 'INR', date: new Date().toISOString() };
        self._write(db);
        return id;
      },
      getByVol(volId)       { return Object.values(self._read().bonuses || {}).filter(b => b.toVolId === volId).sort((a,b) => new Date(b.date) - new Date(a.date)); },
      getTotalForVol(volId) { return this.getByVol(volId).reduce((s, b) => s + Number(b.amount || 0), 0); },
    };
  }

  get squads() {
    const self = this;
    return {
      getAll() { return Object.values(self._read().squads || {}); },
      getById(id) { return (self._read().squads || {})[id] ?? null; },
      getByMember(uid) { return Object.values(self._read().squads || {}).filter(s => s.members.some(m => m.uid === uid)); },
      create(data) {
        const db = self._read();
        if (!db.squads) db.squads = {};
        const id = 'squad_' + Date.now();
        db.squads[id] = { ...data, id, totalHours: 0, createdAt: new Date().toISOString().split('T')[0] };
        self._write(db); return id;
      },
      addMember(squadId, member) {
        const db = self._read();
        if (!db.squads?.[squadId]) return false;
        const already = db.squads[squadId].members.some(m => m.uid === member.uid);
        if (already) return false;
        db.squads[squadId].members.push({ ...member, joinedAt: new Date().toISOString().split('T')[0] });
        self._write(db); return true;
      },
      removeMember(squadId, uid) {
        const db = self._read();
        if (!db.squads?.[squadId]) return false;
        db.squads[squadId].members = db.squads[squadId].members.filter(m => m.uid !== uid);
        self._write(db); return true;
      },
      update(id, updates) {
        const db = self._read();
        if (!db.squads?.[id]) return false;
        db.squads[id] = { ...db.squads[id], ...updates };
        self._write(db); return true;
      },
      // Squad Chat: messages stored inside the squad object
      sendMessage(squadId, data) {
        const db = self._read();
        if (!db.squads?.[squadId]) return false;
        if (!db.squads[squadId].chat) db.squads[squadId].chat = [];
        db.squads[squadId].chat.push({
          id: 'sc_' + Date.now(),
          fromId: data.fromId, fromName: data.fromName,
          text: data.text, createdAt: new Date().toISOString(),
        });
        self._write(db);
        return true;
      },
      getChat(squadId) {
        return (self._read().squads?.[squadId]?.chat || [])
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      },
    };
  }

  get certificates() {
    const self = this;
    return {
      getByTask(taskId)       { return Object.values(self._read().certificates || {}).filter(c => c.taskId === taskId); },
      getByVolunteer(volId)   { return Object.values(self._read().certificates || {}).filter(c => c.recipientId === volId); },
      create(data) {
        const db = self._read();
        if (!db.certificates) db.certificates = {};
        const id = 'cert_' + Date.now() + '_' + Math.random().toString(36).slice(2,5);
        db.certificates[id] = { ...data, id, issuedDate: new Date().toISOString().split('T')[0] };
        self._write(db); return id;
      },
      existsFor(taskId, volId) {
        return Object.values(self._read().certificates || {}).some(c => c.taskId === taskId && c.recipientId === volId);
      },
    };
  }

  get activityFeed() {
    const self = this;
    return {
      getRecent(limit = 10) {
        return Object.values(self._read().activityFeed || {})
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, limit);
      },
      push(msg, type = 'general') {
        const db = self._read();
        if (!db.activityFeed) db.activityFeed = {};
        const id = 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 4);
        db.activityFeed[id] = { id, msg, type, createdAt: new Date().toISOString() };
        self._write(db);
      },
    };
  }

  // ── INCIDENTS (new) ───────────────────────────────────────────
  get incidents() {
    const self = this;
    return {
      getAll() {
        return Object.values(self._read().incidents || {})
          .sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt));
      },
      getById(id) { return (self._read().incidents || {})[id] ?? null; },
      create(data) {
        const db = self._read();
        if (!db.incidents) db.incidents = {};
        const id = 'inc_' + Date.now();
        db.incidents[id] = {
          ...data, id,
          status: 'Open',
          responders: [],
          reportedAt: new Date().toISOString(),
        };
        self._write(db);
        // Push to activity feed
        const critLabel = data.criticality === 'High' ? '🔴' : '🟡';
        const actDb = self._read();
        if (!actDb.activityFeed) actDb.activityFeed = {};
        const actId = 'act_' + Date.now();
        actDb.activityFeed[actId] = {
          id: actId,
          msg: `${critLabel} ${data.reporterName} reported a ${data.criticality} incident: "${data.type}" in ${data.location}`,
          type: data.criticality === 'High' ? 'critical' : 'general',
          createdAt: new Date().toISOString(),
        };
        self._write(actDb);
        return id;
      },
      addResponder(incidentId, responder) {
        const db = self._read();
        if (!db.incidents?.[incidentId]) return false;
        const already = (db.incidents[incidentId].responders || []).some(r => r.uid === responder.uid);
        if (already) return false;
        db.incidents[incidentId].responders = db.incidents[incidentId].responders || [];
        db.incidents[incidentId].responders.push({ ...responder, respondedAt: new Date().toISOString() });
        self._write(db);
        return true;
      },
      updateStatus(id, status) {
        const db = self._read();
        if (!db.incidents?.[id]) return false;
        db.incidents[id].status = status;
        self._write(db);
        return true;
      },
    };
  }

  get wallets() {
    const self = this;
    return {
      getBalance(uid) {
        const db = self._read();
        // Prefer user.wallet field; fallback to wallets collection
        if (db.users?.[uid]?.wallet !== undefined) return db.users[uid].wallet;
        return (db.wallets || {})[uid] || 0;
      },
      credit(uid, amount) {
        const db = self._read();
        if (db.users?.[uid] !== undefined) {
          db.users[uid].wallet = (db.users[uid].wallet || 0) + Number(amount);
        } else {
          if (!db.wallets) db.wallets = {};
          db.wallets[uid] = (db.wallets[uid] || 0) + Number(amount);
        }
        self._write(db);
        return true;
      },
      debit(uid, amount) {
        const db = self._read();
        const bal = db.users?.[uid]?.wallet ?? (db.wallets || {})[uid] ?? 0;
        if (bal < amount) return false;
        if (db.users?.[uid] !== undefined) {
          db.users[uid].wallet = bal - Number(amount);
        } else {
          if (!db.wallets) db.wallets = {};
          db.wallets[uid] = bal - Number(amount);
        }
        self._write(db);
        return true;
      },
    };
  }

  // ═══════════════════════════════════════════
  // MONEY SAVED FILTER (Analytics helper)
  // ═══════════════════════════════════════════
  get moneySavedFilter() {
    const self = this;
    return {
      get(filter = 'week', projectId = null) {
        const db    = self._read();
        const tasks = Object.values(db.tasks || {});
        const now   = Date.now();
        let hours   = 0;
        if (filter === 'project' && projectId) {
          const task = (db.tasks || {})[projectId];
          if (task) hours = Object.values(task.hoursLogged || {}).reduce((s, h) => s + h, 0);
        } else {
          const cutoff = filter === 'day' ? now - 86400000 : now - 7 * 86400000;
          tasks.forEach(t => {
            const d = new Date(t.postedDate || '').getTime();
            if (!isNaN(d) && d >= cutoff) {
              hours += Object.values(t.hoursLogged || {}).reduce((s, h) => s + h, 0);
            }
          });
        }
        return { hours, moneySaved: hours * 25 };
      },
      getCompletedTaskList() {
        return Object.values(self._read().tasks || {})
          .filter(t => t.status === 'Complete')
          .map(t => ({ id: t.id, title: t.title }));
      },
    };
  }
}

// ─────────────────────────────────────────────────────────────
// GLOBAL EXPORT
// ─────────────────────────────────────────────────────────────
window.DB = new MockFirebaseDB();

// Extend users namespace with getNGOs and General role support
const _origUsersGetter = Object.getOwnPropertyDescriptor(MockFirebaseDB.prototype, 'users');
Object.defineProperty(MockFirebaseDB.prototype, 'users', {
  get() {
    const base = _origUsersGetter.get.call(this);
    const self  = this;

    // Add getNGOs if not present
    if (!base.getNGOs) {
      base.getNGOs = function() {
        return Object.values(self._read().users || {}).filter(u => u.role === 'ngo');
      };
    }

    // Add getGeneralUsers
    base.getGeneral = function() {
      return Object.values(self._read().users || {}).filter(u => u.role === 'general');
    };

    // Add registerGeneral  helper
    base.registerGeneral = function(data) {
      const { name, email, passwordHash, location, phone } = data;
      const db  = self._read();
      if (!db.users) db.users = {};
      const uid = 'gen_' + Date.now();
      db.users[uid] = {
        uid, role: 'general',
        displayName: (name || '').trim(),
        email: (email || '').toLowerCase().trim(),
        passwordHash,
        phone: (phone || '').trim(),
        location: (location || '').trim(),
        wallet: 0,
        verified: false,
        createdAt: new Date().toISOString().split('T')[0],
      };
      self._write(db);
      return uid;
    };

    return base;
  },
  configurable: true,
});

// Dev helper: open browser console and run `DB.resetToSeed()` to reset all data
console.info('[VolunteerBridge] MockFirebase ready. Run DB.resetToSeed() to reset data.');