const express = require('express');
const { randomUUID } = require('node:crypto');
const bcrypt = require('../utils/bcrypt');
const router = express.Router();
const docClient = require('../lib/dynamodbClient');
const { USER_TABLE_NAME, createUserItem, sanitizeUserForPublic } = require('../models/user');
const requireAdmin = require('../middleware/requireAdmin');
const { userWriteRateLimit } = require('../middleware/rateLimit');

const account = require('../middleware/chatAuth');
const requestRateLimit = require('../middleware/requestRateLimit');
const { collectionPage, scanPage, pageError } = require('../lib/collectionPage');

// GET /users - bounded directory, never account or private location records
router.get('/', requestRateLimit(), account, requestRateLimit(), async (req, res) => {
  try {
    for (const name of ['role', 'location', 'locationType']) {
      if (req.query[name] !== undefined && typeof req.query[name] !== 'string') {
        return res.status(400).json({ error: 'Filters must be single strings' });
      }
    }
    const page = collectionPage(req.query, ['users', req.user.userId, req.query.role || '', req.query.location || '', req.query.locationType || '']);
    const params = {
      TableName: USER_TABLE_NAME,
      ProjectionExpression: '#id, #username, #role, #location, #privacy, #locationType',
      ExpressionAttributeNames: { '#id': 'id', '#username': 'username', '#role': 'role', '#location': 'location', '#privacy': 'locationPrivacy', '#locationType': 'locationType' },
    };

    const filters = [];
    const values = {};
    if (req.query.role) {
      filters.push('#role = :role');
      values[':role'] = req.query.role;
    }
    if (req.query.locationType) {
      filters.push('#locationType = :locationType');
      values[':locationType'] = req.query.locationType;
    }
    if (req.query.location) {
      filters.push('#location = :location AND #privacy = :public');
      values[':location'] = req.query.location;
      values[':public'] = true;
    }
    if (filters.length) {
      params.FilterExpression = filters.join(' AND ');
      params.ExpressionAttributeValues = values;
    }

    const { items, next } = await scanPage(docClient, params, page.limit, page.state?.start);
    // Preserve structural discovery (including locationType), not scalar ranking:
    // CLAUDE.md requires full reputation distributions, never a single score.
    // Exact coordinates/contact fields stay private; coarse location is opt-in.
    const users = items.map(item => ({
      ...(typeof item.id === 'string' && { id: item.id }),
      ...(typeof item.username === 'string' && { username: item.username }),
      ...(typeof item.locationType === 'string' && { locationType: item.locationType }),
      ...(typeof item.role === 'string' && { role: item.role }),
      ...(item.locationPrivacy === true && typeof item.location === 'string' && { location: item.location }),
    }));
    page.finish(res, next && { start: next });
    res.json(users);
  } catch (err) {
    pageError(res, err, 'Failed to fetch users');
  }
});

// Administrative provisioning only. Public registration remains /api/auth/register.
router.post('/', userWriteRateLimit, requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    if (Object.prototype.hasOwnProperty.call(body, 'id')) {
      return res.status(400).json({ error: 'Client-supplied user ids are not allowed' });
    }

    const allowed = ['username', 'email', 'phone', 'password', 'locationType', 'locationPrivacy', 'role'];
    const unexpected = Object.keys(body).filter(key => !allowed.includes(key));
    if (unexpected.length) {
      return res.status(400).json({ error: 'Unsupported user fields', fields: unexpected });
    }

    const { username, email, phone, password, locationType, locationPrivacy, role } = body;
    if (typeof username !== 'string' || !username.trim() ||
        typeof email !== 'string' || !email.trim() ||
        typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Username, email, and a password of at least 8 characters are required' });
    }
    if (locationPrivacy !== undefined && typeof locationPrivacy !== 'boolean') {
      return res.status(400).json({ error: 'locationPrivacy must be a boolean' });
    }
    if (locationType !== undefined && !['farm', 'production', 'delivery'].includes(locationType)) {
      return res.status(400).json({ error: 'Invalid locationType' });
    }
    if (role !== undefined && !['consumer', 'producer', 'farmer', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const item = createUserItem({
      id: randomUUID(),
      username: username.trim(),
      email: email.trim().toLowerCase(),
      ...(typeof phone === 'string' ? { phone } : {}),
      ...(locationType ? { locationType } : {}),
      ...(locationPrivacy !== undefined ? { locationPrivacy } : {}),
      role: role || 'consumer',
      password: await bcrypt.hash(password, 10),
      verified: false,
      reputationScore: 0,
      reputationWeight: 0
    });

    await docClient.put({
      TableName: USER_TABLE_NAME,
      Item: item,
      ConditionExpression: 'attribute_not_exists(#id)',
      ExpressionAttributeNames: { '#id': 'id' }
    }).promise();

    return res.status(201).json({
      message: 'User created',
      user: sanitizeUserForPublic(item)
    });
  } catch (err) {
    if (err.code === 'ConditionalCheckFailedException') {
      return res.status(409).json({ error: 'User already exists' });
    }
    if (err.code === 'ValidationException') {
      return res.status(400).json({ error: 'Invalid user data' });
    }
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

module.exports = router;
