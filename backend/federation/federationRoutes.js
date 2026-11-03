const express = require('express');
const router = express.Router();
const docClient = require('../lib/dynamodbClient');
const { LISTING_TABLE_NAME } = require('../models/listing');
const { TRANSACTION_TABLE_NAME } = require('../models/transaction');
const { USER_TABLE_NAME } = require('../models/user');
const { importFederatedData } = require('../sync/importHelper');
const { requireFederationPeer, createPeerResponseHeaders } = require('../middleware/federationPeerAuth');
const { federationRateLimit } = require('../middleware/rateLimit');

const pick = (item, fields) => Object.fromEntries(
  fields.filter(field => item[field] !== undefined).map(field => [field, item[field]])
);

// Browser API keys and ordinary member tokens are never federation credentials.
router.use(requireFederationPeer, federationRateLimit);

router.get('/export', async (_req, res) => {
  try {
    const [listingsRes, transactionsRes, usersRes] = await Promise.all([
      docClient.scan({ TableName: LISTING_TABLE_NAME }).promise(),
      docClient.scan({ TableName: TRANSACTION_TABLE_NAME }).promise(),
      docClient.scan({
        TableName: USER_TABLE_NAME,
        ProjectionExpression: '#id, username, reputationScore, reputationWeight, originNodeId, originUserId',
        ExpressionAttributeNames: { '#id': 'id' }
      }).promise()
    ]);

    const nodeId = process.env.NODE_ID;
    const users = (usersRes.Items || []).map(user => ({
      ...pick(user, ['id', 'username', 'reputationScore', 'reputationWeight']),
      originNodeId: typeof user.originNodeId === 'string' ? user.originNodeId : nodeId,
      originUserId: typeof user.originUserId === 'string' ? user.originUserId : user.id
    }));

    // Export only fields required for federation; never serialize full DynamoDB rows.
    const listings = (listingsRes.Items || []).map(item => pick(item, [
      'id', 'userId', 'type', 'title', 'description', 'price', 'location', 'createdAt'
    ]));
    const transactions = (transactionsRes.Items || []).map(item => pick(item, [
      'id', 'contractId', 'consumerId', 'producerId', 'rating', 'status'
    ]));

    const payload = JSON.stringify({ listings, transactions, users });
    const peers = JSON.parse(process.env.FEDERATION_PEERS_JSON || '{}');
    const secret = peers[_req.federationPeer.nodeId];
    const nodeId = process.env.FEDERATION_LOCAL_NODE_ID || process.env.NODE_ID;
    if (!nodeId || typeof secret !== 'string' || secret.length < 32) {
      return res.status(503).json({ error: 'Federation response signing is not configured' });
    }
    res.set(createPeerResponseHeaders({
      nodeId, secret, method: 'GET', path: '/federation/export', body: payload
    }));
    return res.type('application/json').send(payload);
  } catch {
    return res.status(500).json({ error: 'Export failed' });
  }
});

router.post('/import', async (req, res) => {
  try {
    await importFederatedData(req.body, { sourceNodeId: req.federationPeer.nodeId });
    return res.json({ message: 'Import successful' });
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      return res.status(409).json({ error: 'Import refused: user id already exists' });
    }
    if (error.message === 'Federated user must have a remote user id' ||
        error.message === 'Federated user must have a username' ||
        error.message === 'Federation payload must be an object') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Import failed' });
  }
});

module.exports = router;
