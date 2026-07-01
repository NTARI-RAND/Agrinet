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
const mycelium = require("./myceliumService");
const ledger = require("../repositories/ledgerRepository");
const settings = require("../repositories/settingsRepository");
const { ACCOUNTS } = ledger;

// Append a transmission to a transaction's Mycelium dialog (best-effort — a ledger
// failure is logged but never fails the money path). `data` carries refs + facts only.
async function logTx(type, transactionId, { actorId = null, actorRole = null, ...data } = {}) {
  try { await mycelium.record(transactionId, { type, actorId, actorRole, data }); }
  catch (e) { console.error("mycelium append failed:", e.message); }
}

// Seal the dialog once the exchange is COMPLETE (both sides rated -> rating_given)
// AND QUIESCENT (no open dispute, no active contest). Best-effort; safe to re-call.
async function sealIfComplete(transactionId) {
  try {
    const [[tx]] = await pool.query("SELECT rating_given FROM transactions WHERE id = ?", [transactionId]);
    if (!tx || tx.rating_given !== 1) return;
    const [[d]] = await pool.query("SELECT COUNT(*) n FROM disputes WHERE transaction_id = ? AND status = 'open'", [transactionId]);
    if (Number(d.n) > 0) return;
    const [[c]] = await pool.query("SELECT COUNT(*) n FROM lbtas_ratings WHERE transaction_id = ? AND contested = 1 AND voided = 0", [transactionId]);
    if (Number(c.n) > 0) return;
    await mycelium.seal(transactionId);
  } catch (e) { console.error("mycelium seal failed:", e.message); }
}

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

    const id = randomUUID();

    // Fund escrow from the buyer's in-network balance (net-zero): buyer -A, escrow +A.
    // (Fiat purchases fund escrow via the Stripe webhook instead; JFA §7.2/§7.3.)
    await ledger.post(
      connection,
      { txId: id, kind: 'escrow_fund', entries: [
        { account: buyerId, amount: -numericAmount },
        { account: ACCOUNTS.ESCROW, amount: numericAmount },
      ] },
      { checkFunds: true }
    );

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
    await logTx('transaction_created', transactionId, { actorId: buyerId, buyer: buyerId, seller: listing.user_id, listing: listing.id, amount: totalAmount, quantity });

    return { transactionId, totalAmount };

  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// Contract a plan post (Phase 4). For a plan_producer post the actor is the buyer
