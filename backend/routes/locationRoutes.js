const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Access-Control-Expose-Headers', 'X-Next-Cursor');
  next();
});

// Update coordinates for a user
router.post('/:id', locationController.requireOwner, locationController.setLocation);
router.get('/:id', locationController.requireOwner, locationController.getLocation);

// Retrieve public locations filtered by geofence
router.get('/', locationController.getPublicLocations);

module.exports = router;
