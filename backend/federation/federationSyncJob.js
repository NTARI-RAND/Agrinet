const dynamodbClient = require('../lib/dynamodbClient');
const { NODE_REGISTRY_TABLE_NAME } = require('./models/nodeRegistry');
const { scanItems } = require('../lib/collectionPage');
const { inspectExport } = require('../sync/exportPages');

async function runFederationSync() {
  for await (const node of scanItems(dynamodbClient, { TableName: NODE_REGISTRY_TABLE_NAME })) {
    const url = node.url || node.nodeUrl;
    try {
      const counts = await inspectExport(url);
      // Redacted summaries cannot replace canonical records or local narrative.
      console.info('Federation export inspected; automatic import disabled', { peer: url, counts });
    } catch (error) {
      console.error('Federation export inspection failed; no sync recorded', { peer: url, error: error.message });
    }
  }
}

setInterval(() => runFederationSync().catch(() => console.error('Federation registry scan failed')), 6 * 60 * 60 * 1000);
module.exports = runFederationSync;
