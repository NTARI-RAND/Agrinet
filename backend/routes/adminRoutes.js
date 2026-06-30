const express = require('express');
const client = require("prom-client");
const pool = require('../lib/db');
const { redis } = require("../lib/redis");
const { authenticateToken } = require('../middleware/authMiddleware');
const { logAdminAction } = require('../services/adminAuditService');
const transactionService = require('../services/transactionService');

const router = express.Router();

router.use(authenticateToken);

router.use((req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
});

router.get("/metrics", async (req, res) => {

  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());

});

router.post("/reindex", async (req, res) => {

  console.log("Admin triggered reindex");

  res.json({ message: "Reindex started" });

});

router.post("/cache-clear", async (req, res) => {

  await redis.flushDb();

  res.json({ message: "Cache cleared" });

});

router.get("/stats", async (req, res) => {

  const [[users]] = await pool.query(
    "SELECT COUNT(*) as users_total FROM users"
  );

  const [[activeUsers]] = await pool.query(
    "SELECT COUNT(*) as active_users FROM users WHERE is_blocked = 0"
  );

  const [[listings]] = await pool.query(
    "SELECT COUNT(*) as listings_active FROM listings WHERE status='active'"
  );

  const [[disputes]] = await pool.query(
    "SELECT COUNT(*) as disputes_open FROM disputes WHERE status='open'"
  );

  res.json({
    users_total: users.users_total,
    active_users: activeUsers.active_users,
    listings_active: listings.listings_active,
    disputes_open: disputes.disputes_open
  });

});

router.get("/activity", async (req, res) => {

  const [[transactionsToday]] = await pool.query(
    `
    SELECT COUNT(*) as transactions_today
    FROM transactions
    WHERE created_at >= CURDATE()
    `
  );

  const [[volumeToday]] = await pool.query(
    `
    SELECT IFNULL(SUM(amount),0) as volume_today
    FROM transactions
    WHERE created_at >= CURDATE()
    AND status IN ('paid','completed')
    `
  );

  res.json({
    transactions_today: transactionsToday.transactions_today,
    volume_today: volumeToday.volume_today
  });

});

router.get("/payments", async (req, res) => {

  const [rows] = await pool.query(`
    SELECT
      id,
      user_id,
      amount,
      provider,
      status,
      external_id,
      refunded_amount,
      created_at
    FROM payments
    ORDER BY created_at DESC
    LIMIT 100
  `);

  res.json(rows);

});

router.get("/refunds", async (req, res) => {

  const [rows] = await pool.query(`
    SELECT
      id,
      transaction_id,
      amount,
      reason,
      created_at
    FROM refunds
    ORDER BY created_at DESC
    LIMIT 100
  `);

  res.json(rows);

});

router.get("/wallets", async (req, res) => {

  const [rows] = await pool.query(`
    SELECT
      user_id,
      balance,
      updated_at
    FROM wallets
    ORDER BY balance DESC
    LIMIT 100
  `);

  res.json(rows);

});

router.get("/health", async (req, res) => {

  try {

    await pool.query("SELECT 1");

    res.json({
      status: "ok",
      database: "connected",
      uptime: process.uptime()
    });

  } catch (err) {

    res.status(500).json({
      status: "error",
      database: "down"
    });

  }

});

router.get("/users", async (req, res) => {

  const [rows] = await pool.query(`
    SELECT
      id,
      email,
      reputation_score,
      fraud_score,
      is_blocked,
      block_level,
      trust_level,
      created_at
    FROM users
    ORDER BY created_at DESC
  `);

  res.json(rows);

});

router.get("/users/:id", async (req, res) => {

  const userId = req.params.id;

  const [[user]] = await pool.query(`
    SELECT
      id,
      email,
      reputation_score,
      fraud_score,
      is_blocked,
      block_level,
      trust_level,
      created_at
    FROM users
    WHERE id = ?
  `, [userId]);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json(user);

});

router.post("/users/:id/block", async (req, res) => {

  const userId = req.params.id;

  await pool.query(`
    UPDATE users
    SET
      is_blocked = 1,
      block_level = 'hard'
    WHERE id = ?
  `, [userId]);

  await logAdminAction(
    req.user.id,
    "block_user",
    "user",
    userId
  );

  res.json({ message: "User blocked" });

});

router.post("/users/:id/unblock", async (req, res) => {

  const userId = req.params.id;

  await pool.query(`
    UPDATE users
    SET
      is_blocked = 0,
      block_level = 'none'
    WHERE id = ?
  `, [userId]);

  await logAdminAction(
    req.user.id,
    "unblock_user",
    "user",
    userId
  );

  res.json({ message: "User unblocked" });

});

