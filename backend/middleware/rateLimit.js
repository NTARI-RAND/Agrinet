const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

let redis = null;
if (process.env.REDIS_URL) {
  const Redis = require('ioredis');
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false
  });
} else if (process.env.RATE_LIMIT_REDIS_REQUIRED === 'true') {
  throw new Error('REDIS_URL is required when RATE_LIMIT_REDIS_REQUIRED=true');
}

class RedisRateLimitStore {
  constructor(client, prefix) {
    this.client = client;
    this.prefix = prefix;
    this.windowMs = 60000;
  }
  init(options) { this.windowMs = options.windowMs; }
  async increment(key) {
    const redisKey = this.prefix + ':' + key;
    const totalHits = await this.client.incr(redisKey);
    if (totalHits === 1) await this.client.pexpire(redisKey, this.windowMs);
    let ttl = await this.client.pttl(redisKey);
    if (ttl < 0) {
      await this.client.pexpire(redisKey, this.windowMs);
      ttl = this.windowMs;
    }
    return { totalHits, resetTime: new Date(Date.now() + ttl) };
  }
  async decrement(key) { await this.client.decr(this.prefix + ':' + key); }
  async resetKey(key) { await this.client.del(this.prefix + ':' + key); }
  async shutdown() {}
}

function createRequestLimiter({ prefix, windowMs = 60000, limit = 60, message = 'Too many requests' }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...(redis ? { store: new RedisRateLimitStore(redis, prefix) } : {}),
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
  createRequestLimiter,
  apiRateLimit: createRequestLimiter({ prefix: 'agrinet:api', limit: 120 }),
  userWriteRateLimit: createRequestLimiter({ prefix: 'agrinet:user-write', limit: 20, message: 'Too many user-management requests' }),
  locationRateLimit: createRequestLimiter({ prefix: 'agrinet:location', limit: 30, message: 'Too many location requests' }),
  chatRateLimit: createRequestLimiter({ prefix: 'agrinet:chat', limit: 60, message: 'Too many chat requests' }),
  streamRateLimit: createRequestLimiter({ prefix: 'agrinet:stream', limit: 20, message: 'Too many stream requests' }),
  federationRateLimit: createRequestLimiter({ prefix: 'agrinet:federation', limit: 30, message: 'Too many federation requests' })
};
