const express = require('express');
const router = express.Router();
const auth = require('../middleware/chatAuth');
const owner = require('../middleware/conversationOwner');
const ctrl = require('../controllers/conversation_controller');
const asyncHandler = require('../utils/asyncHandler');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const chatRateLimit = require('../middleware/chatRateLimit');
const attemptLimit = rateLimit({
  windowMs: 60 * 1000, limit: 300,
  standardHeaders: 'draft-6', legacyHeaders: false,
  keyGenerator: req => 'ip:' + ipKeyGenerator(req.ip),
  message: { error: 'Too many authentication attempts' }
});
const accountLimit = rateLimit(chatRateLimit.options(120, 'conversations'));

router.post('/', attemptLimit, auth, accountLimit, asyncHandler(ctrl.create));
router.get('/', attemptLimit, auth, accountLimit, asyncHandler(ctrl.list));
router.get('/:id/attachments/:name', attemptLimit, auth, accountLimit, asyncHandler(owner), asyncHandler(require('../middleware/conversationAttachment')));
router.get('/:id', attemptLimit, auth, accountLimit, asyncHandler(owner), ctrl.get);
router.put('/:id', attemptLimit, auth, accountLimit, asyncHandler(owner), asyncHandler(ctrl.rename));
router.delete('/:id', attemptLimit, auth, accountLimit, asyncHandler(owner), asyncHandler(ctrl.remove));
router.post('/:id/pin', attemptLimit, auth, accountLimit, asyncHandler(owner), asyncHandler(ctrl.pin));

module.exports = router;
