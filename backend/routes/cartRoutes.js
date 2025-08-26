const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cart_controller');

router.get('/:userId', cartController.getCart);
router.post('/:userId', cartController.addItem);
router.delete('/:userId/:itemId', cartController.removeItem);
router.delete('/:userId', cartController.clearCart);

module.exports = router;
