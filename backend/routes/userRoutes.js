const express = require('express');
const bcrypt = require('../utils/bcrypt');
const router = express.Router();
const docClient = require('../lib/dynamodbClient');
const { USER_TABLE_NAME, createUserItem } = require('../models/user');
const { normalizeEmail, createUserWithEmail } = require('../models/userEmail');

// GET /users - fetch all users, omit sensitive data
router.get('/', async (req, res) => {
  const params = {
    TableName: USER_TABLE_NAME
  };

  const filters = [];
  const values = {};
  if (req.query.role) {
    filters.push('role = :role');
    values[':role'] = req.query.role;
  }
  if (req.query.location) {
    filters.push('location = :location');
    values[':location'] = req.query.location;
  }
  if (filters.length) {
    params.FilterExpression = filters.join(' AND ');
    params.ExpressionAttributeValues = values;
  }

  try {
    const data = await docClient.scan(params).promise();
    const users = (data.Items || []).map(({ password, ...rest }) => rest);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /users - create a new user
router.post('/', async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    const email = normalizeEmail(rest.email);
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const item = createUserItem({
      ...rest,
      email,
      password: hashedPassword,
      verified: false,
      reputationScore: 0
    });
    if (!(await createUserWithEmail(item))) {
      return res.status(409).json({ error: 'User already exists' });
    }
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

