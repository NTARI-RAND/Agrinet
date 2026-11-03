const express = require('express');
const request = require('supertest');

jest.mock('../../lib/dynamodbClient', () => ({
  scan: jest.fn(),
  put: jest.fn()
}));

const docClient = require('../../lib/dynamodbClient');
const federationRoutes = require('../federationRoutes');
const { createPeerHeaders, verifyPeerResponse } = require('../../middleware/federationPeerAuth');

describe('federation route security', () => {
  const oldEnv = {
    peers: process.env.FEDERATION_PEERS_JSON,
    node: process.env.NODE_ID,
    localNode: process.env.FEDERATION_LOCAL_NODE_ID
  };
  const secret = '0123456789abcdef0123456789abcdef';
  let app;

  beforeEach(() => {
    process.env.FEDERATION_PEERS_JSON = JSON.stringify({ 'peer-1': secret });
    process.env.NODE_ID = 'local-node';
    process.env.FEDERATION_LOCAL_NODE_ID = 'local-node';
    app = express();
    app.use(express.json({ verify(req, _res, buffer) { req.rawBody = Buffer.from(buffer); } }));
    app.use('/federation', federationRoutes);
    docClient.scan.mockReset();
    docClient.put.mockReset();
  });

  afterAll(() => {
    if (oldEnv.peers === undefined) delete process.env.FEDERATION_PEERS_JSON;
    else process.env.FEDERATION_PEERS_JSON = oldEnv.peers;
    if (oldEnv.node === undefined) delete process.env.NODE_ID;
    else process.env.NODE_ID = oldEnv.node;
    if (oldEnv.localNode === undefined) delete process.env.FEDERATION_LOCAL_NODE_ID;
    else process.env.FEDERATION_LOCAL_NODE_ID = oldEnv.localNode;
  });

  test('does not export unless the caller proves a configured peer identity', async () => {
    const response = await request(app).get('/federation/export');
    expect(response.status).toBe(401);
    expect(docClient.scan).not.toHaveBeenCalled();
  });

  test('exports only allowlisted user, listing and transaction fields and signs response', async () => {
    docClient.scan
      .mockReturnValueOnce({ promise: async () => ({ Items: [{ id: 'l1', title: 'Apples', password: 'secret', internal: 'x' }] }) })
      .mockReturnValueOnce({ promise: async () => ({ Items: [{ id: 't1', status: 'pending', cardToken: 'secret' }] }) })
      .mockReturnValueOnce({ promise: async () => ({ Items: [{
        id: 'u1', username: 'alice', email: 'a@example.test', phone: '555-0100',
        password: 'hash', verificationCode: 'secret', role: 'admin', verified: true,
        coordinates: { lat: 1, long: 2 }, reputationScore: 3
      }] }) });

    const headers = createPeerHeaders({
      nodeId: 'peer-1', secret, method: 'GET', path: '/federation/export'
    });
    const response = await request(app).get('/federation/export').set(headers);
    expect(response.status).toBe(200);
    expect(response.body.users).toEqual([{
      id: 'u1', username: 'alice', reputationScore: 3,
      originNodeId: 'local-node', originUserId: 'u1'
    }]);
    expect(response.body.listings).toEqual([{ id: 'l1', title: 'Apples' }]);
    expect(response.body.transactions).toEqual([{ id: 't1', status: 'pending' }]);
    expect(verifyPeerResponse({
      headers: response.headers,
      expectedNodeId: 'local-node',
      secret,
      method: 'GET',
      path: '/federation/export',
      body: JSON.stringify(response.body)
    })).toBe(true);
  });

  test('import uses the authenticated peer identity, not a body-supplied source id', async () => {
    docClient.put.mockReturnValue({ promise: async () => ({}) });
    const body = JSON.stringify({
      sourceNodeId: 'forged-node',
      users: [{ id: 'remote-u1', username: 'bob', role: 'admin', password: 'hash' }]
    });
    const headers = createPeerHeaders({
      nodeId: 'peer-1', secret, method: 'POST', path: '/federation/import', body
    });
    const response = await request(app).post('/federation/import')
      .set(headers).set('Content-Type', 'application/json').send(body);
    expect(response.status).toBe(200);
    const written = docClient.put.mock.calls[0][0];
    expect(written.Item.sourceNodeId).toBe('peer-1');
    expect(written.Item.remoteUserId).toBe('remote-u1');
    expect(written.Item.role).toBeUndefined();
    expect(written.Item.password).toBeUndefined();
    expect(written.ConditionExpression).toBe('attribute_not_exists(#id)');
  });
});
