const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const ctrl = require('../controllers/conversation_controller');
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
router.post('/', asyncHandler(ctrl.create));
router.get('/', asyncHandler(ctrl.list));
router.put('/:id', asyncHandler(ctrl.rename));
router.delete('/:id', asyncHandler(ctrl.remove));
router.post('/:id/pin', asyncHandler(ctrl.pin));

module.exports = router;
