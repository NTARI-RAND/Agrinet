const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

function createRequestLimiter({ windowMs = 60 * 1000, limit = 60, message = 'Too many requests' } = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: req => {
      const userId = req.user?.userId;
      return typeof userId === 'string' && userId
        ? 'account:' + userId
        : 'ip:' + ipKeyGenerator(req.ip);
    },
    handler: (_req, res) => res.status(429).json({ error: message })
  });
}

module.exports = {
  apiRateLimit: createRequestLimiter({ limit: 120 }),
  userWriteRateLimit: createRequestLimiter({ limit: 20, message: 'Too many user-management requests' }),
  locationRateLimit: createRequestLimiter({ limit: 30, message: 'Too many location requests' }),
  chatRateLimit: createRequestLimiter({ limit: 60, message: 'Too many chat requests' }),
  streamRateLimit: createRequestLimiter({ limit: 20, message: 'Too many stream requests' }),
  federationRateLimit: createRequestLimiter({ limit: 30, message: 'Too many federation requests' })
};
