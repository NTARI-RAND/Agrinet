const express = require('express');
const router = express.Router();
const commController = require('../controllers/communication_controller');
const auth = require('../middleware/chatAuth');
const owner = require('../middleware/conversationOwner');
const asyncHandler = require('../utils/asyncHandler');

router.use(auth, require('../middleware/chatRateLimit')(120));
router.post('/:conversationId', asyncHandler(owner), asyncHandler(commController.sendMessage));
router.get('/:conversationId', asyncHandler(owner), asyncHandler(commController.listMessages));

module.exports = router;
