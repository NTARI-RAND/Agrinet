const AGRI_NET_REGEX = /^geoLat_(-?\d+\.\d+),geoLong_(-?\d+\.\d+)$/;

function parseAgriNet(str) {
  const match = AGRI_NET_REGEX.exec(str);
  if (!match) {
    throw new Error('Invalid AgriNet coordinate format');
  }
  return { lat: parseFloat(match[1]), long: parseFloat(match[2]) };
}

function validateCoords(lat, long) {
  if (typeof lat !== 'number' || typeof long !== 'number' || isNaN(lat) || isNaN(long)) {
    throw new Error('Coordinates must be numbers');
  }
  if (lat < -90 || lat > 90) {
    throw new Error('Latitude out of range');
  }
  if (long < -180 || long > 180) {
    throw new Error('Longitude out of range');
  }
  return true;
}

function formatAgriNet(lat, long) {
  validateCoords(lat, long);
  return `geoLat_${lat.toFixed(5)},geoLong_${long.toFixed(5)}`;
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function distanceKm(a, b) {
  const R = 6371; // Earth radius in km
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.long - a.long);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const hav = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
  return R * c;
}

function isWithinGeofence(coord, geofence) {
  const dist = distanceKm(coord, { lat: geofence.lat, long: geofence.long });
  return dist <= geofence.radius;
}

module.exports = {
  parseAgriNet,
  validateCoords,
  formatAgriNet,
  isWithinGeofence
};
