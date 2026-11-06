const { getAllNodes } = require('../models/nodeRegistry');
const { inspectExport } = require('./exportPages');

// Legacy entry point: inspection only. Never pass privacy-filtered summaries
// to the unconditional canonical-record importer.
async function runFederationSync() {
  for (const node of await getAllNodes()) {
    try {
      const counts = await inspectExport(node.url || node.nodeUrl);
      console.info('Federation export inspected; automatic import disabled', { counts });
    } catch (error) {
      console.error('Federation export inspection failed; no sync recorded', error.message);
    }
  }
}

module.exports = runFederationSync;
