const jwt = require('jsonwebtoken');
const docClient = require('../lib/dynamodbClient');
const { LOCATION_TABLE_NAME, publicLocation, encodeCursor, decodeCursor } = require('../models/location');
const { parseAgriNet, validateCoords, isWithinGeofence } = require('../utils/geo');
const allowedTypes = ['farm', 'production', 'delivery'];

function invalid(message) { return Object.assign(new Error(message), { status: 400 }); }
function fail(res, err) {
  return res.status(err.status || 500).json({ error: err.status ? err.message : 'Location storage unavailable' });
}

// General API-key authentication does not establish an account owner.
exports.requireOwner = (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) throw new Error('Missing token');
    const owner = jwt.verify(header.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof owner.userId !== 'string' || !owner.userId) throw new Error('Missing account');
    if (owner.userId !== req.params.id) return res.status(403).json({ error: 'Location belongs to another account' });
    next();
  } catch {
    return res.status(401).json({ error: 'A valid account token is required' });
  }
};

exports.setLocation = async (req, res) => {
  try {
    const { coordinates, locationType, privacy } = req.body || {};
    if (typeof coordinates !== 'string') throw invalid('Coordinates must use AgriNet format');
    if (typeof privacy !== 'boolean') throw invalid('privacy must explicitly be true (shared) or false (private)');
    if (locationType !== undefined && !allowedTypes.includes(locationType)) throw invalid('Invalid location type');
    let parsed;
    try { parsed = parseAgriNet(coordinates); validateCoords(parsed.lat, parsed.long); }
    catch (err) { throw invalid(err.message); }
    const item = { id: req.params.id, coordinates: parsed, privacy,
      ...(locationType === undefined ? {} : { locationType }) };
    await docClient.put({ TableName: LOCATION_TABLE_NAME, Item: item }).promise();
    res.json({ message: 'Location saved', ...item });
  } catch (err) { fail(res, err); }
};

exports.getLocation = async (req, res) => {
  try {
    const { Item } = await docClient.get({ TableName: LOCATION_TABLE_NAME, Key: { id: req.params.id }, ConsistentRead: true }).promise();
    if (!Item) return res.status(404).json({ error: 'Location not found' });
    res.json({ ...publicLocation(Item), privacy: Item.privacy === true });
  } catch (err) { fail(res, err); }
};

function number(value) {
  if (typeof value !== 'string' || !/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isFinite(Number(value))) {
    throw invalid('Invalid geofence parameters');
  }
  return Number(value);
}

exports.getPublicLocations = async (req, res) => {
  try {
    const geofence = { lat: number(req.query.lat), long: number(req.query.long), radius: number(req.query.radius) };
    try { validateCoords(geofence.lat, geofence.long); } catch (err) { throw invalid(err.message); }
    if (geofence.radius < 0) throw invalid('Radius must be non-negative kilometres');
    const type = req.query.type;
    if (type !== undefined && !allowedTypes.includes(type)) throw invalid('Invalid location type');
    const scope = JSON.stringify({ ...geofence, type: type || null });
    let start;
    if (req.query.cursor !== undefined) {
      try { start = decodeCursor(req.query.cursor, scope); } catch { throw invalid('Invalid location cursor'); }
    }
    const page = await docClient.scan({ TableName: LOCATION_TABLE_NAME, Limit: 100, ConsistentRead: true,
      ProjectionExpression: 'id, coordinates, locationType, privacy',
      ...(start ? { ExclusiveStartKey: start } : {}) }).promise();
    // Do not rely on client-supplied filters or include complete user records.
    const found = (page.Items || []).filter(item => {
      if (item.privacy !== true || (type && item.locationType !== type)) return false;
      try { validateCoords(item.coordinates?.lat, item.coordinates?.long); } catch { return false; }
      return isWithinGeofence(item.coordinates, geofence);
    }).map(publicLocation);
    if (page.LastEvaluatedKey) res.set('X-Next-Cursor', encodeCursor(page.LastEvaluatedKey, scope));
    res.json(found);
  } catch (err) { fail(res, err); }
};
