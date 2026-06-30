/**
 * Leveson-Based Trade Assessment Scale (LBTAS) — scale definitions and validation.
 *
 * Ported from the reference `lbtas.ts` (v2.0.0, NTARI). This module holds the
 * pure, storage-agnostic pieces: the 6-point scale, distribution helpers, and the
 * boundary validation. Persistence lives in repositories/ratingRepository.js.
 *
 * Central rule: ratings are NEVER averaged. A reputation is the count of ratings
 * at each level (-1..+4) plus the total. See the LBTAS spec for why.
 *
 * Copyright (C) 2024 Network Theory Applied Research Institute — AGPL-3.0.
 */

const RATING_MIN = -1;
const RATING_MAX = 4;
const MAX_COMMENT_WORDS = 500;

// Display order: best (+4) to worst (-1).
const RATING_LEVELS = [4, 3, 2, 1, 0, -1];

const RATING_LABELS = {
  4: 'Delight',
  3: 'No Negative Consequences',
  2: 'Basic Satisfaction',
  1: 'Basic Promise',
  0: 'Cynical Satisfaction',
  '-1': 'No Trust',
};

const RATING_DESCRIPTIONS = {
  4: 'Interaction anticipates the evolution of user practices and concerns post-transaction.',
  3: 'Interaction designed to prevent loss, exceeding basic quality standards.',
  2: 'Interaction meets socially acceptable standards, exceeding articulated user demands.',
  1: 'Interaction meets all articulated user demands, no more.',
  0: 'Interaction fulfills a basic promise requiring little to no discipline toward user satisfaction.',
  '-1': 'User was harmed, exploited, or received a product/service with evidence of no discipline or malicious intent.',
};

function newDistribution() {
  return { '-1': 0, 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
}

// Count ratings at each level. This is the unit of reputation — never an average.
function distributionOf(values) {
  const dist = newDistribution();
  for (const v of values) {
    const key = String(v);
    if (key in dist) dist[key] += 1;
  }
  return dist;
}

function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Validate a rating at the API boundary.
 * - value must be an integer in [-1, 4]
 * - a -1 ("No Trust") MUST carry a justifying comment of <=500 words
 */
function validateRating(value, comment) {
  const errors = [];
  if (!Number.isInteger(value) || value < RATING_MIN || value > RATING_MAX) {
    errors.push(`rating must be an integer between ${RATING_MIN} and ${RATING_MAX}`);
  }
  if (value === -1) {
    if (!comment || !String(comment).trim()) {
      errors.push('a -1 (No Trust) rating requires a justifying comment');
    } else if (wordCount(comment) > MAX_COMMENT_WORDS) {
      errors.push(`comment must be ${MAX_COMMENT_WORDS} words or fewer`);
    }
  }
  return { ok: errors.length === 0, errors };
}

// The scale as a serializable list, best-to-worst, for the rating UI.
function scale() {
  return RATING_LEVELS.map((level) => ({
    value: level,
    label: RATING_LABELS[String(level)] || RATING_LABELS[level],
    description: RATING_DESCRIPTIONS[String(level)] || RATING_DESCRIPTIONS[level],
  }));
}

module.exports = {
  RATING_MIN,
  RATING_MAX,
  MAX_COMMENT_WORDS,
  RATING_LEVELS,
  RATING_LABELS,
  RATING_DESCRIPTIONS,
  newDistribution,
  distributionOf,
  wordCount,
  validateRating,
  scale,
};
