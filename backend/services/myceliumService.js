/**
 * Mycelium — immutable transaction-record ledger, dialog-file model (P3-013).
 *
 * Two append-only hash chains:
 *   - intra-dialog (mycelium_log): each transmission folds into a running head
 *     hash, so an open dialog is tamper-evident as it is built.
 *   - per-operator (mycelium_anchors): sealed dialogs (and post-seal annotations)
 *     are chained WITHIN THIS OPERATOR'S log (§5) — there is no global chain and no
 *     consensus. Cross-operator non-equivocation is by witnessing (§5.1, `checkpoint`),
 *     which is intended-not-built.
 *
 * append() serializes on the dialog tail; seal()/annotate() serialize on this
 * operator's anchor tail. Only references + structural facts are hashed — never PII.
 */
const crypto = require('crypto');
const { randomUUID } = require('crypto');
const pool = require('../lib/db');

const OPERATOR_ID = process.env.OPERATOR_ID || 'agrinet';
const H = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Canonical bytes of one transmission (header-led; refs only).
function txnCore({ dialogId, seq, type, actorId, actorRole, dataText }) {
  return `${dialogId}|${seq}|${type}|${actorId || ''}|${actorRole || ''}|${dataText || ''}`;
}
// Canonical bytes of one anchor — bound to the operator so logs cannot be spliced (§5).
function anchorCore({ operatorId, kind, dialogId, fileHash, sealedSeq }) {
  return `${operatorId}|${kind}|${dialogId}|${fileHash}|${sealedSeq}`;
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
      `INSERT INTO mycelium_log (id, dialog_id, operator_id, seq, type, actor_id, actor_role, data, head_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), dialogId, OPERATOR_ID, seq, type, actorId, actorRole, dataText, head]
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

// Anchor the dialog's current head on THIS operator's chain (kind = 'seal' | 'annotation').
async function _writeAnchor(dialogId, kind) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [head] = await conn.query('SELECT seq, head_hash FROM mycelium_log WHERE dialog_id = ? ORDER BY seq DESC LIMIT 1', [dialogId]);
    if (!head.length) { await conn.rollback(); return null; }
    const fileHash = head[0].head_hash;
    const sealedSeq = head[0].seq;
    // per-operator tail (not a global chain — §5)
    const [gtail] = await conn.query('SELECT hash FROM mycelium_anchors WHERE operator_id = ? ORDER BY n DESC LIMIT 1 FOR UPDATE', [OPERATOR_ID]);
    const prevHash = gtail.length ? gtail[0].hash : null;
    const hash = H((prevHash || '') + anchorCore({ operatorId: OPERATOR_ID, kind, dialogId, fileHash, sealedSeq }));
    await conn.query(
      `INSERT INTO mycelium_anchors (id, dialog_id, operator_id, kind, file_hash, sealed_seq, prev_hash, hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), dialogId, OPERATOR_ID, kind, fileHash, sealedSeq, prevHash, hash]
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

// Verify THIS operator's log (§8): every anchor links and hashes correctly, and each
// anchor's file_hash equals the recomputed intra-dialog head at sealed_seq.
async function verifyChain(operatorId = OPERATOR_ID) {
  const [anchors] = await pool.query(
    'SELECT n, dialog_id, kind, file_hash, sealed_seq, prev_hash, hash FROM mycelium_anchors WHERE operator_id = ? ORDER BY n ASC',
    [operatorId]
  );
  let prev = null;
  for (const a of anchors) {
    if ((a.prev_hash || null) !== prev) return { ok: false, broken_at: `anchor ${a.n}`, reason: 'anchor linkage broken' };
    const expected = H((prev || '') + anchorCore({ operatorId, kind: a.kind, dialogId: a.dialog_id, fileHash: a.file_hash, sealedSeq: a.sealed_seq }));
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
  return { ok: true, anchors: anchors.length, operator_id: operatorId };
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
    'SELECT n, dialog_id, kind, file_hash, hash, created_at FROM mycelium_anchors WHERE operator_id = ? ORDER BY n DESC LIMIT ?',
    [OPERATOR_ID, Number(limit) || 50]
  );
  return rows;
}

// Produce a signed, monotonic checkpoint of this operator's log head — the unit an
// independent witness co-signs so equivocation becomes self-evident (§5.1,
// Certificate Transparency / RFC 6962).
//
// STATUS: INTENDED, NOT BUILT. Returns the checkpoint BODY only. Signing the body
// with the operator key, publishing to >= 1 independent witness, obtaining a signed
// witness receipt, and serving inclusion proofs on read are the highest-leverage
// federation step and are not implemented here — until they exist, non-equivocation
// rests on there being a single backend.
async function checkpoint(operatorId = OPERATOR_ID) {
  const [[row]] = await pool.query(
    'SELECT COUNT(*) AS tree_size, MAX(n) AS max_n FROM mycelium_anchors WHERE operator_id = ?',
    [operatorId]
  );
  let headHash = null;
  if (row.max_n) {
    const [[h]] = await pool.query('SELECT hash FROM mycelium_anchors WHERE operator_id = ? ORDER BY n DESC LIMIT 1', [operatorId]);
    headHash = h ? h.hash : null;
  }
  return {
    body: { operator_id: operatorId, tree_size: Number(row.tree_size), head_hash: headHash },
    signature: null,   // no operator signer wired yet
    witnessed: false,  // no witness receipt — witnessing not built (§5.1)
  };
}

function safeParse(s) { try { return JSON.parse(s); } catch { return s; } }

module.exports = { append, seal, annotate, record, isSealed, verifyChain, forDialog, listAnchors, checkpoint, OPERATOR_ID };
