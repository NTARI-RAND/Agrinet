/**
 * Mycelium ledger reads (Phase 5).
 *
 * The full chain + integrity check are admin-only. A transaction's own entries are
 * visible to its parties (buyer/seller) or an admin — fail closed otherwise.
 */
const express = require('express');
const router = express.Router();
const pool = require('../lib/db');
const { authenticateToken } = require('../middleware/authMiddleware');
const requireAdmin = require('../middleware/requireAdmin');
const mycelium = require('../services/myceliumService');

router.use(authenticateToken);

// Chain integrity check (admin).
router.get('/verify', requireAdmin, async (req, res) => {
  try { res.json(await mycelium.verifyChain()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// The immutable record for one transaction (its parties or an admin).
router.get('/transaction/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT buyer_id, seller_id FROM transactions WHERE id = ?', [req.params.id]);
    const tx = rows[0];
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    const isParty = tx.buyer_id === req.user.id || tx.seller_id === req.user.id;
    if (!isParty && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    res.json(await mycelium.forDialog(req.params.id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Recent sealed/annotation anchors (admin).
router.get('/', requireAdmin, async (req, res) => {
  try { res.json({ anchors: await mycelium.listAnchors(req.query.limit) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
