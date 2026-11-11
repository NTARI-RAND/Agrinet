jest.useFakeTimers();
jest.mock('axios');
jest.mock('../../lib/dynamodbClient', () => ({
  scan: jest.fn(),
  update: jest.fn()
}));

const axios = require('axios');
const dynamodbClient = require('../../lib/dynamodbClient');
const { createPeerResponseHeaders } = require('../../middleware/federationPeerAuth');
const runFederationSync = require('../federationSyncJob');

describe('runFederationSync', () => {
  const originalEnv = {
    nodeId: process.env.NODE_ID,
    localNodeId: process.env.FEDERATION_LOCAL_NODE_ID,
    outbound: process.env.FEDERATION_OUTBOUND_PEERS_JSON
  };
  const peerSecret = '0123456789abcdef0123456789abcdef';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ID = 'local-node';
    process.env.FEDERATION_LOCAL_NODE_ID = 'local-node';
    process.env.FEDERATION_OUTBOUND_PEERS_JSON = JSON.stringify({ 'peer-1': peerSecret });
  });

  afterAll(() => {
    if (originalEnv.nodeId === undefined) delete process.env.NODE_ID;
    else process.env.NODE_ID = originalEnv.nodeId;
    if (originalEnv.localNodeId === undefined) delete process.env.FEDERATION_LOCAL_NODE_ID;
    else process.env.FEDERATION_LOCAL_NODE_ID = originalEnv.localNodeId;
    if (originalEnv.outbound === undefined) delete process.env.FEDERATION_OUTBOUND_PEERS_JSON;
    else process.env.FEDERATION_OUTBOUND_PEERS_JSON = originalEnv.outbound;
  });

  it('verifies peer response signatures before importing and updates lastSyncAt', async () => {
    dynamodbClient.scan.mockReturnValue({
      promise: async () => ({ Items: [{ nodeId: 'peer-1', url: 'https://node1.example' }] })
    });
    dynamodbClient.update.mockReturnValue({ promise: async () => ({}) });
    const data = { users: [] };
    const body = JSON.stringify(data);
    axios.get.mockResolvedValue({
      data,
      headers: createPeerResponseHeaders({
        nodeId: 'peer-1', secret: peerSecret, method: 'GET', path: '/federation/export', body
      })
    });

    await runFederationSync();

    expect(axios.get).toHaveBeenCalledWith('https://node1.example/federation/export', expect.objectContaining({
      headers: expect.objectContaining({
        'x-federation-node-id': 'local-node',
        'x-federation-signature': expect.any(String)
      }),
      timeout: 15000
    }));
    expect(dynamodbClient.update).toHaveBeenCalledTimes(1);
    const params = dynamodbClient.update.mock.calls[0][0];
    expect(params).toMatchObject({
      Key: { url: 'https://node1.example' },
      UpdateExpression: 'set lastSyncAt = :time',
      ExpressionAttributeValues: { ':time': expect.any(String) }
    });
    const timestamp = params.ExpressionAttributeValues[':time'];
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });

  it('does not import or update metadata when the peer response signature is invalid', async () => {
    dynamodbClient.scan.mockReturnValue({
      promise: async () => ({ Items: [{ nodeId: 'peer-1', url: 'https://node1.example' }] })
    });
    axios.get.mockResolvedValue({
      data: { users: [] },
      headers: {
        'x-federation-response-node-id': 'attacker',
        'x-federation-response-timestamp': String(Math.floor(Date.now() / 1000)),
        'x-federation-response-signature': '0'.repeat(64)
      }
    });
    await runFederationSync();
    expect(dynamodbClient.update).not.toHaveBeenCalled();
  });

  it('does not send credentials to non-HTTPS production peers', async () => {
    dynamodbClient.scan.mockReturnValue({
      promise: async () => ({ Items: [{ nodeId: 'peer-1', url: 'http://node1.example' }] })
    });
    await runFederationSync();
    expect(axios.get).not.toHaveBeenCalled();
    expect(dynamodbClient.update).not.toHaveBeenCalled();
  });
});
