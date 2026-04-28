/**
 * ================================================================
 * backend_patch.js — Surgical patch for backend.js
 * VolunteerBridge v2.1
 * ================================================================
 * HOW TO APPLY:
 *   Open backend.js.
 *   Find the VERY LAST LINE:  window.DB = new MockFirebaseDB();
 *   PASTE THIS ENTIRE FILE immediately BEFORE that line.
 *
 *   Also: in backend.js _SEED, add  wallet:5000  to each NGO user
 *   and  wallet:500  to each volunteer user so wallet balances work.
 *
 *   Then clear localStorage once:
 *     localStorage.removeItem('vb2_database')
 *   and reload to get fresh seeded data.
 * ================================================================
 */

/* ================================================================
   STEP 1 ─ PATCH THE EXISTING  _SEED  CONSTANT
   Add these new top-level keys to _SEED (paste alongside
   'users', 'tasks', 'notifications' at the same level):
   ================================================================

   squads: {},
   incidents: {},
   messages: {},
   donations: {},
   bonuses: {},
   certificates: {},
   ngoRatings: {},
   activityFeed: {},
   wallets: {},

   AND for every user in _SEED.users, add:
     wallet: 5000,    ← for NGOs
     wallet: 1000,    ← for volunteers
     verified: true,  ← for seed users
     ratings: [],     ← for volunteer seed users

   The demo_init.js will populate realistic data on first load.
   ================================================================ */

/* ================================================================
   STEP 2 ─ PASTE THESE GETTERS INTO MockFirebaseDB CLASS
   Find the closing  }  of the existing `get analytics() { … }`
   getter, then paste ALL of the following getters below it,
   still inside the class body.
   ================================================================ */

class MockFirebaseDB {
  // ── GENERAL USER REGISTRATION SUPPORT ───────────────────────
  // Extends the existing `get users()` with getNGOs() and a
  // registerGeneral() helper. Because we can't modify the existing
  // getter, we add a standalone method to the prototype after the
  // class definition (see STEP 3 below).

  // ── MESSAGES ─────────────────────────────────────────────────
  get messages() {
    const self = this;
    return {
      send(data) {
        const db = self._read();
        if (!db.messages) db.messages = {};
        const id = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
        db.messages[id] = {
          id,
          fromId: data.fromId, fromName: data.fromName,
          toId:   data.toId,   toName:   data.toName,
          text:   (data.text || '').trim(),
          read: false,
          createdAt: new Date().toISOString(),
        };
        self._write(db);
        return id;
      },
      getThread(uid1, uid2) {
        return Object.values(self._read().messages || {})
          .filter(m => (m.fromId === uid1 && m.toId === uid2) || (m.fromId === uid2 && m.toId === uid1))
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      },
      getInbox(uid) {
        const msgs = Object.values(self._read().messages || {})
          .filter(m => m.fromId === uid || m.toId === uid)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const seen = new Set();
        const threads = [];
        msgs.forEach(m => {
          const contactId   = m.fromId === uid ? m.toId   : m.fromId;
          const contactName = m.fromId === uid ? m.toName : m.fromName;
          if (!seen.has(contactId)) {
            seen.add(contactId);
            threads.push({ contactId, contactName, lastMessage: m.text, time: m.createdAt, unread: !m.read && m.toId === uid });
          }
        });
        return threads;
      },
      getUnreadCount(uid) {
        return Object.values(self._read().messages || {}).filter(m => m.toId === uid && !m.read).length;
      },
      markThreadRead(myId, contactId) {
        const db = self._read();
        Object.values(db.messages || {}).forEach(m => {
          if (m.fromId === contactId && m.toId === myId) m.read = true;
        });
        self._write(db);
      },
    };
  }

