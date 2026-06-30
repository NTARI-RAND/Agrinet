/**
 * Contract lifecycle beyond settlement (Phase 4): PING reporting + futures-style
 * transfer of a contract position.
 *
 * A "contract" is a transaction whose subject is a plan post (see createFromPlan).
 * PING reports are the producer's progress updates, attached to the transaction so
 * they follow the contract when it is sold to a new buyer.
 */
const { randomUUID } = require('crypto');
const pool = require('../lib/db');
const walletRepository = require('../repositories/walletRepository');
const postRepository = require('../repositories/postRepository');
const { auditFinancialEvent } = require('../utils/financialAudit');

const DAY = 24 * 60 * 60 * 1000;
const STEP_DAYS = { daily: 1, weekly: 7, monthly: 30 };

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// The PING schedule is COMPUTED on read from the plan's cadence + dates — we don't
// persist future checkpoints. Spans planting -> harvest at the plan's ping_rate.
function computeSchedule(plan, contractCreatedAt) {
  if (!plan) return [];
  const p = plan.payload || {};
  const stepDays = STEP_DAYS[p.ping_rate] || STEP_DAYS.weekly;
  const start = parseDate(p.planting_date || p.desired_planting_date || contractCreatedAt);
  if (!start) return [];
  let end = parseDate(p.expected_harvest_date || p.desired_harvest_date || p.needed_by_date);
  if (!end || end <= start) end = new Date(start.getTime() + 90 * DAY);

  const now = new Date();
  const out = [];
  for (let d = new Date(start), guard = 0; d <= end && guard < 120; d = new Date(d.getTime() + stepDays * DAY), guard++) {
    out.push({ date: d.toISOString().slice(0, 10), status: d <= now ? 'past' : 'upcoming' });
  }
  return out;
}

async function getTx(transactionId, conn = pool) {
  const [rows] = await conn.query('SELECT * FROM transactions WHERE id = ?', [transactionId]);
  return rows[0] || null;
}

// Schedule + posted reports for a contract. Visible to the current buyer, the
// seller, or an admin (fail closed otherwise).
async function getContractPings(transactionId, userId, isAdmin = false) {
  const tx = await getTx(transactionId);
  if (!tx) { const e = new Error('Transaction not found'); e.statusCode = 404; throw e; }
  if (!isAdmin && tx.buyer_id !== userId && tx.seller_id !== userId) {
    const e = new Error('Forbidden'); e.statusCode = 403; throw e;
  }

  const plan = tx.post_id ? await postRepository.getById(tx.post_id) : null;
  const [reports] = await pool.query(
    `SELECT id, transaction_id, author_id, note, media, created_at
       FROM ping_reports WHERE transaction_id = ? ORDER BY created_at`,
    [transactionId]
  );
  for (const r of reports) {
    try { r.media = r.media ? JSON.parse(r.media) : []; } catch { r.media = []; }
  }

  return {
    schedule: computeSchedule(plan, tx.created_at),
    ping_rate: plan?.payload?.ping_rate || null,
    reports,
    seller_id: tx.seller_id,
    buyer_id: tx.buyer_id,
  };
}

// The seller (producer) posts a progress update. A note or at least one media item
// is required.
async function addPingReport({ transactionId, authorId, note, media }) {
  const tx = await getTx(transactionId);
  if (!tx) { const e = new Error('Transaction not found'); e.statusCode = 404; throw e; }
  if (tx.seller_id !== authorId) {
    const e = new Error('Only the producer (seller) can post PING updates'); e.statusCode = 403; throw e;
  }
  const cleanMedia = Array.isArray(media) ? media.filter((m) => typeof m === 'string').slice(0, 10) : [];
  if ((!note || !String(note).trim()) && cleanMedia.length === 0) {
    const e = new Error('A PING update needs a note or at least one photo'); e.statusCode = 400; throw e;
  }

  const id = randomUUID();
  await pool.query(
    `INSERT INTO ping_reports (id, transaction_id, author_id, note, media) VALUES (?, ?, ?, ?, ?)`,
    [id, transactionId, authorId, note ? String(note).slice(0, 2000) : null, JSON.stringify(cleanMedia)]
  );
  // keep the legacy ping counter on the transaction in step
  await pool.query('UPDATE transactions SET ping_count = ping_count + 1, last_ping = NOW() WHERE id = ?', [transactionId]).catch(() => {});
  return { id, transaction_id: transactionId, author_id: authorId, note: note || null, media: cleanMedia };
}

// Transfer (sell) a live contract position to a new buyer at a negotiated price.
// The new buyer pays the current buyer (wallet -> wallet); the producer's escrowed
// amount is untouched. Only buyer_id moves — and with it the right to delivery, the
// obligation to rate-to-release, and the PING history.
async function transferContract({ transactionId, fromUserId, toEmail, price }) {
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    const e = new Error('Invalid transfer price'); e.statusCode = 400; throw e;
  }
  if (!toEmail || typeof toEmail !== 'string') {
    const e = new Error('Buyer email required'); e.statusCode = 400; throw e;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [urows] = await connection.query('SELECT id FROM users WHERE email = ?', [toEmail.trim().toLowerCase()]);
    const toUser = urows[0];
    if (!toUser) { const e = new Error('No user with that email'); e.statusCode = 404; throw e; }

    const [trows] = await connection.query('SELECT * FROM transactions WHERE id = ? FOR UPDATE', [transactionId]);
    const tx = trows[0];
    if (!tx) { const e = new Error('Transaction not found'); e.statusCode = 404; throw e; }
    if (tx.buyer_id !== fromUserId) { const e = new Error('Only the current holder can transfer this contract'); e.statusCode = 403; throw e; }
    if (tx.status !== 'paid' || tx.escrow_locked !== 1) { const e = new Error('Only a live (paid, in-escrow) contract can be transferred'); e.statusCode = 409; throw e; }
    if (toUser.id === fromUserId) { const e = new Error('Cannot transfer to yourself'); e.statusCode = 400; throw e; }
    if (toUser.id === tx.seller_id) { const e = new Error('The producer cannot hold the buyer side'); e.statusCode = 400; throw e; }

    // new buyer pays the current holder the negotiated price
    await walletRepository.debit(toUser.id, numericPrice, `Contract purchase: ${tx.listing_title || ''}`.trim(), transactionId, connection);
    await walletRepository.credit(fromUserId, numericPrice, `Contract sale: ${tx.listing_title || ''}`.trim(), transactionId, null, 'sale', connection);

    await connection.query('UPDATE transactions SET buyer_id = ? WHERE id = ?', [toUser.id, transactionId]);

    await connection.query(
      `INSERT INTO contract_transfers (id, transaction_id, from_user, to_user, price) VALUES (?, ?, ?, ?, ?)`,
      [randomUUID(), transactionId, fromUserId, toUser.id, numericPrice]
    );

    await auditFinancialEvent({
      eventType: 'contract_transfer',
      userId: fromUserId,
      transactionId,
      walletUserId: fromUserId,
      amount: numericPrice,
      metadata: { to: toUser.id, source: 'contract_transfer' },
      connection,
    });

    await connection.commit();
    return { transactionId, from: fromUserId, to: toUser.id, price: numericPrice };

  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = { computeSchedule, getContractPings, addPingReport, transferContract };
