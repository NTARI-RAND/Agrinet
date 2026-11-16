const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cart_controller');

const requireAccountOwner = require('../middleware/requireAccountOwner');

router.use('/:userId', requireAccountOwner);

router.get('/:userId', cartController.getCart);
router.post('/:userId', cartController.addItem);
router.delete('/:userId/:itemId', cartController.removeItem);
router.delete('/:userId', cartController.clearCart);

module.exports = router;
