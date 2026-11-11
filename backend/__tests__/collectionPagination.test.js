const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createPeerHeaders, verifyPeerResponse } = require('../middleware/federationPeerAuth');
const peerSecret = '0123456789abcdef0123456789abcdef';
const peerHeaders = () => createPeerHeaders({ nodeId: 'peer-1', secret: peerSecret, method: 'GET', path: '/federation/export' });

const mockTables = {};
let mockScans = [];
jest.mock('../lib/dynamodbClient', () => ({
  scan: params => ({ promise: async () => {
    mockScans.push(params);
    const rows = mockTables[params.TableName] || [];
    const start = params.ExclusiveStartKey ? rows.findIndex(row => row.id === params.ExclusiveStartKey.id) + 1 : 0;
    const evaluated = rows.slice(start, start + (params.Limit || rows.length));
    let Items = evaluated;
    const values = params.ExpressionAttributeValues || {};
    if (values[':ownerId']) Items = Items.filter(row => row.ownerId === values[':ownerId']);
    if (values[':locationType']) Items = Items.filter(row => row.locationType === values[':locationType']);
    if (values[':role']) Items = Items.filter(row => row.role === values[':role']);
    if (values[':location']) Items = Items.filter(row => row.location === values[':location'] && row.locationPrivacy === true);
    // Return complete records deliberately: response DTOs must also protect
    // against unexpected fields, independently of the database projection.
    return { Items, ...(start + evaluated.length < rows.length && {
      LastEvaluatedKey: { id: evaluated.at(-1).id },
    }) };
  } }),
}));
jest.mock('../bull/pingJobs', () => ({ addPingJob: jest.fn() }));
jest.mock('../bull/smsQueue', () => ({ enqueueSms: jest.fn() }));
jest.mock('../federation/federationSyncJob', () => jest.fn());