// (a backer contracting future production); for a plan_consumer post the actor is
// the seller (a producer fulfilling the request). Creates a 'pending' escrow
// transaction whose subject is the plan POST — it then flows through the same
// pay / escrow-gate / rating / settlement machinery as a listing purchase.
async function createFromPlan({ planId, actorId, quantity }) {
  const numericQty = Number(quantity);
  if (!Number.isFinite(numericQty) || numericQty <= 0) {
    const e = new Error("Invalid quantity"); e.statusCode = 400; throw e;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(`SELECT * FROM posts WHERE id = ? FOR UPDATE`, [planId]);
    const plan = rows[0];

    if (!plan) { const e = new Error("Plan not found"); e.statusCode = 404; throw e; }
    if (plan.post_type !== 'plan_producer' && plan.post_type !== 'plan_consumer') {
      const e = new Error("Post is not a plan"); e.statusCode = 400; throw e;
    }
    if (plan.status !== 'active') { const e = new Error("Plan not available"); e.statusCode = 400; throw e; }
    if (plan.origin_node) {
      const e = new Error("Plan belongs to another federation node"); e.statusCode = 400; e.origin_node = plan.origin_node; throw e;
    }
    if (plan.user_id === actorId) { const e = new Error("Cannot contract your own plan"); e.statusCode = 400; throw e; }
    if (plan.price == null) { const e = new Error("Plan has no price to contract against"); e.statusCode = 400; throw e; }

    // plan_producer: actor backs the producer's plan (actor = buyer).
    // plan_consumer: actor fulfills the consumer's request (actor = seller).
    const buyerId = plan.post_type === 'plan_producer' ? actorId : plan.user_id;
    const sellerId = plan.post_type === 'plan_producer' ? plan.user_id : actorId;

    if (plan.quantity_available != null && Number(plan.quantity_available) < numericQty) {
      const e = new Error("Insufficient plan quantity"); e.statusCode = 400; throw e;
    }

    let payload = {};
    try { payload = plan.payload ? JSON.parse(plan.payload) : {}; } catch { /* default */ }

    // Contract shares (§4.5.3.4): how a plan may be split across backers.
    //   none     -> not divisible: one backer must take the full remaining quantity
    //   fixed    -> divisible in whole shares (integer quantities)
    //   variable -> divisible into any quantity (default)
    const sharePolicy = payload.contract_shares || 'variable';
    if (sharePolicy === 'none' && (plan.quantity_available == null || Number(plan.quantity_available) !== numericQty)) {
      const e = new Error("This plan is not divisible — contract the full remaining quantity"); e.statusCode = 400; throw e;
    }
    if (sharePolicy === 'fixed' && !Number.isInteger(numericQty)) {
      const e = new Error("This plan is sold in whole shares"); e.statusCode = 400; throw e;
    }

    // Settlement model:
    //   maturity -> snapshot a settle_at date; escrow can't release before then
    //   tranches -> split escrow into N progress payments (buyer releases as the
    //               producer reports; the final tranche is gated by the rating)
    //   on_confirmation (default) -> release in full on the buyer's rating
    let settleAt = null;
    let trancheCount = null;
    if (payload.settlement === 'maturity') {
      const d = payload.expected_harvest_date || payload.desired_harvest_date || payload.needed_by_date;
      const dt = d ? new Date(d) : null;
      if (dt && !isNaN(dt.getTime())) settleAt = dt.toISOString().slice(0, 19).replace('T', ' ');
    } else if (payload.settlement === 'tranches') {
      let n = parseInt(payload.tranche_count, 10);
      if (!Number.isFinite(n) || n < 2) n = 3;
      if (n > 12) n = 12;
      trancheCount = n;
    }

    const unitPrice = Number(plan.price);
    const amount = unitPrice * numericQty;
    const transactionId = randomUUID();

    await connection.query(
      `INSERT INTO transactions (id, buyer_id, seller_id, post_id, listing_title, quantity, unit_price, amount, status, settle_at, tranche_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [transactionId, buyerId, sellerId, planId, plan.title, numericQty, unitPrice, amount, settleAt, trancheCount]
    );

    if (plan.quantity_available != null) {
      await connection.query(
        `UPDATE posts
            SET quantity_available = quantity_available - ?,
                status = CASE WHEN quantity_available - ? <= 0 THEN 'fulfilled' ELSE status END
          WHERE id = ?`,
        [numericQty, numericQty, planId]
      );
    }

    await connection.commit();
    await logTx('contract_created', transactionId, { actorId: buyerId, buyer: buyerId, seller: sellerId, post: planId, amount, quantity: numericQty });
    return { transactionId, amount, buyerId, sellerId, postType: plan.post_type };

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
  const { validateRating, ratedRole } = require("./lbtas");
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

    // Maturity hold: the buyer's confirm-to-release can't happen before the settle
    // date. (Problems before maturity go through the manual dispute path.)
    if (actorRole === "buyer" && tx.settle_at && new Date(tx.settle_at) > new Date()) {
      const maturity = new Date(tx.settle_at).toISOString().slice(0, 10);
      const err = new Error(`This contract settles at maturity (${maturity}). You can confirm after the delivery date.`);
      err.statusCode = 409;
      throw err;
    }

    const ratedUserId = actorRole === "buyer" ? tx.seller_id : tx.buyer_id;

    // The rated user's *role* is the capacity they acted in: a buyer rating a seller
    // rates them as the provider of the post's activity (market_seller, agrotourism_host,
    // …); a seller rating a buyer rates them as that activity's consumer. Reputations
    // are kept separate per role.
    let postType = 'direct_market';
    try {
      const [prows] = await connection.query(`SELECT post_type FROM posts WHERE id = ?`, [tx.post_id || tx.listing_id]);
      if (prows.length) postType = prows[0].post_type;
    } catch (_) { /* no post row -> default market role */ }
    const ratedRoleLabel = ratedRole(postType, actorRole === "buyer" ? "provider" : "consumer");

    // Persist the rating event (distribution-based reputation, never averaged).
    await ratingRepository.createRating(
      {
        transactionId,
        ratedUserId,
        raterUserId: userId,
        raterRole: actorRole,
        ratedRole: ratedRoleLabel,
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
    let settle = null;
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
        // pass the full row so _settleEscrow sees released_amount (tranche contracts)
        settle = await _settleEscrow(tx, connection, { actorId: userId, source: 'lbtas_gate' });
        escrowReleased = !!settle;
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

    await logTx('rating', transactionId, { actorId: userId, actorRole, ratedRole: ratedRoleLabel, value: numericRating });
    if (escrowReleased) await logTx('escrow_settled', transactionId, { actorId: userId, seller: ratedUserId, amount: settle.sellerNet, gross: Number(tx.amount), fee: settle.fee, trigger: 'rating' });
    if (escrowReleased && settle.fee > 0) await logTx('platform_fee', transactionId, { actorId: 'platform', amount: settle.fee, trigger: 'rating' });
    if (disputeOpened) await logTx('audit_open', transactionId, { actorId: userId, role: actorRole, target: 'rating' });
    await sealIfComplete(transactionId);

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

      // 1️⃣ Refund buyer inside the SAME db transaction: escrow -> buyer (net-zero).
      const refundable = Number(transaction.amount) - Number(transaction.released_amount || 0);
      if (refundable > 0) {
        await ledger.post(connection, { txId: transactionId, kind: 'refund', entries: [
          { account: ACCOUNTS.ESCROW, amount: -refundable },
          { account: transaction.buyer_id, amount: refundable },
        ] });
      }

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
       SET status='completed', escrow_locked=0, escrow_released_at=NOW(), released_amount = amount
     WHERE id=? AND escrow_locked=1 AND status IN ('paid','disputed')`,
    [tx.id]
  );
  if (updateTx.affectedRows === 0) return false;

  // Release only what is still held (intermediate tranches may already be paid out).
  const remaining = Number(tx.amount) - Number(tx.released_amount || 0);
  let fee = 0, sellerNet = 0;
  if (remaining > 0) {
    // Split the release: seller gets amount - fee; the platform fee is a visible
    // ledger entry to the `platform` account (JFA §7.4, transparent fee). Net-zero.
    const bps = await settings.getFeeBps(connection);
    fee = settings.feeFor(remaining, bps);
    sellerNet = ledger.round2(remaining - fee);
    const entries = [
      { account: ACCOUNTS.ESCROW, amount: -remaining },
      { account: tx.seller_id, amount: sellerNet },
    ];
    if (fee > 0) entries.push({ account: ACCOUNTS.PLATFORM, amount: fee });
    await ledger.post(connection, { txId: tx.id, kind: 'escrow_release', entries });

    await auditFinancialEvent({
      eventType: "escrow_release",
      userId: actorId,
      transactionId: tx.id,
      walletUserId: tx.seller_id,
      amount: sellerNet,
      metadata: { source, fee, fee_bps: bps },
      connection
    });
  }

  escrowReleaseSuccess.inc();
  return { fee, sellerNet, remaining };
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

    // Maturity hold: funds can't release before the contract's settle date.
    if (tx.settle_at && new Date(tx.settle_at) > new Date()) {
      const err = new Error("Escrow is held until the contract's maturity date");
      err.statusCode = 409;
      throw err;
    }

    const settle = await _settleEscrow(tx, connection, { actorId: userId, source: 'manual' });
    if (!settle) {
      throw new Error('Escrow already released or transaction not eligible');
    }

    await connection.commit();
    await logTx('escrow_settled', transactionId, { actorId: userId, seller: tx.seller_id, amount: settle.sellerNet, gross: Number(tx.amount), fee: settle.fee, trigger: 'manual' });
    if (settle.fee > 0) await logTx('platform_fee', transactionId, { actorId: 'platform', amount: settle.fee, trigger: 'manual' });
    await sealIfComplete(transactionId);

    return { message: 'Escrow released' };

  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// Release one intermediate progress tranche to the producer (buyer-initiated, as
// the producer posts PING progress). The final tranche is NOT released here — it is
// gated by the buyer's rating (rateTransaction -> _settleEscrow releases the rest).
async function releaseTranche(transactionId, userId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(`SELECT * FROM transactions WHERE id = ? FOR UPDATE`, [transactionId]);
    const tx = rows[0];
    if (!tx) { const e = new Error("Transaction not found"); e.statusCode = 404; throw e; }
    if (tx.buyer_id !== userId) { const e = new Error("Only the buyer can release a progress payment"); e.statusCode = 403; throw e; }
    if (!tx.tranche_count) { const e = new Error("This contract is not on progress payments"); e.statusCode = 400; throw e; }
    if (tx.status !== 'paid' || tx.escrow_locked !== 1) { const e = new Error("No live escrow to release"); e.statusCode = 409; throw e; }

    const count = Number(tx.tranche_count);
    const done = Number(tx.tranches_released || 0);
    if (done >= count - 1) {
      const e = new Error("Only the final payment remains — release it by confirming/rating the contract");
      e.statusCode = 409; throw e;
    }

    const trancheAmt = Math.round((Number(tx.amount) / count) * 100) / 100;
    const bps = await settings.getFeeBps(connection);
    const fee = settings.feeFor(trancheAmt, bps);
    const sellerNet = ledger.round2(trancheAmt - fee);

    // escrow -> seller (net of fee) + platform (fee). Net-zero.
    const entries = [
      { account: ACCOUNTS.ESCROW, amount: -trancheAmt },
      { account: tx.seller_id, amount: sellerNet },
    ];
    if (fee > 0) entries.push({ account: ACCOUNTS.PLATFORM, amount: fee });
    await ledger.post(connection, { txId: transactionId, kind: 'tranche', entries });

    await connection.query(
      `UPDATE transactions SET released_amount = released_amount + ?, tranches_released = tranches_released + 1 WHERE id = ?`,
      [trancheAmt, transactionId]
    );
    await auditFinancialEvent({
      eventType: "escrow_release",
      userId,
      transactionId,
      walletUserId: tx.seller_id,
      amount: sellerNet,
      metadata: { source: 'tranche', tranche: done + 1, of: count, fee, fee_bps: bps },
      connection
    });
    escrowReleaseSuccess.inc();

    await connection.commit();
    await logTx('tranche_released', transactionId, { actorId: userId, seller: tx.seller_id, amount: sellerNet, gross: trancheAmt, fee, tranche: done + 1, of: count });
    if (fee > 0) await logTx('platform_fee', transactionId, { actorId: 'platform', amount: fee, trigger: 'tranche' });
    return { released: sellerNet, gross: trancheAmt, fee, tranches_released: done + 1, tranche_count: count };

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
async function resolveDispute(disputeId, resolution, adminId, opts = {}) {
  if (resolution !== 'release' && resolution !== 'refund') {
    const err = new Error("resolution must be 'release' or 'refund'");
    err.statusCode = 400;
    throw err;
  }

  const ratingRepository = require("../repositories/ratingRepository");
  const { validateRating, ratedRole } = require("./lbtas");

  // If the admin issues a replacement rating, validate it up front (a -1 needs a comment).
  if (opts.voidBuyerRating && opts.adminRating && opts.adminRating.value != null) {
    const v = validateRating(Number(opts.adminRating.value), opts.adminRating.comment);
    if (!v.ok) { const e = new Error(v.errors.join('; ')); e.statusCode = 400; throw e; }
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

    let settle = null;
    if (resolution === 'release') {
      settle = await _settleEscrow(tx, connection, { actorId: adminId, source: 'dispute_release' });
      if (!settle) { const e = new Error('Transaction not eligible for release'); e.statusCode = 409; throw e; }
    } else {
      // refund: unlock + mark refunded first (guarded), then return held funds to the buyer
      const [upd] = await connection.query(
        `UPDATE transactions SET status='refunded', escrow_locked=0
          WHERE id=? AND escrow_locked=1`,
        [tx.id]
      );
      if (upd.affectedRows === 0) { const e = new Error('Transaction not eligible for refund'); e.statusCode = 409; throw e; }
      // Only the still-held amount returns to the buyer (released tranches already paid out).
      const refundable = Number(tx.amount) - Number(tx.released_amount || 0);
      if (refundable > 0) {
        // escrow -> buyer (net-zero)
        await ledger.post(connection, { txId: tx.id, kind: 'refund', entries: [
          { account: ACCOUNTS.ESCROW, amount: -refundable },
          { account: tx.buyer_id, amount: refundable },
        ] });
        await auditFinancialEvent({
          eventType: 'refund', userId: adminId, transactionId: tx.id,
          walletUserId: tx.buyer_id, amount: refundable, metadata: { source: 'dispute' }, connection,
        });
      }
    }

    // Bad-faith finding: void the buyer's rating of the seller so it stops counting,
    // and (optionally) let the admin issue a replacement rating of the seller. The
    // seller's own rating of the buyer is untouched — it still stands.
    if (opts.voidBuyerRating) {
      await ratingRepository.voidRating(
        { transactionId: tx.id, raterRole: 'buyer', voidedBy: adminId, reason: opts.voidReason || 'admin: bad-faith rating' },
        connection
      );
      if (opts.adminRating && opts.adminRating.value != null) {
        let postType = 'direct_market';
        const [prows] = await connection.query(`SELECT post_type FROM posts WHERE id = ?`, [tx.post_id || tx.listing_id]);
        if (prows.length) postType = prows[0].post_type;
        await ratingRepository.createRating(
          {
            transactionId: tx.id,
            ratedUserId: tx.seller_id,
            raterUserId: adminId,
            raterRole: 'admin',
            ratedRole: ratedRole(postType, 'provider'),
            value: Number(opts.adminRating.value),
            comment: opts.adminRating.comment || null,
          },
          connection
        );
      }
    }

    await connection.query(
      `UPDATE disputes SET status='resolved', resolution=? WHERE id=?`,
      [resolution, disputeId]
    );

    await connection.commit();
    if (resolution === 'release') {
      await logTx('escrow_settled', tx.id, { actorId: adminId, seller: tx.seller_id, amount: settle.sellerNet, gross: Number(tx.amount), fee: settle.fee, trigger: 'dispute' });
      if (settle.fee > 0) await logTx('platform_fee', tx.id, { actorId: 'platform', amount: settle.fee, trigger: 'dispute' });
    }
    else if (resolution === 'refund') await logTx('refunded', tx.id, { actorId: adminId, buyer: tx.buyer_id, trigger: 'dispute' });
    if (opts.voidBuyerRating) await logTx('rating_dismissed', tx.id, { actorId: adminId, target: 'buyer_rating' });
    await logTx('audit_resolved', tx.id, { actorId: adminId, outcome: resolution });
    await sealIfComplete(tx.id);
    return { message: 'Dispute resolved', resolution, transactionId: tx.id };

  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// ── Rating-window timeouts (P3-013 §4.1) ──────────────────────────────────────
// A non-responsive party's rating defaults to +2 ("Basic Satisfaction"): silence is
// read as a completed exchange with no complaint. The default is attributed to the
// `system` user and marked (rater_role='system', category='timeout'), so it is
// distinguishable from an affirmed rating. A buyer default confirms receipt and
// releases escrow; a seller default just completes the record. Either way the dialog
// then seals.
const CONFIRM_WINDOW_MS = Number(process.env.CONFIRM_WINDOW_MS) || 14 * 24 * 3600 * 1000;  // buyer
const REVIEW_WINDOW_MS = Number(process.env.REVIEW_WINDOW_MS) || 90 * 24 * 3600 * 1000;    // seller (post-hoc)
const TIMEOUT_DEFAULT = 2;

async function _defaultRate(txId, side) {
  const ratingRepository = require("../repositories/ratingRepository");
  const { ratedRole } = require("./lbtas");
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query("SELECT * FROM transactions WHERE id = ? FOR UPDATE", [txId]);
    const tx = rows[0];
    if (!tx) { await connection.rollback(); return false; }
    // re-check eligibility under the lock
    if (side === "seller" && (tx.seller_rated === 1 || tx.status !== "completed")) { await connection.rollback(); return false; }
    if (side === "buyer" && (tx.buyer_rated === 1 || tx.status !== "paid" || tx.escrow_locked !== 1)) { await connection.rollback(); return false; }

    let postType = "direct_market";
    try {
      const [p] = await connection.query("SELECT post_type FROM posts WHERE id = ?", [tx.post_id || tx.listing_id]);
      if (p.length) postType = p[0].post_type;
    } catch (_) { /* default */ }

    const ratedUserId = side === "buyer" ? tx.seller_id : tx.buyer_id;
    const ratedRoleLabel = ratedRole(postType, side === "buyer" ? "provider" : "consumer");

    await ratingRepository.createRating(
      { transactionId: tx.id, ratedUserId, raterUserId: "system", raterRole: "system", ratedRole: ratedRoleLabel, value: TIMEOUT_DEFAULT, category: "timeout" },
      connection
    );
    await connection.query(
      side === "buyer" ? "UPDATE transactions SET buyer_rated = 1 WHERE id = ?" : "UPDATE transactions SET seller_rated = 1 WHERE id = ?",
      [tx.id]
    );

    let settle = null;
    if (side === "buyer" && tx.status === "paid" && tx.escrow_locked === 1) {
      settle = await _settleEscrow(tx, connection, { actorId: "system", source: "timeout" });
    }
    const released = !!settle;
    await connection.query("UPDATE transactions SET rating_given = 1 WHERE id = ? AND buyer_rated = 1 AND seller_rated = 1", [tx.id]);
    await connection.commit();

    await logTx("rating", tx.id, { actorId: "system", actorRole: "system", ratedRole: ratedRoleLabel, value: TIMEOUT_DEFAULT, timeout_default: true });
    if (released) await logTx("escrow_settled", tx.id, { actorId: "system", seller: tx.seller_id, amount: settle.sellerNet, gross: Number(tx.amount), fee: settle.fee, trigger: "timeout" });
    if (released && settle.fee > 0) await logTx("platform_fee", tx.id, { actorId: "platform", amount: settle.fee, trigger: "timeout" });
    await sealIfComplete(tx.id);
    return true;
  } catch (e) {
    await connection.rollback();
    console.error("timeout default failed:", e.message);
    return false;
  } finally {
    connection.release();
  }
}

// Sweep for parties whose rating window has elapsed; emit +2 defaults and seal.
// Windows are overridable (ms) for testing.
async function applyRatingTimeouts({ confirmMs = CONFIRM_WINDOW_MS, reviewMs = REVIEW_WINDOW_MS } = {}) {
  let sellers = 0, buyers = 0;

  const [s] = await pool.query(
    `SELECT id FROM transactions
      WHERE status = 'completed' AND seller_rated = 0 AND escrow_released_at IS NOT NULL
        AND escrow_released_at < (NOW() - INTERVAL ? SECOND)
        AND id NOT IN (SELECT transaction_id FROM disputes WHERE status = 'open')`,
    [Math.floor(reviewMs / 1000)]
  );
  for (const t of s) { if (await _defaultRate(t.id, "seller")) sellers++; }

  const [b] = await pool.query(
    `SELECT id FROM transactions
      WHERE status = 'paid' AND escrow_locked = 1 AND buyer_rated = 0
        AND COALESCE(settle_at, created_at) < (NOW() - INTERVAL ? SECOND)
        AND id NOT IN (SELECT transaction_id FROM disputes WHERE status = 'open')`,
    [Math.floor(confirmMs / 1000)]
  );
  for (const t of b) { if (await _defaultRate(t.id, "buyer")) buyers++; }

  return { seller_defaults: sellers, buyer_defaults: buyers };
}

module.exports = {
  createTransactionWithWalletDebit,
  createFromListing,
  createFromPlan,
  createPaymentForTransaction,
  releaseEscrow,
  releaseTranche,
  pingTransaction,
  rateTransaction,
  resolveFlag,
  openDispute,
  resolveDispute,
  sealIfComplete,
  applyRatingTimeouts,
  getAdminStats
};
