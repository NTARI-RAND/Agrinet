const express = require('express');
const router = express.Router();
const commController = require('../controllers/communication_controller');
const auth = require('../middleware/authMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  keyGenerator: req => req.user?.userId ? 'account:' + req.user.userId : 'ip:' + ipKeyGenerator(req.ip),
  message: { error: 'Too many requests, please try again later' }
});
router.use(auth, chatLimiter);
router.post('/:conversationId', asyncHandler(commController.sendMessage));
router.get('/:conversationId', asyncHandler(commController.listMessages));

module.exports = router;
