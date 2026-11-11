const { createRequestLimiter } = require('./rateLimit');

// Mount after chatAuth so req.user.userId is a verified account identity.
module.exports = function chatRateLimit(limit = 60) {
  return createRequestLimiter({
    prefix: 'agrinet:chat',
    windowMs: 60 * 1000,
    limit,
    message: 'Too many chat requests, please try again later'
  });
};