  // ── SQUADS ────────────────────────────────────────────────────
  get squads() {
    const self = this;
    return {
      getAll()           { return Object.values(self._read().squads || {}); },
      getById(id)        { return (self._read().squads || {})[id] ?? null; },
      getByMember(uid)   { return Object.values(self._read().squads || {}).filter(s => s.members.some(m => m.uid === uid)); },
      create(data) {
        const db = self._read();
        if (!db.squads) db.squads = {};
        const id = 'squad_' + Date.now();
        db.squads[id] = { ...data, id, totalHours: 0, createdAt: new Date().toISOString().split('T')[0] };
        self._write(db);
        return id;
      },
      addMember(squadId, member) {
        const db = self._read();
        if (!db.squads?.[squadId]) return false;
        const already = (db.squads[squadId].members || []).some(m => m.uid === member.uid);
        if (already) return false;
        db.squads[squadId].members = db.squads[squadId].members || [];
        db.squads[squadId].members.push({ ...member, joinedAt: new Date().toISOString().split('T')[0] });
        self._write(db);
        return true;
      },
      removeMember(squadId, uid) {
        const db = self._read();
        if (!db.squads?.[squadId]) return false;
        db.squads[squadId].members = (db.squads[squadId].members || []).filter(m => m.uid !== uid);
        self._write(db);
        return true;
      },
      update(id, updates) {
        const db = self._read();
        if (!db.squads?.[id]) return false;
        db.squads[id] = { ...db.squads[id], ...updates };
        self._write(db);
        return true;
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

  // ── CERTIFICATES ──────────────────────────────────────────────
  get certificates() {
    const self = this;
    return {
      getByTask(taskId)      { return Object.values(self._read().certificates || {}).filter(c => c.taskId === taskId); },
      getByVolunteer(volId)  { return Object.values(self._read().certificates || {}).filter(c => c.recipientId === volId); },
      existsFor(taskId, volId) {
        return Object.values(self._read().certificates || {}).some(c => c.taskId === taskId && c.recipientId === volId);
      },
      create(data) {
        const db = self._read();
        if (!db.certificates) db.certificates = {};
        const id = 'cert_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
        db.certificates[id] = { ...data, id, issuedDate: new Date().toISOString().split('T')[0] };
        self._write(db);
        return id;
      },
    };
  }

  // ── DONATIONS ─────────────────────────────────────────────────
  get donations() {
    const self = this;
    return {
      create(data) {
        const db = self._read();
        if (!db.donations) db.donations = {};
        const id = 'don_' + Date.now();
        db.donations[id] = { ...data, id, currency: 'INR', date: new Date().toISOString() };
        self._write(db);
        return id;
      },
      getByNgo(ngoId) {
        return Object.values(self._read().donations || {})
          .filter(d => d.toNgoId === ngoId)
          .sort((a, b) => new Date(b.date) - new Date(a.date));
      },
      getTotalForNgo(ngoId) {
        return this.getByNgo(ngoId).reduce((s, d) => s + Number(d.amount || 0), 0);
      },
      getAll() {
        return Object.values(self._read().donations || {}).sort((a, b) => new Date(b.date) - new Date(a.date));
      },
    };
  }

  // ── BONUSES ───────────────────────────────────────────────────
  get bonuses() {
    const self = this;
    return {
      create(data) {
        const db = self._read();
        if (!db.bonuses) db.bonuses = {};
        const id = 'bon_' + Date.now();
        db.bonuses[id] = { ...data, id, currency: 'INR', date: new Date().toISOString() };
        self._write(db);
        return id;
      },
      getByVol(volId) {
        return Object.values(self._read().bonuses || {})
          .filter(b => b.toVolId === volId)
          .sort((a, b) => new Date(b.date) - new Date(a.date));
      },
      getTotalForVol(volId) {
        return this.getByVol(volId).reduce((s, b) => s + Number(b.amount || 0), 0);
      },
    };
  }

  // ── WALLETS ───────────────────────────────────────────────────
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

  // ── NGO RATINGS ───────────────────────────────────────────────
  get ngoRatings() {
    const self = this;
    return {
      add(data) {
        const db = self._read();
        if (!db.ngoRatings) db.ngoRatings = {};
        const existingKey = Object.keys(db.ngoRatings).find(
          k => db.ngoRatings[k].ngoId === data.ngoId && db.ngoRatings[k].byId === data.byId
        );
        const id = existingKey || ('ngorat_' + Date.now());
        db.ngoRatings[id] = { ...data, id, date: new Date().toISOString().split('T')[0] };
        self._write(db);
        return id;
      },
      getByNgo(ngoId) { return Object.values(self._read().ngoRatings || {}).filter(r => r.ngoId === ngoId); },
      getAvg(ngoId) {
        const r = this.getByNgo(ngoId);
        if (!r.length) return null;
        return (r.reduce((s, x) => s + x.score, 0) / r.length).toFixed(1);
      },
    };
  }

  // ── ACTIVITY FEED ─────────────────────────────────────────────
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

  // ── MONEY SAVED FILTER (analytics helper) ─────────────────────
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

/* ================================================================
   STEP 3 ─ AFTER the class definition, patch the `users` getter
   to expose getNGOs() and registerGeneral().
   Paste this block AFTER  `window.DB = new MockFirebaseDB();`
   ================================================================ */
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