const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const depositController = require('../controllers/deposit_controller');
const asyncHandler = require('../utils/asyncHandler');

// All routes are protected
router.use(authMiddleware);

const asyncHandler = fn => (req, res) => {
  Promise.resolve(fn(req, res)).catch(err => {
    console.error('DynamoDB error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });
};

// Get or create user deposit account
router.get('/', asyncHandler(depositController.getOrCreateAccount));

// Fund account
router.post('/fund', asyncHandler(depositController.fundAccount));

// Withdraw from account
router.post('/withdraw', asyncHandler(depositController.withdrawAccount));

// Get transaction history
router.get('/history', asyncHandler(depositController.getTransactionHistory));

module.exports = router;
