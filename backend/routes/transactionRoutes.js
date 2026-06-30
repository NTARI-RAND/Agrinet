const express = require('express');
const pool = require('../lib/db');
const transactionService = require('../services/transactionService');
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

module.exports = router;
