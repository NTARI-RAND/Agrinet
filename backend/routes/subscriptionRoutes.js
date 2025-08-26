const express = require('express');
const router = express.Router();
const subController = require('../controllers/subscription_controller');

router.post('/', subController.createSubscription);
router.get('/:userId', subController.listSubscriptions);

module.exports = router;
