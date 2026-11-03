const express = require('express');
const { randomUUID } = require('node:crypto');
const bcrypt = require('../utils/bcrypt');
const router = express.Router();
const docClient = require('../lib/dynamodbClient');
const { USER_TABLE_NAME, createUserItem, sanitizeUserForPublic } = require('../models/user');
const requireAdmin = require('../middleware/requireAdmin');
const { userWriteRateLimit } = require('../middleware/rateLimit');

// GET /users is a public directory, not an account export.
router.get('/', async (req, res) => {
  try {
    const params = {
      TableName: USER_TABLE_NAME,
      ProjectionExpression: '#id, username, locationType, reputationScore, reputationWeight',
      ExpressionAttributeNames: { '#id': 'id' }
    };
    if (req.query.locationType) {
      params.FilterExpression = 'locationType = :locationType';
      params.ExpressionAttributeValues = { ':locationType': req.query.locationType };
    }
    const data = await docClient.scan(params).promise();
    res.json((data.Items || []).map(sanitizeUserForPublic));
  } catch {
    res.status(500).json({ error: 'Failed to fetch users' });
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
        typeof password !== 'string' || password.length < 12) {
      return res.status(400).json({ error: 'Username, email, and a password of at least 12 characters are required' });
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
