/**
 * Operator registry + transmission verification (Phase 5).
 *
 * Registering/revoking an operator is a platform (admin) action. Rotating a key is
 * operator-authenticated (you must control the current key set to rotate it).
 */
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const requireAdmin = require('../middleware/requireAdmin');
const { operatorAuth, requireOperator } = require('../middleware/operatorAuth');
const repo = require('../repositories/operatorRepository');
const { verifyTransmission, KEY_SET_SIZE } = require('../lib/operatorKeys');

// Register an operator + its initial public key set (admin).
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, keys } = req.body;
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' });
    if (keys && (!Array.isArray(keys) || keys.length > KEY_SET_SIZE)) {
      return res.status(400).json({ error: `keys must be an array of at most ${KEY_SET_SIZE} public keys` });
    }
    const id = await repo.createOperator(name);
    if (Array.isArray(keys) && keys.length) await repo.addKeys(id, keys);
    res.status(201).json({ id, name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Rotate one key — must be authenticated AS this operator (proves key-set control).
router.post('/:id/rotate', operatorAuth, requireOperator, async (req, res) => {
  try {
    if (req.operator.id !== req.params.id) return res.status(403).json({ error: 'Forbidden' });
    const { key_index, public_key, algo } = req.body;
    if (key_index == null || public_key == null) {
      return res.status(400).json({ error: 'key_index and public_key required' });
    }
    await repo.rotateKey(req.params.id, key_index, public_key, algo);
    res.json({ message: 'Key rotated', key_index });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Revoke an operator (admin).
router.post('/:id/revoke', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await repo.revoke(req.params.id);
    res.json({ message: 'Operator revoked' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Stateless verification of a transmission token (for operator integration/testing).
router.post('/verify', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });
  const result = await verifyTransmission(token, repo.getActiveKeyMap);
  res.status(result.ok ? 200 : 401).json(result);
});

// Demonstrates enforcement: only a valid operator transmission gets through.
router.get('/whoami', operatorAuth, requireOperator, (req, res) => {
  res.json({ operator: req.operator });
});

// Public operator info (no private material).
router.get('/:id', async (req, res) => {
  const op = await repo.getOperator(req.params.id);
  if (!op) return res.status(404).json({ error: 'Operator not found' });
  res.json(op);
});

module.exports = router;
