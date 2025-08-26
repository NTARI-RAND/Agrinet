/**
 * Utility functions for calculating reputation using Leveson-Based Trade Assessment Scale (LBTAS).
 * The algorithm applies Bayesian averaging to reduce bias and weights ratings by the rater's reputation score.
 */

/**
 * Calculate updated reputation score for a user.
 * @param {number} currentScore - Existing reputation score.
 * @param {number} currentWeight - Sum of weights from previous ratings.
 * @param {number} newRating - New rating provided in LBTAS scale (-1 to 4).
 * @param {number} raterScore - Reputation score of the rater providing the rating.
 * @returns {{score: number, weight: number}}
 */
function calculateReputationScore({ currentScore = 0, currentWeight = 0, newRating, raterScore = 0 }) {
  const neutralRating = 2; // Neutral midpoint of LBTAS scale
  const bayesianWeight = 5; // Prior weight to prevent small sample bias
  const weight = Math.max(raterScore, 1); // Ensure minimum weight to mitigate manipulation

  const totalWeight = currentWeight + weight;
  const score =
    (currentScore * currentWeight + newRating * weight + neutralRating * bayesianWeight) /
    (totalWeight + bayesianWeight);

  return { score, weight: totalWeight };
}

module.exports = {
  calculateReputationScore
};
