/**
 * Operator transmission auth (Phase 5).
 *
 * Implements the whitepaper's rotating-key handshake SHAPE — an operator holds a
 * set of KEY_SET_SIZE keys and signs each transmission with KEYS_PER_TX of them —
 * using Ed25519 signatures (Node-native). The primitive is swappable to a
 * post-quantum scheme (e.g. ML-DSA via a vetted lib): only key generation and
 * sign/verify change; the token shape, rotation, and replay handling stay.
 *
 * We deliberately do NOT hand-roll QC-MDPC McEliece (decoding-failure / reaction
 * attacks, non-standardized).
 */
const crypto = require('crypto');

const ALGO = 'ed25519';
const KEY_SET_SIZE = 7;       // keys an operator holds
const KEYS_PER_TX = 2;        // signatures required per transmission
const TS_WINDOW_MS = 5 * 60 * 1000;

// Generate a fresh key set. Returns PEM public/private for each index. The operator
// registers the public keys with Agrinet and keeps the private keys to itself.
function generateKeySet() {
  const out = [];
  for (let i = 0; i < KEY_SET_SIZE; i++) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    out.push({
      index: i,
      publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    });
  }
  return out;
}

// Canonical bytes that get signed. Binding operator_id/ts/nonce/seq/indices makes
// the signature specific to this transmission (anti-replay, anti-substitution).
function canonicalMessage({ operator_id, ts, nonce, seq, indices }) {
  return Buffer.from(`v1:${operator_id}:${ts}:${nonce}:${seq}:${indices[0]}:${indices[1]}`);
}

// Build a transmission token: sign the canonical message with the two chosen keys.
// privateKeys is a map { index -> PEM } that must contain both `indices`.
function signTransmission({ operatorId, privateKeys, indices, seq = 0, ts = Date.now(), nonce }) {
  nonce = nonce || crypto.randomBytes(12).toString('hex');
  const msg = canonicalMessage({ operator_id: operatorId, ts, nonce, seq, indices });
  const sigs = indices.map((i) => crypto.sign(null, msg, privateKeys[i]).toString('base64'));
  const payload = { v: 1, operator_id: operatorId, ts, nonce, seq, indices, sigs };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

// Verify a transmission token. `getActiveKeyMap(operatorId)` resolves to a map
// { index -> publicKeyPEM } of the operator's ACTIVE keys, or null if the operator
// is unknown/revoked. Returns { ok, operator_id?, nonce?, ts?, error? }.
async function verifyTransmission(token, getActiveKeyMap) {
  let payload;
  try { payload = JSON.parse(Buffer.from(token, 'base64url').toString()); }
  catch { return { ok: false, error: 'malformed token' }; }

  const { v, operator_id, ts, nonce, seq, indices, sigs } = payload || {};
  if (v !== 1 || !operator_id || !Array.isArray(indices) || indices.length !== KEYS_PER_TX ||
      !Array.isArray(sigs) || sigs.length !== KEYS_PER_TX) {
    return { ok: false, error: 'invalid token structure' };
  }
  if (indices[0] === indices[1]) return { ok: false, error: 'two distinct keys required per transmission' };
  if (typeof ts !== 'number' || Math.abs(Date.now() - ts) > TS_WINDOW_MS) {
    return { ok: false, error: 'stale or future timestamp' };
  }

  const keys = await getActiveKeyMap(operator_id);
  if (!keys) return { ok: false, error: 'unknown or revoked operator' };

  const msg = canonicalMessage({ operator_id, ts, nonce, seq, indices });
  for (let k = 0; k < KEYS_PER_TX; k++) {
    const pub = keys[indices[k]];
    if (!pub) return { ok: false, error: `no active key at index ${indices[k]}` };
    let valid = false;
    try { valid = crypto.verify(null, msg, pub, Buffer.from(sigs[k], 'base64')); }
    catch { valid = false; }
    if (!valid) return { ok: false, error: `signature ${k} (key ${indices[k]}) failed` };
  }
  return { ok: true, operator_id, nonce, ts };
}

module.exports = {
  ALGO, KEY_SET_SIZE, KEYS_PER_TX, TS_WINDOW_MS,
  generateKeySet, canonicalMessage, signTransmission, verifyTransmission,
};
