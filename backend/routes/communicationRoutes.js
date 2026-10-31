const express = require('express');
const router = express.Router();
const commController = require('../controllers/communication_controller');
const auth = require('../middleware/chatAuth');
const owner = require('../middleware/conversationOwner');
const asyncHandler = require('../utils/asyncHandler');

router.use(auth);
router.post('/:conversationId', asyncHandler(owner), asyncHandler(commController.sendMessage));
router.get('/:conversationId', asyncHandler(owner), asyncHandler(commController.listMessages));

module.exports = router;
