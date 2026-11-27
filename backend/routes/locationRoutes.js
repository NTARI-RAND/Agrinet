const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const requestRateLimit = require('../middleware/requestRateLimit');

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Access-Control-Expose-Headers', 'X-Next-Cursor');
  next();
});

// Update coordinates for a user
const ownerLimit = requestRateLimit();
const accountLimit = requestRateLimit();
router.post('/:id', ownerLimit, locationController.requireOwner, accountLimit, locationController.setLocation);
router.get('/:id', ownerLimit, locationController.requireOwner, accountLimit, locationController.getLocation);

// Retrieve public locations filtered by geofence
router.get('/', locationController.getPublicLocations);

module.exports = router;
