const express = require('express');
const router = express.Router();
const auth = require('../middleware/chatAuth');
const owner = require('../middleware/conversationOwner');
const ctrl = require('../controllers/conversation_controller');
const asyncHandler = require('../utils/asyncHandler');

router.use(auth, require('../middleware/chatRateLimit')(120));
router.post('/', asyncHandler(ctrl.create));
router.get('/', asyncHandler(ctrl.list));
router.get('/:id/attachments/:name', asyncHandler(owner), asyncHandler(require('../middleware/conversationAttachment')));
router.get('/:id', asyncHandler(owner), ctrl.get);
router.put('/:id', asyncHandler(owner), asyncHandler(ctrl.rename));
router.delete('/:id', asyncHandler(owner), asyncHandler(ctrl.remove));
router.post('/:id/pin', asyncHandler(owner), asyncHandler(ctrl.pin));

module.exports = router;
