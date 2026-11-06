const express = require('express');
const router = express.Router();
const commController = require('../controllers/communication_controller');
const auth = require('../middleware/chatAuth');
const owner = require('../middleware/conversationOwner');
const asyncHandler = require('../utils/asyncHandler');
const requestRateLimit = require('../middleware/requestRateLimit');

router.use(requestRateLimit(), auth, requestRateLimit());
router.post('/:conversationId', asyncHandler(owner), asyncHandler(commController.sendMessage));
router.get('/:conversationId', asyncHandler(owner), asyncHandler(commController.listMessages));

module.exports = router;
