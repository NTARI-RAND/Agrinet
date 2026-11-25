const express = require('express');
const router = express.Router();
const commController = require('../controllers/communication_controller');
const auth = require('../middleware/chatAuth');
const owner = require('../middleware/conversationOwner');
const asyncHandler = require('../utils/asyncHandler');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const chatRateLimit = require('../middleware/chatRateLimit');
const attemptLimit = rateLimit({
  windowMs: 60 * 1000, limit: 300,
  standardHeaders: 'draft-6', legacyHeaders: false,
  keyGenerator: req => 'ip:' + ipKeyGenerator(req.ip),
  message: { error: 'Too many authentication attempts' }
});
const accountLimit = rateLimit(chatRateLimit.options(120, 'messages'));

router.post('/:conversationId', attemptLimit, auth, accountLimit, asyncHandler(owner), asyncHandler(commController.sendMessage));
router.get('/:conversationId', attemptLimit, auth, accountLimit, asyncHandler(owner), asyncHandler(commController.listMessages));

module.exports = router;
