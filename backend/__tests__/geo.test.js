const test = require('node:test');
const assert = require('assert');
const { parseAgriNet, validateCoords, formatAgriNet, isWithinGeofence } = require('../utils/geo');

test('parseAgriNet parses AgriNet format string', () => {
  const coords = parseAgriNet('geoLat_17.18113,geoLong_48.11553');
  assert.strictEqual(coords.lat, 17.18113);
  assert.strictEqual(coords.long, 48.11553);
});

test('validateCoords throws on invalid range', () => {
  assert.throws(() => validateCoords(100, 0));
  assert.throws(() => validateCoords(0, 200));
});

test('formatAgriNet outputs correct string', () => {
  const str = formatAgriNet(17.18113, 48.11553);
  assert.strictEqual(str, 'geoLat_17.18113,geoLong_48.11553');
});

test('isWithinGeofence detects proximity', () => {
  const center = { lat: 17.18113, long: 48.11553 };
  const near = { lat: 17.18113, long: 48.11553 };
  const far = { lat: 0, long: 0 };
  assert.ok(isWithinGeofence(near, { ...center, radius: 1 }));
  assert.ok(!isWithinGeofence(far, { ...center, radius: 1 }));
});
