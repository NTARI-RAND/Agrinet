const express = require('express');
const docClient = require('../lib/dynamodbClient');
const { USER_TABLE_NAME, sanitizeUserForAdmin } = require('../models/user');
const { KEY_TABLE_NAME } = require('../models/key');
const requireAdmin = require('../middleware/requireAdmin');
const { userWriteRateLimit } = require('../middleware/rateLimit');
const router = express.Router();

function sanitizeKeyForAdmin(key = {}) {
  const safe = {};
  for (const field of ['id', 'userId', 'issuedAt', 'usageCount', 'expiresAt']) {
    if (key[field] !== undefined) safe[field] = key[field];
  }
  return safe;
}

// Every route in this module requires a verified administrator account token.
router.use(requireAdmin);
router.use(userWriteRateLimit);

router.get('/users', async (_req, res) => {
  try {
    const data = await docClient.scan({
      TableName: USER_TABLE_NAME,
      ProjectionExpression: '#id, username, email, phone, #role, verified, locationType, reputationScore, reputationWeight, createdAt',
      ExpressionAttributeNames: { '#id': 'id', '#role': 'role' }
    }).promise();
    res.json((data.Items || []).map(sanitizeUserForAdmin));
  } catch {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/keys', async (_req, res) => {
  try {
    const { Items: keys = [] } = await docClient.scan({
      TableName: KEY_TABLE_NAME,
      ProjectionExpression: '#id, userId, issuedAt, usageCount, expiresAt',
      ExpressionAttributeNames: { '#id': 'id' }
    }).promise();
    res.json(keys.map(sanitizeKeyForAdmin));
  } catch {
    res.status(500).json({ error: 'Failed to fetch keys' });
  }
});

module.exports = router;
