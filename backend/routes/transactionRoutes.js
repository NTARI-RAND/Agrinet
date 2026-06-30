const express = require('express');
const pool = require('../lib/db');
const transactionService = require('../services/transactionService');
const contractService = require('../services/contractService');
const { authenticateToken } = require('../middleware/authMiddleware');
const { strictWriteLimiter, userRateLimiter } = require('../middlewares/rateLimiters');

const router = express.Router();

router.use(authenticateToken);

router.get('/', async (req, res) => {

  const userId = req.user.id;

  const [rows] = await pool.query(
    `
    SELECT *
    FROM transactions
    WHERE buyer_id = ?
       OR seller_id = ?
    ORDER BY created_at DESC
    `,
    [userId, userId]
  );

  res.json(rows);

});

router.post('/from-listing', userRateLimiter, strictWriteLimiter, async (req, res) => {
  try {
    const { listingId, quantity } = req.body;

    if (!listingId || typeof listingId !== "string") {
      return res.status(400).json({ error: "Invalid listingId" });
    }

    if (typeof quantity !== "number" || quantity <= 0) {
      return res.status(400).json({ error: "Invalid quantity" });
    }

    const result = await transactionService.createFromListing({
      listingId,
      buyerId: req.user.id,
      quantity
    });

    return res.status(201).json(result);

  } catch (err) {
    return res.status(err.statusCode || 400).json({
      error: err.message,
      ...(err.origin_node ? { origin_node: err.origin_node } : {})
    });
  }
});

router.post('/from-plan', userRateLimiter, strictWriteLimiter, async (req, res) => {
  try {
    const { planId, quantity } = req.body;

    if (!planId || typeof planId !== "string") {
      return res.status(400).json({ error: "Invalid planId" });
    }

    if (typeof quantity !== "number" || quantity <= 0) {
      return res.status(400).json({ error: "Invalid quantity" });
    }

    const result = await transactionService.createFromPlan({
      planId,
      actorId: req.user.id,
      quantity
    });

    return res.status(201).json(result);

  } catch (err) {
    return res.status(err.statusCode || 400).json({
      error: err.message,
      ...(err.origin_node ? { origin_node: err.origin_node } : {})
    });
  }
});

router.post('/:id/pay', userRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Invalid transaction id" });
    }

    const result = await transactionService.createPaymentForTransaction(
      req.params.id
    );

    return res.json(result);

  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/:id/release', userRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Invalid transaction id" });
    }

    const result = await transactionService.releaseEscrow(
      req.params.id,
      req.user.id
    );

    return res.json(result);

  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/:id/dispute', userRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Invalid transaction id" });
    }

    const { reason } = req.body;

    if (!reason || typeof reason !== "string") {
      return res.status(400).json({ error: 'Reason is required' });
    }

    const result = await transactionService.openDispute(
      req.params.id,
      req.user.id,
      reason
    );

    return res.status(201).json(result);

  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/* ── PING reporting + contract transfer (Phase 4) ── */

// Schedule + posted PING reports for a contract (current buyer, seller, or admin).
router.get('/:id/pings', async (req, res) => {
  try {
    const result = await contractService.getContractPings(req.params.id, req.user.id, req.user.role === 'admin');
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

// Seller posts a PING progress update (note + optional media URLs).
router.post('/:id/pings', userRateLimiter, strictWriteLimiter, async (req, res) => {
  try {
    const { note, media } = req.body;
    const result = await contractService.addPingReport({
      transactionId: req.params.id,
      authorId: req.user.id,
      note,
      media,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

// Transfer (sell) a live contract position to a new buyer at a negotiated price.
router.post('/:id/transfer', userRateLimiter, strictWriteLimiter, async (req, res) => {
  try {
    const { toEmail, price } = req.body;
    const result = await contractService.transferContract({
      transactionId: req.params.id,
      fromUserId: req.user.id,
      toEmail,
      price,
    });
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

module.exports = router;
