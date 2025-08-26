const express = require('express');
const router = express.Router();
const commController = require('../controllers/communication_controller');

router.post('/', commController.sendMessage);
router.get('/:userId', commController.listMessages);

module.exports = router;
