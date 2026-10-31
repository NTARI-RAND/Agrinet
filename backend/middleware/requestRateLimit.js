const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// req.user is populated by authentication middleware, never by request data.
module.exports = () => rateLimit({
  windowMs: 60 * 1000,
  limit: 1000,
  keyGenerator: req => typeof req.user?.userId === 'string' && req.user.userId
    ? `account:${req.user.userId}` : `ip:${ipKeyGenerator(req.ip)}`,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
