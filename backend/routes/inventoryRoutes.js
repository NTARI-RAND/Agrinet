const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory_controller');
const asyncHandler = require('../utils/asyncHandler');

router.get('/', asyncHandler(inventoryController.getInventory));
router.post('/', asyncHandler(inventoryController.createInventory));
router.put('/:id/stock', asyncHandler(inventoryController.updateStock));
router.put('/:id/price', asyncHandler(inventoryController.updatePrice));
router.post('/sync', asyncHandler(inventoryController.syncExternal));

module.exports = router;
