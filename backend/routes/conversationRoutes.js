const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const ctrl = require('../controllers/conversation_controller');
const asyncHandler = require('../utils/asyncHandler');
const { writeLimiter } = require('../middleware/rateLimit');

router.use(auth);
router.use(writeLimiter);
router.post('/', asyncHandler(ctrl.create));
router.get('/', asyncHandler(ctrl.list));
router.put('/:id', asyncHandler(ctrl.rename));
router.delete('/:id', asyncHandler(ctrl.remove));
router.post('/:id/pin', asyncHandler(ctrl.pin));

module.exports = router;
