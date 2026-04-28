/**
 * =============================================================
 * ai.js — Gemini AI Service Module
 * VolunteerBridge v2.0
 * =============================================================
 *
 * Drop-in AI layer. Exposes window.AI.
 *
 * Load order in index.html:
 *   1. backend.js
 *   2. auth.js
 *   3. ai.js        ← this file
 *   4. app.js
 *
 * NO CDN needed — uses the Gemini REST API directly via fetch().
 *
 * REAL API KEY:
 *   Replace GEMINI_API_KEY below with your key from:
 *   https://aistudio.google.com/app/apikey
 * =============================================================
 */

'use strict';

const AI = (() => {

  // ──────────────────────────────────────────
  // CONFIG  ← replace placeholder before deploying
  // ──────────────────────────────────────────
  const GEMINI_API_KEY   = '';
  const GEMINI_MODEL     = 'gemini-1.5-flash';
  const GEMINI_ENDPOINT  =
`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  // Max volunteers sent to Gemini per Smart Match call
  // (keeps prompt size reasonable and cost low)
  const MAX_CANDIDATES = 10;

  // ──────────────────────────────────────────
  // LOW-LEVEL: call Gemini
  // ──────────────────────────────────────────

  /**
   * @param {string} prompt
   * @param {object} [generationConfig]
   * @returns {Promise<string>}  raw text response
   */
  async function _callGemini(prompt, generationConfig = {}) {
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature:    0.4,
        maxOutputTokens: 1024,
        ...generationConfig,
      },
    };

    const response = await fetch(GEMINI_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        contents: [{
          parts: [{text: prompt}]
        }],
        generationConfig: {
          maxOutputTokens: generationConfig.maxOutputTokens || 400,
          temperature: generationConfig.temperature || 0.7,
        }
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(
        err?.error?.message || `Gemini API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  // ──────────────────────────────────────────
  // PROMPT BUILDER
  // ──────────────────────────────────────────

  function _buildMatchPrompt(task, candidates) {
    const candidateLines = candidates.map((v, i) => {
      const skills      = (v.skills     || []).join(', ') || 'Not specified';
      const availability = v.availability || 'Flexible';
      const location    = v.location     || 'Unknown';
      const bio         = (v.bio         || '').trim() || 'No bio provided.';
      const hours       = v.hours        || 0;

      return [
        `CANDIDATE ${i + 1}:`,
        `  Name:         ${v.displayName}`,
        `  Skills:       ${skills}`,
        `  Location:     ${location}`,
        `  Availability: ${availability}`,
        `  Hours logged: ${hours}`,
        `  Bio:          ${bio}`,
      ].join('\n');
    }).join('\n\n');

    return `
You are a volunteer-matching expert for VolunteerBridge, a platform that connects NGOs with volunteers across India.

TASK POSTED BY NGO
------------------
Title:           ${task.title}
Location:        ${task.location || 'Not specified'}
Priority:        ${task.priority || 'Not specified'}
Skills required: ${(task.requiredSkills || []).join(', ') || 'Any'}
Description:     ${(task.description || '').trim() || 'No description provided.'}

VOLUNTEER CANDIDATES
--------------------
${candidateLines}

INSTRUCTIONS
------------
For each candidate, provide:
1. A numeric compatibility score from 0–100 (higher = better match).
2. A one-sentence "Match Reason" (max 20 words) explaining WHY this person fits — be specific, referencing their actual skills or bio.

Return your answer as a **JSON array only** — no markdown fences, no prose outside the array.
Each element must have exactly these keys:
  "candidateIndex"  (integer, 1-based, matching CANDIDATE N above)
  "score"           (integer 0–100)
  "matchReason"     (string, ≤20 words)

Example structure:
[{"candidateIndex":1,"score":82,"matchReason":"3 years of medical volunteering aligns directly with the clinic task."},{"candidateIndex":2,"score":61,"matchReason":"Tech skills fit, but located in a different city."}]
`.trim();
  }

  // ──────────────────────────────────────────
  // PARSE GEMINI JSON RESPONSE
  // ──────────────────────────────────────────

  function _parseMatchResponse(text, candidates) {
    // Strip accidental markdown fences if any
    const clean = text.replace(/```json|```/gi, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      console.warn('[AI] Gemini returned non-JSON, falling back. Raw:', text);
      return null; // triggers fallback in caller
    }

    if (!Array.isArray(parsed)) return null;

    return parsed
      .map(item => {
        const idx = (item.candidateIndex ?? 0) - 1; // convert to 0-based
        const vol = candidates[idx];
        if (!vol) return null;
        return {
          volunteer:   vol,
          score:       Math.min(99, Math.max(0, Number(item.score) || 0)),
          matchReason: (item.matchReason || '').trim(),
        };
      })
      .filter(Boolean)
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  // ──────────────────────────────────────────
  // PUBLIC: getAiMatches
  // ──────────────────────────────────────────

  /**
   * Calls Gemini to rank and explain volunteer matches for a task.
   *
   * @param {object}   task        — task object from DB.tasks.getById()
   * @param {object[]} volunteers  — full list of volunteers from DB.users.getVolunteers()
   * @param {number}   [topN=3]   — how many results to return
   *
   * @returns {Promise<Array<{ volunteer, score, matchReason }>>}
   *          Resolves with ranked match objects.
   *          On API failure, rejects with an Error (caller should show toast + fallback).
   */
  async function getAiMatches(task, volunteers, topN = 3) {
    if (!volunteers.length) return [];

    // Pre-filter: only volunteers with ≥1 skill overlap OR same location,
    // to keep the prompt focused and cost-efficient.
    const tSkills = (task.requiredSkills || []).map(s => s.toLowerCase());
    const preFiltered = volunteers.filter(v => {
      const vSkills = (v.skills || []).map(s => s.toLowerCase());
      const hasSkill = tSkills.length === 0 || vSkills.some(s => tSkills.includes(s));
      const sameCity = v.location === task.location;
      return hasSkill || sameCity;
    });

    // Fall back to all volunteers if pre-filter returns nothing
    const pool = (preFiltered.length > 0 ? preFiltered : volunteers)
      .slice(0, MAX_CANDIDATES);

    const prompt   = _buildMatchPrompt(task, pool);
    const rawText  = await _callGemini(prompt, { temperature: 0.3 });
    const results  = _parseMatchResponse(rawText, pool);

    if (!results) {
      throw new Error('AI returned an unexpected response format. Please try again.');
    }

    return results.slice(0, topN);
  }

  // ──────────────────────────────────────────
  // PUBLIC: generateMatchReason (single pair)
  // ──────────────────────────────────────────

  /**
   * Generates a single contextual reason string for one volunteer ↔ task pair.
   * Useful for inline "Why matched?" UI.
   *
   * @param {object} volunteer
   * @param {object} task
   * @returns {Promise<string>}
   */
  async function generateMatchReason(volunteer, task) {
    const prompt = `
You are a volunteer-matching assistant.

Volunteer:
  Name:         ${volunteer.displayName}
  Skills:       ${(volunteer.skills || []).join(', ') || 'Not specified'}
  Location:     ${volunteer.location || 'Unknown'}
  Availability: ${volunteer.availability || 'Flexible'}
  Bio:          ${(volunteer.bio || '').trim() || 'No bio.'}

Task:
  Title:           ${task.title}
  Required Skills: ${(task.requiredSkills || []).join(', ') || 'Any'}
  Location:        ${task.location || 'Not specified'}
  Description:     ${(task.description || '').trim() || 'No description.'}

Write ONE sentence (max 20 words) explaining why this volunteer is a good fit for this task.
Return only the sentence — no JSON, no labels.
`.trim();

    const text = await _callGemini(prompt, { maxOutputTokens: 80, temperature: 0.5 });
    return text.replace(/^["']|["']$/g, '').trim(); // strip surrounding quotes if any
  }

  // ──────────────────────────────────────────
  // PUBLIC API
  // ──────────────────────────────────────────
  return {
    getAiMatches,
    generateMatchReason,
  };

})();

window.AI = AI;
console.info('[VolunteerBridge] AI (Gemini) module ready.');
