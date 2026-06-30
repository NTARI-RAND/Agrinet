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
const { distributionOf } = require('../services/lbtas');

// Insert one rating event. `conn` may be a pool connection inside a DB transaction.
async function createRating(
  { transactionId, ratedUserId, raterUserId, raterRole, value, category = 'overall', comment = null },
  conn = pool
) {
  const id = randomUUID();
  await conn.query(
    `INSERT INTO lbtas_ratings
       (id, transaction_id, rated_user_id, rater_user_id, rater_role, value, category, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, transactionId, ratedUserId, raterUserId, raterRole, value, category, comment]
  );
  return id;
}

// Distribution-based reputation for a rated user. NEVER averaged.
async function getUserReputation(userId) {
  const [rows] = await pool.query(
    `SELECT value, category, transaction_id, created_at
       FROM lbtas_ratings WHERE rated_user_id = ?`,
    [userId]
  );

  const values = rows.map((r) => Number(r.value));
  const byCategory = {};
  for (const r of rows) {
    (byCategory[r.category] = byCategory[r.category] || []).push(Number(r.value));
  }
  const category_distributions = {};
  for (const [c, vals] of Object.entries(byCategory)) category_distributions[c] = distributionOf(vals);

  const times = rows.map((r) => r.created_at).filter(Boolean).sort();
  const txIds = new Set(rows.map((r) => r.transaction_id));

  return {
    user_id: userId,
    distribution: distributionOf(values),
    total: values.length,
    harm_count: values.filter((v) => v === -1).length,
    category_distributions,
    transaction_count: txIds.size,
    first_rated_at: times[0] || null,
    last_rated_at: times[times.length - 1] || null,
  };
}

// Raw rating events for a transaction (review surface — caller must be authorized).
async function getTransactionRatings(transactionId) {
  const [rows] = await pool.query(
    `SELECT id, transaction_id, rated_user_id, rater_user_id, rater_role, value, category, comment, created_at
       FROM lbtas_ratings WHERE transaction_id = ? ORDER BY created_at`,
    [transactionId]
  );
  return rows;
}

// System-wide report (admin). Distribution-based; surfaces the harm list.
async function generateReport() {
  const [rows] = await pool.query(
    `SELECT rated_user_id, value, category, transaction_id FROM lbtas_ratings`
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

  return {
    total_rated_users: Object.keys(perUser).length,
    total_ratings: overall.length,
    transaction_count: txIds.size,
    overall_distribution: distributionOf(overall),
    category_distributions,
    user_distributions,
    harm_flagged,
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
  getUserReputation,
  getTransactionRatings,
  generateReport,
  pendingForUser,
};
