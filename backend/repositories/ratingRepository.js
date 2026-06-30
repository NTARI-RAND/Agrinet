/**
 * LBTAS rating event store (Phase 3).
 *
 * Stores individual rating events and computes reputation as a DISTRIBUTION on
 * read — never an average. Alongside the per-level counts and total, reads expose
 * transaction count and first/last rated timestamps (the count and tenure are
 * themselves trust signals; see the LBTAS spec).
 */
const { randomUUID } = require('crypto');
const pool = require('../lib/db');
const { distributionOf, ROLE_LABELS } = require('../services/lbtas');

// Insert one rating EVENT (the protocol record — no narrative/PII). If a justifying
// comment is supplied it is stored separately in the operator-local narrative table,
// never as part of the event (V3).
async function createRating(
  { transactionId, ratedUserId, raterUserId, raterRole, ratedRole = 'unknown', value, category = 'overall', comment = null },
  conn = pool
) {
  const id = randomUUID();
  await conn.query(
    `INSERT INTO lbtas_ratings
       (id, transaction_id, rated_user_id, rater_user_id, rater_role, rated_role, value, category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, transactionId, ratedUserId, raterUserId, raterRole, ratedRole, value, category]
  );
  if (comment && String(comment).trim()) {
    await conn.query(
      `INSERT INTO rating_narratives (id, rating_id, body) VALUES (?, ?, ?)`,
      [randomUUID(), id, String(comment).slice(0, 4000)]
    );
  }
  return id;
}

// Void a rating — a dismissal (admin bad-faith finding). The event is NEVER deleted
// and remains visible downstream, annotated as dismissed (V1). Identified by
// transaction + the rater's side (used by the escrow-dispute resolution path).
async function voidRating({ transactionId, raterRole, voidedBy, reason }, conn = pool) {
  const [res] = await conn.query(
    `UPDATE lbtas_ratings SET voided = 1, voided_by = ?, voided_reason = ?
       WHERE transaction_id = ? AND rater_role = ? AND voided = 0`,
    [voidedBy, String(reason || '').slice(0, 255), transactionId, raterRole]
  );
  return res.affectedRows;
}

// Dismiss a single rating by id (admin). Works for EITHER direction (V2). Annotates,
// never deletes (V1).
async function voidById(ratingId, voidedBy, reason) {
  const [res] = await pool.query(
    `UPDATE lbtas_ratings SET voided = 1, voided_by = ?, voided_reason = ?, contested = 0
       WHERE id = ? AND voided = 0`,
    [voidedBy, String(reason || '').slice(0, 255), ratingId]
  );
  return res.affectedRows;
}

// Uphold a contested rating: the contest is rejected, the rating stands. Clears the
// active-contest flag so the dialog can seal (audit resolved).
async function upholdContest(ratingId) {
  const [res] = await pool.query(
    `UPDATE lbtas_ratings SET contested = 0 WHERE id = ? AND contested = 1 AND voided = 0`,
    [ratingId]
  );
  return res.affectedRows;
}

// Contest a rating made AGAINST you — either direction (V2). Only the rated party
// can contest, and only while it stands (not already dismissed).
async function contestRating(ratingId, byUserId, reason) {
  const [res] = await pool.query(
    `UPDATE lbtas_ratings SET contested = 1, contested_by = ?, contest_reason = ?
       WHERE id = ? AND rated_user_id = ? AND voided = 0`,
    [byUserId, String(reason || '').slice(0, 500), ratingId, byUserId]
  );
  return res.affectedRows;
}

async function getRating(ratingId) {
  const [[r]] = await pool.query('SELECT * FROM lbtas_ratings WHERE id = ?', [ratingId]);
  return r || null;
}

// The narrative for a rating (operator-local, parties/adjudicator only — never in the
// commons reputation reads or the ledger).
async function getNarrative(ratingId) {
  const [[n]] = await pool.query('SELECT body FROM rating_narratives WHERE rating_id = ? ORDER BY created_at LIMIT 1', [ratingId]);
  return n ? n.body : null;
}

// Harm ratings (-1) RECEIVED by a user — the surface from which they contest (V2).
async function receivedHarm(userId) {
  const [rows] = await pool.query(
    `SELECT id, transaction_id, rater_role, rated_role, value, voided, contested, contest_reason, created_at
       FROM lbtas_ratings WHERE rated_user_id = ? AND value = -1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

// Distribution-based reputation per role. The active distribution is the trust
// signal; dismissed (voided) events are NOT hidden — they are surfaced separately,
// annotated with who dismissed them and why (V1).
async function getUserReputation(userId) {
  const [rows] = await pool.query(
    `SELECT value, rated_role, transaction_id, created_at, voided, voided_by, voided_reason
       FROM lbtas_ratings WHERE rated_user_id = ?`,
    [userId]
  );

  const active = rows.filter((r) => !r.voided);
  const dismissed = rows.filter((r) => r.voided);

  const byRole = {};
  for (const r of active) (byRole[r.rated_role] = byRole[r.rated_role] || []).push(r);
  const dismByRole = {};
  for (const r of dismissed) (dismByRole[r.rated_role] = dismByRole[r.rated_role] || []).push(r);

  const dismOut = (rs) => rs.map((d) => ({ value: Number(d.value), voided_by: d.voided_by, voided_reason: d.voided_reason, created_at: d.created_at }));

  const roles = Object.entries(byRole).map(([role, rs]) => {
    const values = rs.map((x) => Number(x.value));
    const times = rs.map((x) => x.created_at).filter(Boolean).sort();
    const txIds = new Set(rs.map((x) => x.transaction_id));
    return {
      role,
      label: ROLE_LABELS[role] || role,
      distribution: distributionOf(values),
      total: values.length,
      harm_count: values.filter((v) => v === -1).length,
      transaction_count: txIds.size,
      first_rated_at: times[0] || null,
      last_rated_at: times[times.length - 1] || null,
      dismissed: dismOut(dismByRole[role] || []),
    };
  }).sort((a, b) => b.total - a.total);

  // roles that exist only as dismissed events still surface (never hidden)
  for (const [role, ds] of Object.entries(dismByRole)) {
    if (!byRole[role]) {
      roles.push({ role, label: ROLE_LABELS[role] || role, distribution: distributionOf([]), total: 0, harm_count: 0, transaction_count: 0, first_rated_at: null, last_rated_at: null, dismissed: dismOut(ds) });
    }
  }

  const allValues = active.map((r) => Number(r.value));
  return {
    user_id: userId,
    roles,
    distribution: distributionOf(allValues),
    total: allValues.length,
    harm_count: allValues.filter((v) => v === -1).length,
    dismissed_count: dismissed.length,
  };
}

// Raw rating events for a transaction (review surface — caller must be authorized).
// Includes void/contest annotations; the narrative is fetched separately (V3).
async function getTransactionRatings(transactionId) {
  const [rows] = await pool.query(
    `SELECT id, transaction_id, rated_user_id, rater_user_id, rater_role, rated_role,
            value, category, voided, voided_by, voided_reason, contested, contest_reason, created_at
       FROM lbtas_ratings WHERE transaction_id = ? ORDER BY created_at`,
    [transactionId]
  );
  return rows;
}

// System-wide report (admin). Distribution-based; surfaces the harm list.
async function generateReport() {
  const [rows] = await pool.query(
    `SELECT rated_user_id, value, category, transaction_id FROM lbtas_ratings WHERE voided = 0`
  );

  const overall = rows.map((r) => Number(r.value));
  const catTotals = {};
  const perUser = {};
  for (const r of rows) {
    (catTotals[r.category] = catTotals[r.category] || []).push(Number(r.value));
    (perUser[r.rated_user_id] = perUser[r.rated_user_id] || []).push(Number(r.value));
  }

  const category_distributions = {};
  for (const [c, v] of Object.entries(catTotals)) category_distributions[c] = distributionOf(v);

  const user_distributions = {};
  const harm_flagged = [];
  for (const [u, v] of Object.entries(perUser)) {
    const dist = distributionOf(v);
    user_distributions[u] = { distribution: dist, total: v.length };
    if (dist['-1'] > 0) harm_flagged.push([u, dist['-1']]);
  }
  // Sort harm list by -1 count desc, then id asc for stable output.
  harm_flagged.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const txIds = new Set(rows.map((r) => r.transaction_id));
  const [[dism]] = await pool.query("SELECT COUNT(*) AS n FROM lbtas_ratings WHERE voided = 1");

  return {
    total_rated_users: Object.keys(perUser).length,
    total_ratings: overall.length,
    transaction_count: txIds.size,
    overall_distribution: distributionOf(overall),
    category_distributions,
    user_distributions,
    harm_flagged,
    dismissed_total: Number(dism.n) || 0, // dismissals are recorded, not hidden (V1)
    generated_at: new Date().toISOString(),
  };
}

// The bidirectional prompt feed: transactions the user can still rate.
async function pendingForUser(userId) {
  const [rows] = await pool.query(
    `SELECT id, buyer_id, seller_id, listing_title, amount, status, buyer_rated, seller_rated, created_at
       FROM transactions
      WHERE (buyer_id = ? OR seller_id = ?)
        AND status IN ('paid', 'completed')
        AND flagged_for_review = 0
        AND ((buyer_id = ? AND buyer_rated = 0) OR (seller_id = ? AND seller_rated = 0))
      ORDER BY created_at DESC`,
    [userId, userId, userId, userId]
  );
  return rows.map((t) => ({
    transaction_id: t.id,
    role: t.buyer_id === userId ? 'buyer' : 'seller',
    counterparty_id: t.buyer_id === userId ? t.seller_id : t.buyer_id,
    listing_title: t.listing_title,
    amount: t.amount,
    status: t.status,
    created_at: t.created_at,
  }));
}

module.exports = {
  createRating,
  voidRating,
  voidById,
  upholdContest,
  contestRating,
  getRating,
  getNarrative,
  receivedHarm,
  getUserReputation,
  getTransactionRatings,
  generateReport,
  pendingForUser,
};
