/**
 * LBTAS rating API (Phase 3).
 *
 * Submitting a rating and reviewing accumulated records are DISTINCT capabilities,
 * authorized separately. Reads of raw records fail closed. Reputation distributions
 * (counts only — no comments, no rater identities) are the public trust signal.
 */
const express = require('express');
const pool = require('../lib/db');
const { authenticateToken, optionalAuth } = require('../middleware/authMiddleware');
const requireAdmin = require('../middleware/requireAdmin');
const { userRateLimiter, strictWriteLimiter } = require('../middlewares/rateLimiters');
const repo = require('../repositories/ratingRepository');
const lbtas = require('../services/lbtas');
const transactionService = require('../services/transactionService');

const router = express.Router();

/* ── GET /ratings/scale — the LBTAS scale, for rendering the rating UI (public) ── */
router.get('/scale', (req, res) => {
  res.json({
    levels: lbtas.scale(),
    min: lbtas.RATING_MIN,
    max: lbtas.RATING_MAX,
    comment_required_at: -1,
    max_comment_words: lbtas.MAX_COMMENT_WORDS,
  });
});

/* ── GET /ratings/me — the caller's own reputation distribution ── */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    res.json(await repo.getUserReputation(req.user.id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── GET /ratings/me/pending — transactions the caller can still rate (prompt feed) ── */
router.get('/me/pending', authenticateToken, async (req, res) => {
  try {
    res.json({ pending: await repo.pendingForUser(req.user.id) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── GET /ratings/users/:id — a user's public reputation distribution (counts only) ── */
router.get('/users/:id', optionalAuth, async (req, res) => {
  try {
    res.json(await repo.getUserReputation(req.params.id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── POST /ratings/transactions/:id — submit a rating (bidirectional; -1 needs a comment) ── */
router.post('/transactions/:id', authenticateToken, userRateLimiter, strictWriteLimiter, async (req, res) => {
  try {
    const { rating, value, comment, category } = req.body;
    const result = await transactionService.rateTransaction(
      req.params.id,
      rating != null ? rating : value,
      req.user.id,
      { comment, category }
    );
    res.json(result);
  } catch (e) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

/* ── GET /ratings/transactions/:id — review a transaction's ratings (parties or admin) ── */
router.get('/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT buyer_id, seller_id FROM transactions WHERE id = ?', [req.params.id]);
    const tx = rows[0];
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    const isAdmin = req.user.role === 'admin';
    const isParty = tx.buyer_id === req.user.id || tx.seller_id === req.user.id;
    if (!isAdmin && !isParty) return res.status(403).json({ error: 'Forbidden' });

    let events = await repo.getTransactionRatings(req.params.id);
    // A -1 comment is a justification against a party; only its author and admins read it.
    if (!isAdmin) {
      events = events.map((e) => (e.rater_user_id === req.user.id ? e : { ...e, comment: undefined }));
    }
    res.json({ ratings: events });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── GET /ratings/report — full system report (admin only) ── */
router.get('/report', authenticateToken, requireAdmin, async (req, res) => {
  try {
    res.json(await repo.generateReport());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── GET /ratings/harm-flagged — users with one or more -1 (admin only) ── */
router.get('/harm-flagged', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const report = await repo.generateReport();
    res.json({ harm_flagged: report.harm_flagged });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
