const { randomUUID } = require('node:crypto');
const { getRedisClient } = require('./rateLimit');

const localReservations = new Map();
const RESERVATION_TTL_MS = 8 * 24 * 60 * 60 * 1000;

const ACQUIRE_SCRIPT = [
  "redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])",
  "local count = redis.call('ZCARD', KEYS[1])",
  "if count >= tonumber(ARGV[2]) then return 0 end",
  "redis.call('ZADD', KEYS[1], ARGV[3], ARGV[4])",
  "redis.call('PEXPIRE', KEYS[1], ARGV[5])",
  "return 1"
].join('\n');

const RELEASE_SCRIPT = [
  "redis.call('ZREM', KEYS[1], ARGV[1])",
  "if redis.call('ZCARD', KEYS[1]) == 0 then redis.call('DEL', KEYS[1]) end",
  "return 1"
].join('\n');

async function acquire(userId, reservationId, expiresAt, maximum) {
  const redis = getRedisClient();
  if (redis) {
    const key = 'agrinet:active-streams:' + userId;
    const result = await redis.eval(
      ACQUIRE_SCRIPT, 1, key, Date.now(), maximum, expiresAt,
      reservationId, RESERVATION_TTL_MS
    );
    return Number(result) === 1;
  }

  // Process-local fallback is appropriate only for a single-instance deployment.
  const now = Date.now();
  const reservations = localReservations.get(userId) || new Map();
  for (const [id, expiry] of reservations) {
    if (expiry <= now) reservations.delete(id);
  }
  if (reservations.size >= maximum) {
    localReservations.set(userId, reservations);
    return false;
  }
  reservations.set(reservationId, expiresAt);
  localReservations.set(userId, reservations);
  return true;
}

async function release(userId, reservationId) {
  const redis = getRedisClient();
  if (redis) {
    await redis.eval(
      RELEASE_SCRIPT, 1, 'agrinet:active-streams:' + userId, reservationId
    );
    return;
  }
  const reservations = localReservations.get(userId);
  if (!reservations) return;
  reservations.delete(reservationId);
  if (reservations.size === 0) localReservations.delete(userId);
}

function createConcurrentStreamLimit({ maximum = 5 } = {}) {
  return async function concurrentStreamLimit(req, res, next) {
    const userId = req.user?.userId;
    const expiresAt = Number(req.user?.exp) * 1000;
    if (typeof userId !== 'string' || !userId || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return res.status(401).json({ error: 'Valid account token required for streaming' });
    }

    const reservationId = randomUUID();
    let admitted;
    try {
      admitted = await acquire(userId, reservationId, expiresAt, maximum);
    } catch {
      return res.status(503).json({ error: 'Stream capacity service unavailable' });
    }
    if (!admitted) {
      return res.status(429).json({ error: 'Too many open streams for this account' });
    }

    let released = false;
    const cleanup = () => {
      if (released) return;
      released = true;
      release(userId, reservationId).catch(() => {
        // Expiring Redis reservations provide crash recovery if release cannot complete.
      });
    };
    res.once('close', cleanup);
    res.once('finish', cleanup);
    res.once('error', cleanup);
    return next();
  };
}

module.exports = { createConcurrentStreamLimit };
