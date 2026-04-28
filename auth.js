/**
 * =============================================================
 * auth.js — Authentication & Role-Based Access Control
 * VolunteerBridge v2.0
 * =============================================================
 *
 * Depends on: backend.js (window.DB must be loaded first)
 *
 * REAL FIREBASE MIGRATION:
 *   - Auth.login()               → firebase.auth().signInWithEmailAndPassword()
 *   - Auth.registerVolunteer()   → firebase.auth().createUserWithEmailAndPassword()
 *   - Auth.logout()              → firebase.auth().signOut()
 *   - Auth.getCurrentUser()      → firebase.auth().currentUser  (+ Firestore user doc)
 *   - Session storage            → firebase.auth().onAuthStateChanged()
 * =============================================================
 */

'use strict';

const _SESSION_KEY = 'vb2_session';

const Auth = (() => {

  // ──────────────────────────────────────────
  // SESSION MANAGEMENT
  // ──────────────────────────────────────────

  function _setSession(user) {
    const { passwordHash, ...safe } = user; // never store the hash in session
    sessionStorage.setItem(_SESSION_KEY, JSON.stringify(safe));
    return safe;
  }

  function getCurrentUser() {
    try {
      return JSON.parse(sessionStorage.getItem(_SESSION_KEY));
    } catch {
      return null;
    }
  }

  function isAuthenticated() {
    return !!getCurrentUser();
  }

  function hasRole(role) {
    const u = getCurrentUser();
    return u ? u.role === role : false;
  }

  /** Reload user data from DB into session (use after profile edits) */
  function refreshSession() {
    const u = getCurrentUser();
    if (!u) return null;
    const fresh = window.DB.users.getById(u.uid);
    return fresh ? _setSession(fresh) : null;
  }

  // ──────────────────────────────────────────
  // RBAC GUARDS
  // ──────────────────────────────────────────

  /**
   * Call before rendering a protected page.
   * Returns true if allowed; shows toast and returns false if not.
   */
  function requireAuth(redirectPage = 'auth') {
    if (!isAuthenticated()) {
      if (window.App) {
        window.App.showToast('Please sign in to continue.', 'warning');
        window.App.showPage(redirectPage);
      }
      return false;
    }
    return true;
  }

  function requireRole(role) {
    if (!requireAuth()) return false;
    if (!hasRole(role)) {
      if (window.App) {
        window.App.showToast(`This section is for ${role === 'ngo' ? 'NGOs' : 'Volunteers'} only.`, 'warning');
      }
      return false;
    }
    return true;
  }

  // ──────────────────────────────────────────
  // VALIDATION HELPERS
  // ──────────────────────────────────────────

  function _isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  function _validatePassword(pw, confirm) {
    if (!pw || pw.length < 6) return 'Password must be at least 6 characters.';
    if (confirm !== undefined && pw !== confirm) return 'Passwords do not match.';
    return null;
  }

  function _emailTaken(email) {
    return !!window.DB.users.getByEmail(email);
  }

  // ──────────────────────────────────────────
  // LOGIN
  // ──────────────────────────────────────────

  /**
   * @returns {{ success: boolean, user?: object, error?: string }}
   */
  async function login(email, password) {
    try {
      const userCredential = await window.auth.signInWithEmailAndPassword(email, password);
      const uid = userCredential.user.uid;

      // Get profile from Firestore
      const userDoc = await window.db.collection('users').doc(uid).get();
      if (!userDoc.exists) throw new Error("Profile not found in database.");

      const userData = { uid: uid, ...userDoc.data() };
      _setSession(userData);
      
      return { success: true, user: userData };
    } catch (error) {
      console.error("Login Error:", error);
      return { success: false, error: error.message }; // This prevents the 'undefined' error
    }
  }

  // ──────────────────────────────────────────
  // REGISTER — VOLUNTEER
  // ──────────────────────────────────────────

  /**
   * @param {object} data
   * @returns {{ success: boolean, user?: object, error?: string }}
   */
  // --- FIREBASE VOLUNTEER SIGNUP ---
  async function registerVolunteer(data) {
    try {
      const userCredential = await window.auth.createUserWithEmailAndPassword(data.email, data.password);
      const uid = userCredential.user.uid;

      const profile = {
        uid: uid,
        role: 'volunteer',
        displayName: data.name,
        email: data.email.toLowerCase(),
        location: data.location || 'Pune',
        skills: data.skills || [],
        availability: data.availability || 'Flexible',
        availableDays: data.availableDays || [],
        hours: 0,
        createdAt: new Date().toISOString()
      };

      // Save to Firestore
      await window.db.collection('users').doc(uid).set(profile);
      _setSession(profile);

      return { success: true, user: profile };
    } catch (error) {
      console.error("Signup Error:", error);
      return { success: false, error: error.message };
    }
  } 

  // ──────────────────────────────────────────
  // REGISTER — NGO
  // ──────────────────────────────────────────

  /**
   * @param {object} data
   * @returns {{ success: boolean, user?: object, error?: string }}
   */
  // --- FIREBASE NGO SIGNUP ---
  async function registerNgo(data) {
    try {
      const userCredential = await window.auth.createUserWithEmailAndPassword(data.email, data.password);
      const uid = userCredential.user.uid;

      const profile = {
        uid: uid,
        role: 'ngo',
        displayName: data.orgName,
        email: data.email.toLowerCase(),
        location: data.location || '',
        contactPhone: data.contactPhone || '',
        bio: data.bio || '',
        createdAt: new Date().toISOString()
      };

      // Save to Firestore
      await window.db.collection('users').doc(uid).set(profile);
      _setSession(profile);

      return { success: true, user: profile };
    } catch (error) {
      console.error("NGO Signup Error:", error);
      return { success: false, error: error.message };
    }
  }

  // ──────────────────────────────────────────
  // LOGOUT
  // ──────────────────────────────────────────

  async function logout() {
    try {
      await window.auth.signOut(); // Ends the Firebase session
      sessionStorage.removeItem(_SESSION_KEY); // Clears the local session
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ──────────────────────────────────────────
  // PROFILE UPDATE
  // ──────────────────────────────────────────

  /**
   * Update profile fields for current user.
   * @returns {{ success: boolean, error?: string }}
   */
  function updateProfile(updates) {
    const u = getCurrentUser();
    if (!u) return { success: false, error: 'Not authenticated.' };

    // If changing password, verify old one
    if (updates.newPassword) {
      const dbUser = window.DB.users.getById(u.uid);
      if (!window.DB.users.verifyPassword(updates.currentPassword, dbUser.passwordHash)) {
        return { success: false, error: 'Current password is incorrect.' };
      }
      const pwErr = _validatePassword(updates.newPassword, updates.confirmNewPassword);
      if (pwErr) return { success: false, error: pwErr };
      updates.passwordHash = window.DB.users.hashPassword(updates.newPassword);
      delete updates.newPassword;
      delete updates.currentPassword;
      delete updates.confirmNewPassword;
    }

    window.DB.users.update(u.uid, updates);
    refreshSession();
    return { success: true };
  }

  // ──────────────────────────────────────────
  // PUBLIC API
  // ──────────────────────────────────────────
  return {
    getCurrentUser,
    isAuthenticated,
    hasRole,
    requireAuth,
    requireRole,
    refreshSession,
    login,
    registerVolunteer,
    registerNgo,
    logout,
    updateProfile,
  };

})();

window.Auth = Auth;
console.info('[VolunteerBridge] Auth module ready.');