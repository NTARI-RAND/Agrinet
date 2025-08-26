const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order_controller');

router.post('/:userId/checkout', orderController.checkout);
router.get('/:userId', orderController.listOrders);

module.exports = router;
