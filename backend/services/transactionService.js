const { randomUUID } = require("crypto");
const crypto = require("crypto");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const transactionRepository = require("../repositories/transactionRepository");
const { createTransactionItem } = require("../marketplace/models/transaction");
const { calculateFraudScore } = require("./fraudService");
const userRepository = require("../repositories/userRepository");
const walletRepository = require("../repositories/walletRepository");
const pool = require("../lib/db");
const { auditFinancialEvent } = require("../utils/financialAudit");
const {
  agrinet_rating_total,
  agrinet_rating_conflict_total,
  escrowReleaseSuccess,
  fraudFlagTotal,
  fraudBlockTotal,
  disputesOpenedTotal
} = require("../lib/metrics");

async function createTransactionWithWalletDebit(payload) {
  const numericAmount = Number(payload.amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 1000000) {
    const err = new Error("Invalid amount");
    err.statusCode = 400;
    throw err;
  }
  const buyerId = payload.buyerId;
  const sellerId = payload.sellerId;

  if (typeof sellerId !== "string" || sellerId.length > 50) {
    const err = new Error("Invalid sellerId");
    err.statusCode = 400;
    throw err;
  }

  if (!buyerId || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    const err = new Error("buyerId and valid positive amount required");
    err.statusCode = 400;
    throw err;
  }

  if (!sellerId) {
    const err = new Error("sellerId required");
    err.statusCode = 400;
    throw err;
  }

  if (buyerId === sellerId) {
    const err = new Error("Buyer cannot be the seller");
    err.statusCode = 400;
    throw err;
  }

  const buyer = await userRepository.findById(buyerId);
  if (!buyer) {
    const err = new Error("Buyer does not exist");
    err.statusCode = 404;
    throw err;
  }

  const seller = await userRepository.findById(sellerId);
  if (!seller) {
    const err = new Error("Seller does not exist");
    err.statusCode = 404;
    throw err;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 🔒 Debit using SAME connection
    await walletRepository.debit(
      buyerId,
      numericAmount,
      `Purchase: ${payload.listingTitle || ""}`.trim(),
      null,
      connection
    );

    const id = randomUUID();

    const item = createTransactionItem({
      ...payload,
      id,
      amount: numericAmount,
      escrowLocked: true,
      status: "pending"
    });

    const fraudScore = await calculateFraudScore(
      buyerId,
      sellerId,
      numericAmount
    );
    const flagged = fraudScore >= 60 ? 1 : 0;
    if (flagged === 1) {
      fraudFlagTotal.inc();
    }

    // Insert transaction using same connection
    await connection.query(
      `INSERT INTO transactions SET ?`,
      {
        id: item.id,
        buyer_id: item.buyerId,
        seller_id: item.sellerId,
        listing_id: item.listingId,
        listing_title: item.listingTitle,
        amount: item.amount,
        status: item.status,
        buyer_rated: 0,
        seller_rated: 0,
        rating_given: 0,
        escrow_locked: 1,
        fraud_score: fraudScore,
        flagged_for_review: flagged,
        created_at: new Date()
      }
    );

    await connection.commit();
    const { transactionsCreated } = require("../lib/metrics");
    transactionsCreated.inc();

    return { message: "Transaction initiated and wallet debited", transaction: item };

  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function createFromListing({ listingId, buyerId, quantity }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1️⃣ Lock listing
    const [listings] = await connection.query(
      `SELECT * FROM listings WHERE id = ? FOR UPDATE`,
      [listingId]
    );

    const listing = listings[0];

    if (!listing) {
      throw new Error("Listing not found");
    }

    if (listing.origin_node) {
      const err = new Error("Listing belongs to another federation node");
      err.statusCode = 400;
      err.origin_node = listing.origin_node;
      throw err;
    }

    if (listing.user_id === buyerId) {
      throw new Error("Cannot buy your own listing");
    }

    if (listing.status !== "active") {
      throw new Error("Listing not available");
    }

    if (Number(listing.quantity_available) < Number(quantity)) {
      throw new Error("Insufficient quantity");
    }

    const unitPrice = listing.price;
    const totalAmount = unitPrice * quantity;

    const transactionId = crypto.randomUUID();

    // 2️⃣ Create transaction
    await connection.query(
      `INSERT INTO transactions (
        id,
        buyer_id,
        seller_id,
        listing_id,
        listing_title,
        quantity,
        unit_price,
        amount,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        transactionId,
        buyerId,
        listing.user_id,
        listing.id,
        listing.title,
        quantity,
        unitPrice,
        totalAmount
      ]
    );

    await connection.query(
      `
      UPDATE listings
      SET
        quantity_available = quantity_available - ?,
        status = CASE
          WHEN quantity_available - ? <= 0 THEN 'sold'
          ELSE status
        END
      WHERE id = ?
      `,
      [quantity, quantity, listingId]
    );

    await connection.commit();

    return { transactionId, totalAmount };

  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function createPaymentForTransaction(transactionId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT * FROM transactions WHERE id = ? FOR UPDATE`,
      [transactionId]
    );

    const transaction = rows[0];

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    if (transaction.status !== "pending") {
      throw new Error("Invalid transaction state");
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(transaction.amount * 100),
      currency: 'brl',
      payment_method_types: ['card'],
      metadata: {
        transactionId: transaction.id,
        listingId: transaction.listing_id
      }
    });

    await connection.query(
      `INSERT INTO payments (
        id,
        user_id,
        amount,
        provider,
        status
      ) VALUES (?, ?, ?, 'stripe', 'pending')`,
      [
        paymentIntent.id,
        transaction.buyer_id,
        transaction.amount
      ]
    );

    await connection.commit();

    return {
      clientSecret: paymentIntent.client_secret
    };

  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// LBTAS rating submission (Phase 3). Bidirectional, distribution-based.
// Writes an immutable rating EVENT — it does NOT sum into users.reputation_score
// (reputation is computed as a distribution on read; see ratingRepository). A -1
// requires a justifying comment (<=500 words). No auto-ban: harm is surfaced, not
// auto-actioned.
async function rateTransaction(transactionId, rating, userId, { comment = null, category = 'overall' } = {}) {
  const numericRating = Number(rating);
  const { validateRating } = require("./lbtas");
  const ratingRepository = require("../repositories/ratingRepository");

  const v = validateRating(numericRating, comment);
  if (!v.ok) {
    const err = new Error(v.errors.join("; "));
    err.statusCode = 400;
    throw err;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT * FROM transactions WHERE id = ? FOR UPDATE`,
      [transactionId]
    );

    if (!rows.length) {
      const err = new Error("Transaction not found");
      err.statusCode = 404;
      throw err;
    }

    const tx = rows[0];
    let actorRole;
    if (tx.buyer_id === userId) {
      actorRole = "buyer";
    } else if (tx.seller_id === userId) {
      actorRole = "seller";
    } else {
      const err = new Error("User not part of this transaction");
      err.statusCode = 403;
      throw err;
    }

    if (tx.flagged_for_review === 1) {
      fraudBlockTotal.inc();
      const err = new Error("Transaction under review");
      err.statusCode = 409;
      throw err;
    }

    // prevent double rating (one rating per direction per transaction)
    if (actorRole === "buyer" && tx.buyer_rated === 1) {
      const err = new Error("Buyer already rated");
      err.statusCode = 409;
      throw err;
    }

    if (actorRole === "seller" && tx.seller_rated === 1) {
      const err = new Error("Seller already rated");
      err.statusCode = 409;
      throw err;
    }

    const ratedUserId = actorRole === "buyer" ? tx.seller_id : tx.buyer_id;

    // Persist the rating event (distribution-based reputation, never averaged).
    await ratingRepository.createRating(
      {
        transactionId,
        ratedUserId,
        raterUserId: userId,
        raterRole: actorRole,
        value: numericRating,
        category,
        comment: comment || null,
      },
      connection
    );

    // mark this side as rated
    await connection.query(
      actorRole === "buyer"
        ? `UPDATE transactions SET buyer_rated = 1 WHERE id = ?`
        : `UPDATE transactions SET seller_rated = 1 WHERE id = ?`,
      [transactionId]
    );

    // LBTAS escrow gate (Phase 4): the consumer's (buyer's) rating settles the held
    // funds. A 0..+4 releases to the producer. A -1 ("No Trust") instead FREEZES the
    // funds and auto-opens a dispute (the mandatory -1 comment is the dispute reason)
    // for manual admin resolution. The producer's post-hoc rating never moves money.
    let escrowReleased = false;
    let disputeOpened = false;
    if (actorRole === "buyer" && tx.status === "paid" && tx.escrow_locked === 1) {
      if (numericRating === -1) {
        await _openDisputeTx(
          { id: transactionId },
          connection,
          { openedBy: userId, reason: `No Trust (-1): ${comment || ''}`.trim() }
        );
        disputeOpened = true;
      } else {
        escrowReleased = await _settleEscrow(
          { id: transactionId, amount: tx.amount, seller_id: tx.seller_id },
          connection,
          { actorId: userId, source: 'lbtas_gate' }
        );
      }
    }

    // finalize once both sides have rated
    await connection.query(
      `UPDATE transactions SET rating_given = 1
        WHERE id = ? AND buyer_rated = 1 AND seller_rated = 1`,
      [transactionId]
    );

    await connection.commit();
    agrinet_rating_total.inc();

    return { message: "Rating submitted successfully", escrowReleased, disputeOpened };

  } catch (err) {
    if (err?.statusCode === 409) {
      agrinet_rating_conflict_total.inc();
    }
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function pingTransaction(transactionId) {
  const result = await transactionRepository.ping(transactionId);

  return {
    message: "Ping recorded",
    pingCount: result.pingCount,
    lastPing: result.lastPing
  };
}

async function resolveFlag(transactionId, action, adminId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT * FROM transactions WHERE id = ?",
      [transactionId]
    );

    if (!rows.length) {
      const err = new Error("Transaction not found");
      err.statusCode = 404;
      throw err;
    }

    const transaction = rows[0];

    if (!transaction.flagged_for_review) {
      const err = new Error("Transaction is not flagged");
      err.statusCode = 400;
      throw err;
    }

    if (action === "approve") {
      await connection.query(
        "UPDATE transactions SET flagged_for_review = 0 WHERE id = ?",
        [transactionId]
      );
    }

    if (action === "cancel") {
      if (transaction.status !== "pending" || transaction.escrow_locked !== 1) {
        const err = new Error("Only pending locked transactions can be cancelled");
        err.statusCode = 409;
        throw err;
      }

      // 1️⃣ Refund buyer inside SAME transaction
      await walletRepository.credit(
        transaction.buyer_id,
        Number(transaction.amount),
        `Refund: ${transaction.listing_title || ""}`,
        `${transactionId}-refund`,
        null,
        "deposit"
      );

      // 2️⃣ Cancel transaction + unlock escrow
      await connection.query(
        `UPDATE transactions 
         SET status = 'cancelled',
             escrow_locked = 0,
             flagged_for_review = 0,
             rating_given = 1
         WHERE id = ?`,
        [transactionId]
      );
    }

    await connection.query(
      `INSERT INTO admin_actions 
       (id, admin_id, action, target_type, target_id, meta)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        adminId,
        action,
        "transaction",
        transactionId,
        JSON.stringify({
          previousStatus: transaction.status,
          flagged: transaction.flagged_for_review
        })
      ]
    );

    await connection.commit();

    return { message: "Flag resolved" };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function getAdminStats() {
  const [rows] = await pool.query(`
    SELECT
      COUNT(*) AS totalTransactions,
      SUM(status = 'pending') AS pending,
      SUM(status = 'completed') AS completed,
      SUM(flagged_for_review = 1) AS flagged,
      COALESCE(SUM(CASE 
        WHEN status = 'completed' THEN amount 
        ELSE 0 
      END), 0) AS totalVolume
    FROM transactions
  `);

  const result = rows[0] || {};

  return {
    totalTransactions: Number(result.totalTransactions || 0),
    pending: Number(result.pending || 0),
    completed: Number(result.completed || 0),
    flagged: Number(result.flagged || 0),
    totalVolume: Number(result.totalVolume || 0)
  };
}

// Settle escrow within an EXISTING db transaction (caller owns the connection and
// has the tx row locked FOR UPDATE): transition paid->completed and credit the
// seller. The WHERE guard makes it idempotent. Returns true iff it released.
// `source` tags the audit trail ('lbtas_gate' = auto-release on the consumer's
// rating; 'manual' = a seller-initiated release after the gate is satisfied).
async function _settleEscrow(tx, connection, { actorId, source }) {
  // Settle held funds from either 'paid' (the normal rating release) or 'disputed'
  // (an admin resolving a frozen dispute in the seller's favour). escrow_locked is
  // the real "funds still held" flag; callers validate the higher-level state.
  const [updateTx] = await connection.query(
    `UPDATE transactions
       SET status='completed', escrow_locked=0, escrow_released_at=NOW()
     WHERE id=? AND escrow_locked=1 AND status IN ('paid','disputed')`,
    [tx.id]
  );
  if (updateTx.affectedRows === 0) return false;

  await connection.query(
    `UPDATE wallets SET balance = balance + ? WHERE user_id = ?`,
    [tx.amount, tx.seller_id]
  );

  await auditFinancialEvent({
    eventType: "escrow_release",
    userId: actorId,
    transactionId: tx.id,
    walletUserId: tx.seller_id,
    amount: tx.amount,
    metadata: { source },
    connection
  });

  escrowReleaseSuccess.inc();
  return true;
}

async function releaseEscrow(transactionId, userId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT * FROM transactions WHERE id=? FOR UPDATE`,
      [transactionId]
    );

    const tx = rows[0];

    if (!tx) throw new Error('Transaction not found');

    if (tx.seller_id !== userId) {
      throw new Error('Not authorized to release escrow');
    }

    if (tx.status === 'disputed') {
      throw new Error('Escrow locked due to active dispute');
    }

    if (tx.status !== 'paid') {
      throw new Error('Transaction not paid');
    }

    if (tx.escrow_locked !== 1) {
      throw new Error('Escrow already released');
    }

    // LBTAS escrow gate: no release signal until the consumer's rating is in.
    if (tx.buyer_rated !== 1) {
      const err = new Error("Escrow release requires the buyer's LBTAS rating first");
      err.statusCode = 409;
      throw err;
    }

    const released = await _settleEscrow(tx, connection, { actorId: userId, source: 'manual' });
    if (!released) {
      throw new Error('Escrow already released or transaction not eligible');
    }

    await connection.commit();

    return { message: 'Escrow released' };

  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// Open a dispute within an EXISTING db transaction (caller owns the connection and
// holds the tx row locked). Freezes the funds by moving the tx to 'disputed'. Used
// by a buyer-initiated dispute and by the automatic -1 ("No Trust") escrow freeze.
// `reason` is capped to the disputes.reason column width (the full justifying text
// lives in the LBTAS rating event).
async function _openDisputeTx(tx, connection, { openedBy, reason }) {
  const disputeId = randomUUID();
  await connection.query(
    `INSERT INTO disputes (id, transaction_id, opened_by, reason, status)
     VALUES (?, ?, ?, ?, 'open')`,
    [disputeId, tx.id, openedBy, String(reason || '').slice(0, 255)]
  );
  await connection.query(
    `UPDATE transactions SET status = 'disputed' WHERE id = ?`,
    [tx.id]
  );
  disputesOpenedTotal.inc();
  return disputeId;
}

async function openDispute(transactionId, userId, reason) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT * FROM transactions WHERE id=? FOR UPDATE`,
      [transactionId]
    );

    const tx = rows[0];

    if (!tx) throw new Error('Transaction not found');

    if (tx.buyer_id !== userId) {
      throw new Error('Only the buyer can open a dispute');
    }

    if (tx.status !== 'paid') {
      throw new Error('Dispute can only be opened for paid transactions');
    }

    if (tx.escrow_locked !== 1) {
      throw new Error('Escrow already released');
    }

    const disputeId = await _openDisputeTx(tx, connection, { openedBy: userId, reason });

    await connection.commit();

    return {
      message: 'Dispute opened',
      disputeId
    };

  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// Admin resolution of a frozen dispute: actually move the money.
//   release -> settle escrow to the seller (complete the tx)
//   refund  -> return the held amount to the buyer (refund the tx)
async function resolveDispute(disputeId, resolution, adminId) {
  if (resolution !== 'release' && resolution !== 'refund') {
    const err = new Error("resolution must be 'release' or 'refund'");
    err.statusCode = 400;
    throw err;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [drows] = await connection.query(
      `SELECT * FROM disputes WHERE id = ? FOR UPDATE`,
      [disputeId]
    );
    const dispute = drows[0];
    if (!dispute) { const e = new Error('Dispute not found'); e.statusCode = 404; throw e; }
    if (dispute.status !== 'open') { const e = new Error('Dispute already resolved'); e.statusCode = 400; throw e; }

    const [trows] = await connection.query(
      `SELECT * FROM transactions WHERE id = ? FOR UPDATE`,
      [dispute.transaction_id]
    );
    const tx = trows[0];
    if (!tx) { const e = new Error('Transaction not found'); e.statusCode = 404; throw e; }
    if (tx.escrow_locked !== 1) { const e = new Error('Escrow already released'); e.statusCode = 409; throw e; }

    if (resolution === 'release') {
      const ok = await _settleEscrow(tx, connection, { actorId: adminId, source: 'dispute_release' });
      if (!ok) { const e = new Error('Transaction not eligible for release'); e.statusCode = 409; throw e; }
    } else {
      // refund: unlock + mark refunded first (guarded), then credit the buyer back
      const [upd] = await connection.query(
        `UPDATE transactions SET status='refunded', escrow_locked=0
          WHERE id=? AND escrow_locked=1`,
        [tx.id]
      );
      if (upd.affectedRows === 0) { const e = new Error('Transaction not eligible for refund'); e.statusCode = 409; throw e; }
      await walletRepository.credit(
        tx.buyer_id,
        Number(tx.amount),
        `Refund (dispute): ${tx.listing_title || ''}`.trim(),
        tx.id,
        null,
        'refund',
        connection
      );
    }

    await connection.query(
      `UPDATE disputes SET status='resolved', resolution=? WHERE id=?`,
      [resolution, disputeId]
    );

    await connection.commit();
    return { message: 'Dispute resolved', resolution, transactionId: tx.id };

  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  createTransactionWithWalletDebit,
  createFromListing,
  createPaymentForTransaction,
  releaseEscrow,
  pingTransaction,
  rateTransaction,
  resolveFlag,
  openDispute,
  resolveDispute,
  getAdminStats
};
