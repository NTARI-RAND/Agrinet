const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const depositController = require('../controllers/deposit_controller');
const asyncHandler = require('../utils/asyncHandler');
const { writeLimiter } = require('../middleware/rateLimit');

// All routes are protected and rate limited: every handler moves funds
// or reads transaction history.
router.use(authMiddleware);
router.use(writeLimiter);

// Get or create user deposit account
router.get('/', asyncHandler(depositController.getOrCreateAccount));

// Fund account
router.post('/fund', asyncHandler(depositController.fundAccount));

// Withdraw from account
router.post('/withdraw', asyncHandler(depositController.withdrawAccount));

// Get transaction history
router.get('/history', asyncHandler(depositController.getTransactionHistory));

module.exports = router;