router.get("/fraud-queue", async (req, res) => {

  const [rows] = await pool.query(`
    SELECT
      fq.id,
      fq.user_id,
      u.email,
      u.fraud_score,
      fq.reason,
      fq.status,
      fq.created_at
    FROM fraud_queue fq
    JOIN users u ON fq.user_id = u.id
    ORDER BY fq.created_at DESC
  `);

  res.json(rows);

});

router.post("/fraud-queue/:id/approve", async (req, res) => {

  const id = req.params.id;

  await pool.query(`
    UPDATE fraud_queue
    SET status='approved', reviewed_at=NOW()
    WHERE id=?
  `, [id]);

  await logAdminAction(
    req.user.id,
    "approve_fraud_review",
    "fraud_queue",
    id
  );

  res.json({ message: "Fraud review approved" });

});

router.post("/fraud-queue/:id/block", async (req, res) => {

  const id = req.params.id;

  const [[item]] = await pool.query(
    "SELECT user_id FROM fraud_queue WHERE id=?",
    [id]
  );

  await pool.query(
    "UPDATE users SET is_blocked=1, block_level='hard' WHERE id=?",
    [item.user_id]
  );

  await pool.query(`
    UPDATE fraud_queue
    SET status='blocked', reviewed_at=NOW()
    WHERE id=?
  `, [id]);

  await logAdminAction(
    req.user.id,
    "block_user_fraud",
    "fraud_queue",
    id,
    { userId: item.user_id }
  );

  res.json({ message: "User blocked due to fraud" });

});

router.post("/fraud-queue/:id/flag", async (req, res) => {

  const id = req.params.id;

  await pool.query(`
    UPDATE fraud_queue
    SET status='flagged', reviewed_at=NOW()
    WHERE id=?
  `, [id]);

  await logAdminAction(
    req.user.id,
    "flag_user_fraud",
    "fraud_queue",
    id
  );

  res.json({ message: "User flagged for monitoring" });

});

router.get("/listings", async (req, res) => {

  const [rows] = await pool.query(`
    SELECT
      id,
      title,
      price,
      city,
      state,
      status,
      moderation_status,
      created_at
    FROM listings
    ORDER BY created_at DESC
  `);

  res.json(rows);

});

router.post("/listings/:id/pause", async (req, res) => {

  const listingId = req.params.id;

  await pool.query(`
    UPDATE listings
    SET status = 'paused'
    WHERE id = ?
  `, [listingId]);

  await logAdminAction(
    req.user.id,
    "pause_listing",
    "listing",
    listingId
  );

  res.json({ message: "Listing paused" });

});

router.post('/listings/:id/remove', async (req, res) => {
  const listingId = req.params.id;

  await pool.query(
    "UPDATE listings SET moderation_status='removed' WHERE id=?",
    [listingId]
  );

  await logAdminAction(
    req.user.id,
    "remove_listing",
    "listing",
    listingId
  );

  res.json({ message: "Listing removed" });
});

router.post("/listings/:id/restore", async (req, res) => {

  const listingId = req.params.id;

  await pool.query(`
    UPDATE listings
    SET moderation_status = 'approved'
    WHERE id = ?
  `, [listingId]);

  await logAdminAction(
    req.user.id,
    "restore_listing",
    "listing",
    listingId
  );

  res.json({ message: "Listing restored" });

});

router.get("/disputes", async (req, res) => {

  const [rows] = await pool.query(`
    SELECT
      id,
      transaction_id,
      opened_by,
      reason,
      status,
      created_at
    FROM disputes
    ORDER BY created_at DESC
  `);

  res.json(rows);

});

router.get("/disputes/:id", async (req, res) => {

  const disputeId = req.params.id;

  const [[dispute]] = await pool.query(`
    SELECT *
    FROM disputes
    WHERE id = ?
  `, [disputeId]);

  if (!dispute) {
    return res.status(404).json({ error: "Dispute not found" });
  }

  res.json(dispute);

});

router.post("/disputes/:id/resolve", async (req, res) => {

  const disputeId = req.params.id;
  const { resolution, voidBuyerRating, voidReason, adminRating } = req.body;

  try {
    // resolveDispute moves the money atomically: 'release' settles escrow to the
    // seller, 'refund' returns the held amount to the buyer. On a bad-faith finding,
    // voidBuyerRating voids the buyer's rating and adminRating issues a replacement.
    const result = await transactionService.resolveDispute(disputeId, resolution, req.user.id, {
      voidBuyerRating: !!voidBuyerRating,
      voidReason,
      adminRating,
    });

    await logAdminAction(
      req.user.id,
      "resolve_dispute",
      "dispute",
      disputeId,
      { resolution, voidBuyerRating: !!voidBuyerRating, transactionId: result.transactionId }
    );

    res.json({ message: "Dispute resolved", resolution });
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }

});

module.exports = router;
