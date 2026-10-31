const inspectPeers = require('./federationSyncJob');

// Keep the legacy schedule, but never merge privacy-filtered export pages.
const syncFromPeers = () => inspectPeers();
setInterval(() => syncFromPeers().catch(() => console.error('Federation registry scan failed')), 30 * 60 * 1000);

module.exports = { syncFromPeers };
