const express = require('express');
const router = express.Router();
const commController = require('../controllers/communication_controller');
const auth = require('../middleware/authMiddleware');
const asyncHandler = require('../utils/asyncHandler');

router.use(auth);
router.post('/:conversationId', asyncHandler(commController.sendMessage));
router.get('/:conversationId', asyncHandler(commController.listMessages));

module.exports = router;
