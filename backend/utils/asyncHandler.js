// Shared async handler for Express routes.
// Mirrors the previous inline behavior from depositRoutes.js:
// - Logs with the "DynamoDB error:" prefix
// - Responds with 500 and { error: 'Internal server error' }
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error('DynamoDB error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });
};

module.exports = asyncHandler;
