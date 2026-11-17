const express = require('express');
const request = require('supertest');
const { requireFederationPeer, createPeerHeaders } = require('../federationPeerAuth');

describe('federation peer authentication', () => {
  const saved = process.env.FEDERATION_PEERS_JSON;
  let app;
  beforeEach(() => {
    process.env.FEDERATION_PEERS_JSON = JSON.stringify({ 'peer-1': '0123456789abcdef0123456789abcdef' });
    app = express();
    app.use(express.json({ verify(req, _res, buffer) { req.rawBody = Buffer.from(buffer); } }));
    app.post('/federation/import', requireFederationPeer, (req, res) => {
      res.json({ authenticatedPeer: req.federationPeer.nodeId });
    });
  });
  afterAll(() => {
    if (saved === undefined) delete process.env.FEDERATION_PEERS_JSON;
    else process.env.FEDERATION_PEERS_JSON = saved;
  });

  test('accepts a valid signature and sets peer identity from the credential', async () => {
    const body = JSON.stringify({ sourceNodeId: 'forged-body-identity', users: [] });
    const headers = createPeerHeaders({
      nodeId: 'peer-1', secret: '0123456789abcdef0123456789abcdef',
      method: 'POST', path: '/federation/import', body
    });
    const response = await request(app).post('/federation/import')
      .set(headers).set('Content-Type', 'application/json').send(body);
    expect(response.status).toBe(200);
    expect(response.body.authenticatedPeer).toBe('peer-1');
  });

  test('fails closed when peer credentials are missing', async () => {
    const response = await request(app).post('/federation/import').send({ users: [] });
    expect(response.status).toBe(401);
  });

  test('rejects an invalid signature', async () => {
    const body = JSON.stringify({ users: [] });
    const headers = createPeerHeaders({
      nodeId: 'peer-1', secret: '0123456789abcdef0123456789abcdef',
      method: 'POST', path: '/federation/import', body
    });
    headers['x-federation-signature'] = '0'.repeat(64);
    const response = await request(app).post('/federation/import')
      .set(headers).set('Content-Type', 'application/json').send(body);
    expect(response.status).toBe(401);
  });
});
