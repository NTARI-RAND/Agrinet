/**
 * Mycelium — the immutable, hash-chained transaction record (Phase 5).
 *
 * append() serializes on the chain tail (FOR UPDATE) so concurrent events produce a
 * single consistent chain. The hash binds the entry id + event_type + transaction_id
 * + verbatim data to the previous entry's hash. verifyChain() recomputes the whole
 * chain and reports the first break, if any.
 */
const crypto = require('crypto');
const { randomUUID } = require('crypto');
const pool = require('../lib/db');

// Bytes that get hashed for an entry. `dataText` is the verbatim stored string.
function coreString({ id, eventType, transactionId, dataText }) {
  return `${id}|${eventType}|${transactionId || ''}|${dataText || ''}`;
}

function hashEntry(prevHash, core) {
  return crypto.createHash('sha256').update((prevHash || '') + core).digest('hex');
}

// Append an immutable entry. Best-effort durability is the caller's concern; the
// chain itself is always consistent because appends serialize on the tail row.
async function record(eventType, { transactionId = null, data = {} } = {}) {
  const dataText = JSON.stringify(data);
  const id = randomUUID();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [tail] = await conn.query("SELECT hash FROM mycelium ORDER BY seq DESC LIMIT 1 FOR UPDATE");
    const prevHash = tail.length ? tail[0].hash : null;
    const hash = hashEntry(prevHash, coreString({ id, eventType, transactionId, dataText }));
    await conn.query(
      `INSERT INTO mycelium (id, event_type, transaction_id, data, prev_hash, hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, eventType, transactionId, dataText, prevHash, hash]
    );
    await conn.commit();
    return { id, hash, prev_hash: prevHash };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// Walk the chain in order and verify every link + hash. Returns the first break.
async function verifyChain() {
  const [rows] = await pool.query(
    "SELECT seq, id, event_type, transaction_id, data, prev_hash, hash FROM mycelium ORDER BY seq ASC"
  );
  let prev = null;
  for (const r of rows) {
    if ((r.prev_hash || null) !== prev) {
      return { ok: false, broken_at: r.seq, reason: 'prev_hash linkage broken' };
    }
    const expected = hashEntry(prev, coreString({ id: r.id, eventType: r.event_type, transactionId: r.transaction_id, dataText: r.data }));
    if (r.hash !== expected) {
      return { ok: false, broken_at: r.seq, reason: 'hash mismatch (entry altered)' };
    }
    prev = r.hash;
  }
  return { ok: true, length: rows.length, head: prev };
}

async function list(limit = 50) {
  const [rows] = await pool.query(
    "SELECT seq, id, event_type, transaction_id, data, prev_hash, hash, created_at FROM mycelium ORDER BY seq DESC LIMIT ?",
    [Number(limit) || 50]
  );
  return rows.map((r) => ({ ...r, data: safeParse(r.data) }));
}

async function forTransaction(transactionId) {
  const [rows] = await pool.query(
    "SELECT seq, id, event_type, transaction_id, data, hash, created_at FROM mycelium WHERE transaction_id = ? ORDER BY seq ASC",
    [transactionId]
  );
  return rows.map((r) => ({ ...r, data: safeParse(r.data) }));
}

function safeParse(s) { try { return JSON.parse(s); } catch { return s; } }

module.exports = { record, verifyChain, list, forTransaction };
