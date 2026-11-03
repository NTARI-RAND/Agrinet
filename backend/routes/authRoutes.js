const express = require('express');
const bcrypt = require('../utils/bcrypt');
const jwt = require('../utils/jwt');
const { USER_TABLE_NAME, createUserItem, sanitizeUserForAuth } = require('../models/user');
const docClient = require('../lib/dynamodbClient');
const { randomUUID } = require('node:crypto');
const router = express.Router();
try { require('dotenv').config(); } catch { /* Environment may be supplied by the process. */ }

router.get('/test', (_req, res) => res.status(200).json({ message: 'Auth routes are working!' }));

router.post('/register', async (req, res) => {
  try {
    const { username, email, phone, password } = req.body || {};
    if (typeof username !== 'string' || !username.trim() ||
        typeof email !== 'string' || !email.trim() ||
        typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Username, email, and a password of at least 8 characters are required' });
    }
    const user = createUserItem({
      id: randomUUID(), username: username.trim(), email: email.trim().toLowerCase(),
      ...(typeof phone === 'string' ? { phone } : {}),
      password: await bcrypt.hash(password, 10)
    });
    await docClient.put({
      TableName: USER_TABLE_NAME,
      Item: user,
      ConditionExpression: 'attribute_not_exists(#id)',
      ExpressionAttributeNames: { '#id': 'id' }
    }).promise();
    return res.status(201).json({ message: 'User registered. Please verify your email/phone.' });
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') return res.status(409).json({ error: 'Account could not be created' });
    return res.status(500).json({ error: 'Error registering user.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const { Items = [] } = await docClient.scan({
      TableName: USER_TABLE_NAME,
      FilterExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': email.trim().toLowerCase() }
    }).promise();
    const user = Items[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: sanitizeUserForAuth(user) });
  } catch {
    return res.status(500).json({ error: 'Login error.' });
  }
});

module.exports = router;
