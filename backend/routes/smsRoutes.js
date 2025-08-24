const express = require('express');
const { handleIncomingSMS, handleStatusCallback } = require('../controllers/smsController');

const router = express.Router();

router.post('/incoming', handleIncomingSMS);
router.post('/status', handleStatusCallback);

module.exports = router;
