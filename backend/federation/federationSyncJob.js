const axios = require('axios');
const dynamodbClient = require('../lib/dynamodbClient');
const { NODE_REGISTRY_TABLE_NAME } = require('./models/nodeRegistry');
const { createPeerHeaders } = require('../middleware/federationPeerAuth');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

const runFederationSync = async () => {
  const nodeId = process.env.FEDERATION_LOCAL_NODE_ID;
  const secret = process.env.FEDERATION_LOCAL_PEER_SECRET;
  if (!nodeId || !secret || secret.length < 32) {
    console.error('Federation sync skipped: local peer credentials are not configured');
    return;
  }

  const { Items: nodes = [] } = await dynamodbClient
    .scan({ TableName: NODE_REGISTRY_TABLE_NAME })
    .promise();

  for (const node of nodes) {
    try {
      const exportPath = '/federation/export';
      const exportHeaders = createPeerHeaders({ nodeId, secret, method: 'GET', path: exportPath });
      const { data } = await axios.get(new URL(exportPath, node.url).toString(), {
        headers: exportHeaders,
        timeout: 15000
      });

      const importPath = '/federation/import';
      const body = JSON.stringify(data);
      const importHeaders = createPeerHeaders({
        nodeId, secret, method: 'POST', path: importPath, body
      });
      await axios.post(new URL(importPath, BACKEND_URL).toString(), body, {
        headers: { ...importHeaders, 'content-type': 'application/json' },
        timeout: 30000
      });

      await dynamodbClient.update({
        TableName: NODE_REGISTRY_TABLE_NAME,
        Key: { url: node.url },
        UpdateExpression: 'set lastSyncAt = :time',
        ExpressionAttributeValues: { ':time': new Date().toISOString() }
      }).promise();
      console.log('Federation sync completed with configured peer');
    } catch (error) {
      console.error('Federation sync failed for a registered peer:', error.message);
    }
  }
};

// Run every six hours. server.js may invoke the first run at startup.
const timer = setInterval(runFederationSync, 6 * 60 * 60 * 1000);
if (typeof timer.unref === 'function') timer.unref();

module.exports = runFederationSync;
