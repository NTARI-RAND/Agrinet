const express = require('express');
const router = express.Router();
const docClient = require('../lib/dynamodbClient');
const { LISTING_TABLE_NAME } = require('../models/listing');
const { TRANSACTION_TABLE_NAME } = require('../models/transaction');
const { importFederatedData } = require('../sync/importHelper');
const { collectionPage, scanPage, pageError } = require('../lib/collectionPage');
const exportFields = require('./exportFields');
const { requireFederationPeer, createPeerResponseHeaders } = require('../middleware/federationPeerAuth');
const { federationAttemptRateLimit, federationRateLimit } = require('../middleware/rateLimit');

router.use(federationAttemptRateLimit, requireFederationPeer, federationRateLimit);

// Export route for peer sync
router.get('/export', async (req, res) => {
  try {
    const nodeId = process.env.FEDERATION_LOCAL_NODE_ID || process.env.NODE_ID;
    const peers = JSON.parse(process.env.FEDERATION_PEERS_JSON || '{}');
    const secret = peers[req.federationPeer.nodeId];
    if (!nodeId || typeof secret !== 'string' || secret.length < 32) {
      return res.status(503).json({ error: 'Federation response signing is not configured' });
    }
    const page = collectionPage(req.query, ['federation-export', req.federationPeer.nodeId]);
    const result = { listings: [], transactions: [], users: [] };
    const next = {};
    for (const [name, table, allowed, present] of [
      ['listings', LISTING_TABLE_NAME, exportFields.listingFields, exportFields.listing],
      ['transactions', TRANSACTION_TABLE_NAME, exportFields.transactionFields, exportFields.transaction],
    ]) {
      if (page.state && page.state[name] === null) { next[name] = null; continue; }
      const names = Object.fromEntries(allowed.map((field, i) => [`#f${i}`, field]));
      const data = await scanPage(docClient, {
        TableName: table, ProjectionExpression: Object.keys(names).join(', '), ExpressionAttributeNames: names,
      }, page.limit, page.state?.[name]);
      result[name] = data.items.map(present);
      next[name] = data.next;
    }
    page.finish(res, Object.values(next).some(Boolean) ? next : null);
    res.set('X-Federation-Omissions', 'users, dialogNotes, ratings');
    const payload = JSON.stringify(result);
    res.set(createPeerResponseHeaders({ nodeId, secret, method: 'GET', path: '/federation/export', body: payload }));
    res.type('application/json').send(payload);
  } catch (err) {
    pageError(res, err, 'Export failed');
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
