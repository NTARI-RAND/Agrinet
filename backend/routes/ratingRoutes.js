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

/* ── GET /ratings/me/received — harm ratings (-1) made against the caller (contest surface) ── */
router.get('/me/received', authenticateToken, async (req, res) => {
  try {
    res.json({ received: await repo.receivedHarm(req.user.id) });
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

    const events = await repo.getTransactionRatings(req.params.id);
    // The narrative is operator-local (V3): attach it only for the adjudicator (admin)
    // or the rating's author; everyone else gets the event without it.
    const withNarrative = await Promise.all(events.map(async (e) => {
      const mayRead = isAdmin || e.rater_user_id === req.user.id;
      return mayRead ? { ...e, narrative: await repo.getNarrative(e.id) } : e;
    }));
    res.json({ ratings: withNarrative });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── POST /ratings/:id/contest — the rated party contests a harm rating (either direction) ── */
router.post('/:id/contest', authenticateToken, userRateLimiter, async (req, res) => {
  try {
    const n = await repo.contestRating(req.params.id, req.user.id, req.body.reason);
    if (!n) return res.status(403).json({ error: 'Not a standing rating against you to contest' });
    res.json({ message: 'Rating contested — an adjudicator can review it' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── POST /ratings/:id/dismiss — adjudicator dismisses a rating (annotated, not erased) ── */
router.post('/:id/dismiss', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const n = await repo.voidById(req.params.id, req.user.id, req.body.reason || 'dismissed by adjudicator');
    if (!n) return res.status(404).json({ error: 'Rating not found or already dismissed' });
    res.json({ message: 'Rating dismissed; the dismissal is recorded and remains visible' });
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