describe('bounded collection HTTP responses', () => {
  let app;
  const env = { ...process.env };
  const authorization = userId => `Bearer ${jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '2h' })}`;
  beforeAll(() => {
    process.env.MINIMAL_SERVER = 'false';
    process.env.JWT_SECRET = 'collection-test-secret';
    process.env.API_KEY = 'collection-operator-key';
    process.env.FEDERATION_LOCAL_NODE_ID = 'local-node';
    process.env.FEDERATION_PEERS_JSON = JSON.stringify({ 'peer-1': peerSecret });
    ({ app } = require('../server'));
  });
  afterAll(() => { process.env = env; });
  beforeEach(() => {
    mockScans = [];
    mockTables.Conversations = [
      { id: 'bobs-secret-id', ownerId: 'bob', title: 'private' },
      { id: 'mine-1', ownerId: 'alice', title: 'first' },
      { id: 'legacy', title: 'unowned' },
      { id: 'mine-2', ownerId: 'alice', title: 'second' },
    ];
    mockTables.Users = [
      { id: 'u1', username: 'grower', role: 'producer', locationType: 'farm', reputationScore: 99, reputationWeight: 1000, location: 'Town', locationPrivacy: false, password: 'hash', verificationCode: 'code', email: 'private@example.invalid', phone: 'private', coordinates: { lat: 1, long: 2 }, futureSecret: 'secret' },
      { id: 'u2', username: 'buyer', role: 'consumer', locationType: 'delivery', location: 'Town', locationPrivacy: true },
      { id: 'u3', username: 'seller', role: 'producer', locationType: 'production', location: 'Town', locationPrivacy: true },
    ];
    mockTables.Listings = [{ id: 'l1', userId: 'u1', title: 'Public listing', price: 2, futureSecret: 'not a listing field' }, { id: 'l2', userId: 'u2', title: 'Second' }];
    mockTables.Transactions = [{ id: 't1', consumerId: 'u1', producerId: 'u2', status: 'pending', dialogNotes: 'private narrative', futureSecret: 'secret' }];
  });

  async function collect(path, header, value) {
    const pages = [];
    let cursor;
    do {
      const result = await request(app).get(path + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '')).set(header === 'peer' ? peerHeaders() : { [header]: value });
      expect(result.status).toBe(200);
      expect(result.headers['x-pagination']).toBe('cursor-v1');
      expect(result.headers['cache-control']).toContain('no-store');
      if (header === 'peer') expect(verifyPeerResponse({ headers: result.headers, expectedNodeId: 'local-node', secret: peerSecret, method: 'GET', path: '/federation/export', body: JSON.stringify(result.body) })).toBe(true);
      pages.push(result.body);
      cursor = result.headers['x-next-cursor'];
      expect(pages.length).toBeLessThan(10);
    } while (cursor);
    return pages;
  }

  test('conversation pages include empty filtered pages but never foreign or ownerless rows', async () => {
    const pages = await collect('/conversations?limit=1', 'Authorization', authorization('alice'));
    expect(pages).toEqual([[], [{ id: 'mine-1', ownerId: 'alice', title: 'first' }], [], [{ id: 'mine-2', ownerId: 'alice', title: 'second' }]]);
    expect(mockScans).toHaveLength(4);
    expect(mockScans.every(scan => scan.Limit === 1 && scan.ExpressionAttributeValues[':ownerId'] === 'alice')).toBe(true);
  });

  test('user pages allowlist public fields and do not expose private location by filtering', async () => {
    const pages = await collect('/users?limit=1', 'Authorization', authorization('alice'));
    expect(pages.flat()).toEqual([
      { id: 'u1', username: 'grower', role: 'producer', locationType: 'farm' },
      { id: 'u2', username: 'buyer', role: 'consumer', locationType: 'delivery', location: 'Town' },
      { id: 'u3', username: 'seller', role: 'producer', locationType: 'production', location: 'Town' },
    ]);
    mockScans = [];
    const filtered = await collect('/users?limit=1&role=producer&location=Town', 'Authorization', authorization('alice'));
    expect(filtered.flat().map(row => row.id)).toEqual(['u3']);
    expect(filtered[0]).toEqual([]);
  });

  test('location-type discovery preserves empty pages and excludes scalar reputation and private location', async () => {
    const pages = await collect('/users?limit=1&locationType=production', 'Authorization', authorization('alice'));
    expect(pages).toEqual([[], [], [{ id: 'u3', username: 'seller', role: 'producer', locationType: 'production', location: 'Town' }]]);
    const privatePage = await collect('/users?limit=1&locationType=farm', 'Authorization', authorization('alice'));
    expect(privatePage.flat()).toEqual([{ id: 'u1', username: 'grower', role: 'producer', locationType: 'farm' }]);
  });

  test('location-type cursors cannot be reused with another or omitted filter', async () => {
    const token = authorization('alice');
    const first = await request(app).get('/users?limit=1&locationType=farm').set('Authorization', token);
    expect(first.status).toBe(200);
    const cursor = first.headers['x-next-cursor'];
    expect(typeof cursor).toBe('string');
    mockScans = [];
    for (const path of ['/users?limit=1&locationType=delivery', '/users?limit=1']) {
      const result = await request(app).get(path).query({ cursor }).set('Authorization', token);
      expect(result.status).toBe(400);
    }
    expect(mockScans).toHaveLength(0);
  });

  test('repeated and structured location-type filters fail before storage access', async () => {
    for (const suffix of ['locationType=farm&locationType=delivery', 'locationType[kind]=farm']) {
      const result = await request(app).get('/users?' + suffix).set('Authorization', authorization('alice'));
      expect(result.status).toBe(400);
    }
    expect(mockScans).toHaveLength(0);
  });

  test('federation pages finish collections independently without exporting accounts or narrative', async () => {
    const pages = await collect('/federation/export?limit=1', 'peer', null);
    expect(pages).toEqual([
      { listings: [{ id: 'l1', userId: 'u1', title: 'Public listing', price: 2 }], transactions: [{ id: 't1', consumerId: 'u1', producerId: 'u2', status: 'pending' }], users: [] },
      { listings: [{ id: 'l2', userId: 'u2', title: 'Second' }], transactions: [], users: [] },
    ]);
    expect(mockScans.map(scan => scan.TableName)).toEqual(['Listings', 'Transactions', 'Listings']);
  });

  test('a federation continuation is bound to its authenticated peer', async () => {
    const first = await request(app).get('/federation/export?limit=1').set(peerHeaders());
    expect(first.status).toBe(200);
    const cursor = first.headers['x-next-cursor'];
    expect(typeof cursor).toBe('string');
    process.env.FEDERATION_PEERS_JSON = JSON.stringify({ 'peer-1': peerSecret, 'peer-2': peerSecret });
    try {
      const other = createPeerHeaders({ nodeId: 'peer-2', secret: peerSecret, method: 'GET', path: '/federation/export' });
      const response = await request(app).get('/federation/export?limit=1').query({ cursor }).set(other);
      expect(response.status).toBe(400);
    } finally { process.env.FEDERATION_PEERS_JSON = JSON.stringify({ 'peer-1': peerSecret }); }
  });

  test('missing response signing identity fails before scanning or publishing a cursor', async () => {
    const local = process.env.FEDERATION_LOCAL_NODE_ID;
    const node = process.env.NODE_ID;
    delete process.env.FEDERATION_LOCAL_NODE_ID;
    delete process.env.NODE_ID;
    try {
      const result = await request(app).get('/federation/export?limit=1').set(peerHeaders());
      expect(result.status).toBe(503);
      expect(result.headers['x-next-cursor']).toBeUndefined();
      expect(mockScans).toHaveLength(0);
    } finally {
      process.env.FEDERATION_LOCAL_NODE_ID = local;
      if (node === undefined) delete process.env.NODE_ID; else process.env.NODE_ID = node;
    }
  });

  test('ordinary account tokens cannot export federation data and shared keys cannot list private chats', async () => {
    expect((await request(app).get('/federation/export').set('Authorization', authorization('alice'))).status).toBe(401);
    expect((await request(app).get('/federation/export').set('x-api-key', process.env.API_KEY)).status).toBe(401);
    expect((await request(app).get('/conversations').set('x-api-key', process.env.API_KEY)).status).toBe(401);
    expect((await request(app).get('/users').set('x-api-key', process.env.API_KEY)).status).toBe(401);
    expect(mockScans).toHaveLength(0);
  });

  test('obsolete export keys cannot bypass per-peer HMAC authentication', async () => {
    const result = await request(app).get('/federation/export').set('x-federation-key', 'old-read-only-key');
    expect(result.status).toBe(401);
    expect(mockScans).toHaveLength(0);
  });

  test('approved browser origins can read pagination headers without exposing private keys', async () => {
    const result = await request(app).get('/users?limit=1').set('Authorization', authorization('alice')).set('Origin', 'https://www.ntari.org');
    expect(result.status).toBe(200);
    expect(result.headers['access-control-expose-headers']).toContain('X-Next-Cursor');
    expect(result.headers['access-control-expose-headers']).toContain('X-Pagination');
    expect(JSON.stringify(result.body)).not.toContain('private@example.invalid');
  });

  test.each(['0', '-1', '101', '1junk', '1.5', '', '1&limit=2'])('invalid limit %s fails before a scan', async limit => {
    const result = await request(app).get(`/conversations?limit=${limit}`).set('Authorization', authorization('alice'));
    expect(result.status).toBe(400);
    expect(mockScans).toHaveLength(0);
  });

  test('defaults are bounded and malformed cursors fail before scanning', async () => {
    const first = await request(app).get('/users').set('Authorization', authorization('alice'));
    expect(first.status).toBe(200);
    expect(mockScans[0].Limit).toBe(50);
    mockScans = [];
    for (const cursor of ['invalid', '%%%','']) {
      const result = await request(app).get('/users').query({ cursor }).set('Authorization', authorization('alice'));
      expect(result.status).toBe(400);
    }
    expect(mockScans).toHaveLength(0);
  });

  test('encrypted cursors bind account, collection, filters, and limit', async () => {
    const token = authorization('alice');
    mockTables.Users[0].id = 'private-account-continuation-key';
    const first = await request(app).get('/users?limit=1&role=producer').set('Authorization', token);
    const cursor = first.headers['x-next-cursor'];
    expect(typeof cursor).toBe('string');
    expect(Buffer.from(cursor, 'base64url').toString()).not.toContain('private-account-continuation-key');
    mockScans = [];
    for (const [path, auth] of [
      ['/users?limit=1&role=consumer', token],
      ['/users?limit=2&role=producer', token],
      ['/users?limit=1&role=producer', authorization('bob')],
      ['/conversations?limit=1&role=producer', token],
    ]) {
      const result = await request(app).get(path).query({ cursor }).set('Authorization', auth);
      expect(result.status).toBe(400);
    }
    const changed = cursor.slice(0, 12) + (cursor[12] === 'A' ? 'B' : 'A') + cursor.slice(13);
    expect((await request(app).get('/users?limit=1&role=producer').query({ cursor: changed }).set('Authorization', token)).status).toBe(400);
    expect(mockScans).toHaveLength(0);
  });

  test('cursors expire and database failures never return a successful partial page', async () => {
    const token = authorization('alice');
    const first = await request(app).get('/users?limit=1').set('Authorization', token);
    const cursor = first.headers['x-next-cursor'];
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 3600001);
    try {
      const expired = await request(app).get('/users?limit=1').query({ cursor }).set('Authorization', token);
      expect(expired.status).toBe(400);
    } finally { clock.mockRestore(); }
    mockTables.Listings = null;
    const db = require('../lib/dynamodbClient');
    const originalScan = db.scan;
    db.scan = () => ({ promise: async () => { throw new Error('database unavailable'); } });
    try {
      const result = await request(app).get('/federation/export').set(peerHeaders());
      expect(result.status).toBe(500);
      expect(result.headers['x-next-cursor']).toBeUndefined();
    } finally { db.scan = originalScan; }
  });
});
