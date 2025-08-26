const { calculateReputationScore } = require('../utils/reputation');

describe('calculateReputationScore', () => {
  test('applies bayesian weighting and rater reputation', () => {
    const result = calculateReputationScore({
      currentScore: 0,
      currentWeight: 0,
      newRating: 4,
      raterScore: 2,
      neutralRating: 2,
      bayesianWeight: 5
    });
    const expected = (0 * 0 + 4 * 2 + 2 * 5) / (2 + 5);
    expect(result.score).toBeCloseTo(expected);
    expect(result.weight).toBe(2);
  });
});
