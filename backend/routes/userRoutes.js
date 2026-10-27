const express = require('express');
const bcrypt = require('../utils/bcrypt');
const router = express.Router();
const docClient = require('../lib/dynamodbClient');
const { USER_TABLE_NAME, createUserItem } = require('../models/user');
const account = require('../middleware/chatAuth');
const { collectionPage, scanPage, pageError } = require('../lib/collectionPage');

// GET /users - bounded directory, never account or private location records
router.get('/', account, async (req, res) => {
  try {
    for (const name of ['role', 'location']) {
      if (req.query[name] !== undefined && typeof req.query[name] !== 'string') {
        return res.status(400).json({ error: 'Filters must be single strings' });
      }
    }
    const page = collectionPage(req.query, ['users', req.user.userId, req.query.role || '', req.query.location || '']);
    const params = {
      TableName: USER_TABLE_NAME,
      ProjectionExpression: '#id, #username, #role, #location, #privacy',
      ExpressionAttributeNames: { '#id': 'id', '#username': 'username', '#role': 'role', '#location': 'location', '#privacy': 'locationPrivacy' },
    };

    const filters = [];
    const values = {};
    if (req.query.role) {
      filters.push('#role = :role');
      values[':role'] = req.query.role;
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
    const users = items.map(item => ({
      ...(typeof item.id === 'string' && { id: item.id }),
      ...(typeof item.username === 'string' && { username: item.username }),
      ...(typeof item.role === 'string' && { role: item.role }),
      ...(item.locationPrivacy === true && typeof item.location === 'string' && { location: item.location }),
    }));
    page.finish(res, next && { start: next });
    res.json(users);
  } catch (err) {
    pageError(res, err, 'Failed to fetch users');
  }
});

// POST /users - create a new user
router.post('/', async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const item = createUserItem({
      ...rest,
      password: hashedPassword,
      verified: false,
      reputationScore: 0
    });
    await docClient.put({ TableName: USER_TABLE_NAME, Item: item }).promise();
    const { password: _pwd, ...user } = item;
    res.status(201).json({ message: 'User created', user });
  } catch (err) {
    // Log the error for debugging
    console.error('Error creating user:', err);
    // Provide more specific error information if available
    if (err.code === 'ValidationException') {
      return res.status(400).json({ error: 'Validation error', details: err.message });
    }
    res.status(500).json({ error: err.message || 'Failed to create user' });
  }
});

module.exports = router;

