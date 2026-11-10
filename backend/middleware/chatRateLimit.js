const { rateLimit } = require('express-rate-limit');
const { requestLimitOptions } = require('./rateLimit');

// Use the same Redis-backed store and verified-identity keys as the API limits.
function options(limit = 60, scope = 'chat') {
  return {
    ...requestLimitOptions({
      prefix: `agrinet:chat:${scope}`,
      windowMs: 60 * 1000,
      limit,
      message: 'Too many chat requests, please try again later'
    }),
    standardHeaders: 'draft-6'
  };
}

module.exports = function chatRateLimit(limit, scope) {
  return rateLimit(options(limit, scope));
};
module.exports.options = options;
