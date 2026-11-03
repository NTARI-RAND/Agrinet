const axios = require('axios');
const dynamodbClient = require('../lib/dynamodbClient');
const { NODE_REGISTRY_TABLE_NAME } = require('./models/nodeRegistry');
const { createPeerHeaders } = require('../middleware/federationPeerAuth');
const { importFederatedData } = require('../sync/importHelper');

const runFederationSync = async () => {
  const localNodeId = process.env.FEDERATION_LOCAL_NODE_ID || process.env.NODE_ID;
  const localSecret = process.env.FEDERATION_LOCAL_PEER_SECRET;
  if (!localNodeId || !localSecret || localSecret.length < 32) {
    console.error('Federation sync skipped: local peer credentials are not configured');
    return;
  }

  let peerSecrets;
  try {
    peerSecrets = JSON.parse(process.env.FEDERATION_PEERS_JSON || '{}');
  } catch {
    console.error('Federation sync skipped: FEDERATION_PEERS_JSON is invalid');
    return;
  }

  const { Items: nodes = [] } = await dynamodbClient
    .scan({ TableName: NODE_REGISTRY_TABLE_NAME })
    .promise();

  for (const node of nodes) {
    try {
      // A peer must be present in the operator's authenticated peer registry.
      if (!node.nodeId || typeof peerSecrets[node.nodeId] !== 'string' || peerSecrets[node.nodeId].length < 32) {
        console.error('Federation sync skipped for an unconfigured peer');
        continue;
      }

      const exportPath = '/federation/export';
      const headers = createPeerHeaders({
        nodeId: localNodeId, secret: localSecret, method: 'GET', path: exportPath
      });
      const { data } = await axios.get(new URL(exportPath, node.url).toString(), {
        headers, timeout: 15000
      });

      // Source identity comes from the locally managed NodeRegistry record whose
      // peer credential is configured above, never from fields in the response body.
      await importFederatedData(data, { sourceNodeId: node.nodeId });

      await dynamodbClient.update({
        TableName: NODE_REGISTRY_TABLE_NAME,
        Key: { url: node.url },
        UpdateExpression: 'set lastSyncAt = :time',
        ExpressionAttributeValues: { ':time': new Date().toISOString() }
      }).promise();
      console.log('Federation sync completed with a registered peer');
    } catch (error) {
      console.error('Federation sync failed for a registered peer:', error.message);
    }
  }
};

const timer = setInterval(runFederationSync, 6 * 60 * 60 * 1000);
if (typeof timer.unref === 'function') timer.unref();

module.exports = runFederationSync;
