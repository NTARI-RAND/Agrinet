const { createPeerResponseHeaders } = require('../middleware/federationPeerAuth');
const secret = '0123456789abcdef0123456789abcdef';
function configurePeers() {
  process.env.FEDERATION_LOCAL_NODE_ID = 'local-node';
  process.env.FEDERATION_OUTBOUND_PEERS_JSON = JSON.stringify({ 'peer-1': secret, 'peer-2': secret });
}
function signedResponse(response, nodeId = 'peer-1') {
  return { ...response, headers: { ...response.headers, ...createPeerResponseHeaders({
    nodeId, secret, method: 'GET', path: '/federation/export', body: JSON.stringify(response.data)
  }) } };
}
module.exports = { configurePeers, signedResponse };
