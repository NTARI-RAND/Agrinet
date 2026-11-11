const express = require('express');
const router = express.Router();
const commController = require('../controllers/communication_controller');
const auth = require('../middleware/chatAuth');
const owner = require('../middleware/conversationOwner');
const asyncHandler = require('../utils/asyncHandler');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

router.use(require('../middleware/requestRateLimit')());

router.post('/:conversationId', rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  keyGenerator: req => 'ip:' + ipKeyGenerator(req.ip),
  message: { error: 'Too many authentication attempts' }
}), auth, rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  keyGenerator: req => req.user?.userId
    ? 'account:' + req.user.userId
    : 'ip:' + ipKeyGenerator(req.ip),
  message: { error: 'Too many requests, please try again later' }
}), require('../middleware/requestRateLimit')(), asyncHandler(owner), asyncHandler(commController.sendMessage));
router.get('/:conversationId', rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  keyGenerator: req => 'ip:' + ipKeyGenerator(req.ip),
  message: { error: 'Too many authentication attempts' }
}), auth, rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  keyGenerator: req => req.user?.userId
    ? 'account:' + req.user.userId
    : 'ip:' + ipKeyGenerator(req.ip),
  message: { error: 'Too many requests, please try again later' }
}), require('../middleware/requestRateLimit')(), asyncHandler(owner), asyncHandler(commController.listMessages));

module.exports = router;
