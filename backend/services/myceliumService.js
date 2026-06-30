/**
 * Mycelium — immutable transaction-record ledger, dialog-file model (P3-013).
 *
 * Two append-only hash chains:
 *   - intra-dialog (mycelium_log): each transmission folds into a running head
 *     hash, so an open dialog is tamper-evident as it is built.
 *   - inter-dialog (mycelium_anchors): sealed dialogs (and post-seal annotations)
 *     are chained globally, so the set of completed exchanges can't be rewritten.
 *
 * append() serializes on the dialog tail; seal()/annotate() serialize on the global
 * anchor tail. Only references + structural facts are hashed — never PII (P3-013 §6).
 */
const crypto = require('crypto');
const { randomUUID } = require('crypto');
const pool = require('../lib/db');

const H = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Canonical bytes of one transmission (header-led; refs only).
function txnCore({ dialogId, seq, type, actorId, actorRole, dataText }) {
  return `${dialogId}|${seq}|${type}|${actorId || ''}|${actorRole || ''}|${dataText || ''}`;
}
// Canonical bytes of one anchor.
function anchorCore({ kind, dialogId, fileHash, sealedSeq }) {
  return `${kind}|${dialogId}|${fileHash}|${sealedSeq}`;
}

// Append a transmission to a dialog's open file. Returns { seq, head }.
async function append(dialogId, { type, actorId = null, actorRole = null, data = {} } = {}) {
  const dataText = JSON.stringify(data);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [tail] = await conn.query(
      'SELECT seq, head_hash FROM mycelium_log WHERE dialog_id = ? ORDER BY seq DESC LIMIT 1 FOR UPDATE',
      [dialogId]
    );
    const seq = tail.length ? tail[0].seq + 1 : 0;
    const prevHead = tail.length ? tail[0].head_hash : null;
    const head = H((prevHead || '') + txnCore({ dialogId, seq, type, actorId, actorRole, dataText }));
    await conn.query(
      `INSERT INTO mycelium_log (id, dialog_id, seq, type, actor_id, actor_role, data, head_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), dialogId, seq, type, actorId, actorRole, dataText, head]
    );
    await conn.commit();
    return { seq, head };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function isSealed(dialogId) {
  const [[a]] = await pool.query("SELECT id FROM mycelium_anchors WHERE dialog_id = ? AND kind = 'seal' LIMIT 1", [dialogId]);
  return !!a;
}

// Anchor the dialog's current head on the global chain (kind = 'seal' | 'annotation').
async function _writeAnchor(dialogId, kind) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [head] = await conn.query('SELECT seq, head_hash FROM mycelium_log WHERE dialog_id = ? ORDER BY seq DESC LIMIT 1', [dialogId]);
    if (!head.length) { await conn.rollback(); return null; }
    const fileHash = head[0].head_hash;
    const sealedSeq = head[0].seq;
    const [gtail] = await conn.query('SELECT hash FROM mycelium_anchors ORDER BY n DESC LIMIT 1 FOR UPDATE');
    const prevHash = gtail.length ? gtail[0].hash : null;
    const hash = H((prevHash || '') + anchorCore({ kind, dialogId, fileHash, sealedSeq }));
    await conn.query(
      `INSERT INTO mycelium_anchors (id, dialog_id, kind, file_hash, sealed_seq, prev_hash, hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), dialogId, kind, fileHash, sealedSeq, prevHash, hash]
    );
    await conn.commit();
    return { kind, file_hash: fileHash, hash, sealed_seq: sealedSeq };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// Seal a complete + quiescent dialog (caller decides completeness). Idempotent.
async function seal(dialogId) {
  if (await isSealed(dialogId)) return { already: true };
  return _writeAnchor(dialogId, 'seal');
}

// Post-seal annotation (P3-013 §7): append the annotation transmission, then anchor
// it — referencing the sealed dialog by its (continued) file hash, never editing it.
async function annotate(dialogId, transmission) {
  await append(dialogId, transmission);
  return _writeAnchor(dialogId, 'annotation');
}

// Record a transmission for a dialog: append while the dialog is open; once sealed,
// it becomes a post-seal annotation (a new anchor referencing the sealed dialog) —
// the sealed file is never edited (P3-013 §7).
async function record(dialogId, transmission) {
  if (await isSealed(dialogId)) return annotate(dialogId, transmission);
  await append(dialogId, transmission);
  return { appended: true };
}

// Verify both chains: every anchor links and hashes correctly, and each anchor's
// file_hash equals the recomputed intra-dialog head at sealed_seq.
async function verifyChain() {
  const [anchors] = await pool.query(
    'SELECT n, dialog_id, kind, file_hash, sealed_seq, prev_hash, hash FROM mycelium_anchors ORDER BY n ASC'
  );
  let prev = null;
  for (const a of anchors) {
    if ((a.prev_hash || null) !== prev) return { ok: false, broken_at: `anchor ${a.n}`, reason: 'anchor linkage broken' };
    const expected = H((prev || '') + anchorCore({ kind: a.kind, dialogId: a.dialog_id, fileHash: a.file_hash, sealedSeq: a.sealed_seq }));
    if (a.hash !== expected) return { ok: false, broken_at: `anchor ${a.n}`, reason: 'anchor hash mismatch' };

    const [rows] = await pool.query(
      'SELECT dialog_id, seq, type, actor_id, actor_role, data, head_hash FROM mycelium_log WHERE dialog_id = ? AND seq <= ? ORDER BY seq ASC',
      [a.dialog_id, a.sealed_seq]
    );
    let h = null;
    for (const r of rows) {
      h = H((h || '') + txnCore({ dialogId: r.dialog_id, seq: r.seq, type: r.type, actorId: r.actor_id, actorRole: r.actor_role, dataText: r.data }));
      if (r.head_hash !== h) return { ok: false, broken_at: `${a.dialog_id} seq ${r.seq}`, reason: 'dialog transmission altered' };
    }
    if (h !== a.file_hash) return { ok: false, broken_at: `anchor ${a.n}`, reason: 'file_hash does not match dialog' };
    prev = a.hash;
  }
  return { ok: true, anchors: anchors.length };
}

// The full record for one dialog: its transmissions + its anchors (sealed/annotation).
async function forDialog(dialogId) {
  const [transmissions] = await pool.query(
    'SELECT seq, type, actor_id, actor_role, data, head_hash, created_at FROM mycelium_log WHERE dialog_id = ? ORDER BY seq ASC',
    [dialogId]
  );
  const [anchors] = await pool.query(
    'SELECT kind, file_hash, sealed_seq, hash, created_at FROM mycelium_anchors WHERE dialog_id = ? ORDER BY n ASC',
    [dialogId]
  );
  return {
    transmissions: transmissions.map((r) => ({ ...r, data: safeParse(r.data) })),
    anchors,
    sealed: anchors.some((a) => a.kind === 'seal'),
  };
}

async function listAnchors(limit = 50) {
  const [rows] = await pool.query(
    'SELECT n, dialog_id, kind, file_hash, hash, created_at FROM mycelium_anchors ORDER BY n DESC LIMIT ?',
    [Number(limit) || 50]
  );
  return rows;
}

function safeParse(s) { try { return JSON.parse(s); } catch { return s; } }

module.exports = { append, seal, annotate, record, isSealed, verifyChain, forDialog, listAnchors };
