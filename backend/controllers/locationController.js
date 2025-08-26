const User = require('../models/user');
const { parseAgriNet, validateCoords, isWithinGeofence } = require('../utils/geo');

// Store coordinates for a user using AgriNet format
exports.setLocation = async (req, res) => {
  try {
    const { coordinates, locationType, privacy } = req.body;
    const { lat, long } = parseAgriNet(coordinates);
    validateCoords(lat, long);

    const allowedTypes = ['farm', 'production', 'delivery'];
    if (locationType && !allowedTypes.includes(locationType)) {
      throw new Error('Invalid location type');
    }

    const update = {
      coordinates: { lat, long },
      locationType,
      locationPrivacy: !!privacy
    };

    // Update user record; implementation depends on DB layer
    if (User.findByIdAndUpdate) {
      await User.findByIdAndUpdate(req.params.id, update, { new: true });
    }

    res.json({ message: 'Location saved', coordinates: update.coordinates });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Retrieve public locations within a geofence for marketplace discovery
exports.getPublicLocations = async (req, res) => {
  try {
    const { lat, long, radius, type } = req.query;
    const geofence = {
      lat: parseFloat(lat),
      long: parseFloat(long),
      radius: parseFloat(radius)
    };
    if (isNaN(geofence.lat) || isNaN(geofence.long) || isNaN(geofence.radius)) {
      throw new Error('Invalid geofence parameters');
    }

    let users = [];
    if (User.find) {
      const query = { locationPrivacy: true };
      if (type) query.locationType = type;
      users = await User.find(query, '-password');
    }

    const filtered = users.filter(u => u.coordinates && isWithinGeofence(u.coordinates, geofence));
    res.json(filtered);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
