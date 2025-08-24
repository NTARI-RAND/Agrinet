const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');

// Update coordinates for a user
router.post('/:id', locationController.setLocation);

// Retrieve public locations filtered by geofence
router.get('/', locationController.getPublicLocations);

module.exports = router;
