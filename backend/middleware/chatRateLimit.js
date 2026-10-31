const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

function accountKey(req) {
  return req.user?.userId ? `account:${req.user.userId}` : `ip:${ipKeyGenerator(req.ip)}`;
}

function chatRateLimit(limit) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit,
    keyGenerator: accountKey,
    standardHeaders: 'draft-6',
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
  });
}

module.exports = chatRateLimit;
