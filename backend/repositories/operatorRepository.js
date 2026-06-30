/**
 * Operator registry (Phase 5). Stores operators and their PUBLIC keys only.
 */
const { randomUUID } = require('crypto');
const pool = require('../lib/db');

async function createOperator(name) {
  const id = randomUUID();
  await pool.query("INSERT INTO operators (id, name, status) VALUES (?, ?, 'active')", [id, name]);
  return id;
}

async function addKeys(operatorId, keys) {
  for (const k of keys) {
    await pool.query(
      `INSERT INTO operator_keys (id, operator_id, key_index, public_key, algo, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [randomUUID(), operatorId, k.key_index, k.public_key, k.algo || 'ed25519']
    );
  }
}

// Map { key_index -> public_key } of an operator's ACTIVE keys, or null if the
// operator is unknown or revoked. Used by verifyTransmission.
async function getActiveKeyMap(operatorId) {
  const [[op]] = await pool.query("SELECT status FROM operators WHERE id = ?", [operatorId]);
  if (!op || op.status !== 'active') return null;
  const [rows] = await pool.query(
    "SELECT key_index, public_key FROM operator_keys WHERE operator_id = ? AND status = 'active'",
    [operatorId]
  );
  const map = {};
  for (const r of rows) map[r.key_index] = r.public_key;
  return map;
}

async function rotateKey(operatorId, keyIndex, newPublicKey, algo) {
  await pool.query(
    "UPDATE operator_keys SET status = 'retired' WHERE operator_id = ? AND key_index = ? AND status = 'active'",
    [operatorId, keyIndex]
  );
  await pool.query(
    `INSERT INTO operator_keys (id, operator_id, key_index, public_key, algo, status)
     VALUES (?, ?, ?, ?, ?, 'active')`,
    [randomUUID(), operatorId, keyIndex, newPublicKey, algo || 'ed25519']
  );
}

async function revoke(operatorId) {
  await pool.query("UPDATE operators SET status = 'revoked' WHERE id = ?", [operatorId]);
}

async function getOperator(operatorId) {
  const [[op]] = await pool.query("SELECT id, name, status, created_at FROM operators WHERE id = ?", [operatorId]);
  if (!op) return null;
  const [keys] = await pool.query(
    "SELECT key_index, algo, status, created_at FROM operator_keys WHERE operator_id = ? ORDER BY key_index, created_at",
    [operatorId]
  );
  return { ...op, keys };
}

module.exports = { createOperator, addKeys, getActiveKeyMap, rotateKey, revoke, getOperator };
