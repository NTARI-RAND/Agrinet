/**
 * Operator authentication (Phase 5). Verifies the `X-Operator-Token` transmission
 * (a 2-of-set Ed25519 signature) and, on success, sets req.operator. Replay is
 * bounded by the token's timestamp window plus a best-effort Redis nonce cache.
 *
 * `operatorAuth` is additive: a request with no token simply proceeds (other auth
 * still applies); a present-but-invalid token is rejected. `requireOperator` then
 * enforces that a valid operator was authenticated.
 */
const { verifyTransmission, TS_WINDOW_MS } = require('../lib/operatorKeys');
const operatorRepository = require('../repositories/operatorRepository');

let redis = null;
try { ({ redis } = require('../lib/redis')); } catch { /* optional */ }

async function freshNonce(nonce) {
  if (!nonce || !redis) return true;
  try {
    // SET key NX -> only succeeds the first time the nonce is seen (within the window)
    const res = await redis.set('opnonce:' + nonce, '1', { NX: true, PX: TS_WINDOW_MS + 60000 });
    return res === 'OK' || res === true;
  } catch {
    return true; // Redis unavailable -> rely on the timestamp window
  }
}

async function operatorAuth(req, res, next) {
  const token = req.headers['x-operator-token'];
  if (!token) return next();
  try {
    const result = await verifyTransmission(token, operatorRepository.getActiveKeyMap);
    if (!result.ok) return res.status(401).json({ error: 'Operator auth failed: ' + result.error });
    if (!(await freshNonce(result.nonce))) {
      return res.status(401).json({ error: 'Operator token replay detected' });
    }
    req.operator = { id: result.operator_id };
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Operator auth error' });
  }
}

function requireOperator(req, res, next) {
  if (!req.operator) return res.status(401).json({ error: 'Operator authentication required' });
  next();
}

module.exports = { operatorAuth, requireOperator };
