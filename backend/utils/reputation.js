/**
 * DEPRECATED — removed in Phase 3 (LBTAS v2).
 *
 * This module previously computed a Bayesian *average* reputation score. Averaging
 * is banned under LBTAS: it buries the -1 ("No Trust") safety signal and discards
 * the rating count, which is itself a trust signal. Reputation is now a
 * DISTRIBUTION computed on read.
 *
 * Use instead:
 *   - services/lbtas.js              — the scale + distribution helpers + validation
 *   - repositories/ratingRepository  — getUserReputation() / generateReport()
 *
 * The function is kept as a throwing stub so any reintroduction of averaging fails
 * loudly rather than silently regressing the model.
 */
function calculateReputationScore() {
  throw new Error(
    'calculateReputationScore is removed: LBTAS reputation is a distribution, never an average. ' +
    'See repositories/ratingRepository.getUserReputation().'
  );
}

module.exports = { calculateReputationScore };
