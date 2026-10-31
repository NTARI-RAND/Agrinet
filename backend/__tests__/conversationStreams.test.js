const jwt = require('jsonwebtoken');
const mockConversations = new Map();
let mockCleanupFailure = false;
let mockHoldRead;
jest.mock('../lib/dynamodbClient', () => ({
  get: ({ Key }) => ({ promise: async () => {
    const Item = mockConversations.get(Key.id);
    const hold = mockHoldRead;
    mockHoldRead = undefined;
    if (hold) { hold.started(); await hold.wait; }
    return { Item };
  } }),
  delete: ({ Key }) => ({ promise: async () => { mockConversations.delete(Key.id); return {}; } }),
  query: () => ({ promise: async () => {
    if (mockCleanupFailure) throw new Error('fixture cleanup failure');
    return { Items: [] };
  } }),
}));
jest.mock('../bull/pingJobs', () => ({ addPingJob: jest.fn() }));
jest.mock('../bull/smsQueue', () => ({ enqueueSms: jest.fn() }));
jest.mock('../federation/federationSyncJob', () => jest.fn());

describe('production conversation SSE boundary', () => {
  const originalEnv = { ...process.env };
  const originalGlobals = Object.fromEntries(['broadcast', 'emitToken', 'emitMessage'].map(key => [key, global[key]]));
  let server;
  let base;
  const controllers = [];
  const bearer = (userId, seconds = 60) => `Bearer ${jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: seconds })}`;
  async function open(path, headers = {}) {
    const controller = new AbortController();
    controllers.push(controller);
    return fetch(base + path, { headers, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(4000)]) });
  }
  beforeAll(async () => {
    process.env.MINIMAL_SERVER = 'false';
    process.env.JWT_SECRET = 'stream-fixture-secret';
    process.env.API_KEY = 'stream-fixture-key';
    ({ server } = require('../server'));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  beforeEach(() => {
    mockCleanupFailure = false;
    mockHoldRead = undefined;
    mockConversations.clear();
    mockConversations.set('mine', { id: 'mine', ownerId: 'alice' });
    mockConversations.set('foreign', { id: 'foreign', ownerId: 'bob' });
    mockConversations.set('legacy', { id: 'legacy' });
  });
  afterEach(() => { for (const controller of controllers.splice(0)) controller.abort(); });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    process.env = originalEnv;
    for (const [key, value] of Object.entries(originalGlobals)) {
      if (value === undefined) delete global[key]; else global[key] = value;
    }
  });

  test.each([
    ['anonymous', {}, ''],
    ['shared key', { 'x-api-key': 'stream-fixture-key' }, ''],
    ['invalid bearer and shared key', { Authorization: 'Bearer invalid', 'x-api-key': 'stream-fixture-key' }, ''],
    ['query key', {}, '?x-api-key=stream-fixture-key'],
  ])('rejects %s before opening stream headers', async (_name, headers, query) => {
    let response;
    try { response = await open('/stream/mine' + query, headers); } catch { response = { status: 'open stream', headers: new Headers() }; }
    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).not.toContain('text/event-stream');
  });
  test.each(['foreign', 'legacy', 'missing'])('conceals %s from an authenticated non-owner', async id => {
    let response;
    try { response = await open(`/stream/${id}`, { Authorization: bearer('alice') }); } catch { response = { status: 'open stream' }; }
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });
  test('query bearer is not a substitute for an Authorization header', async () => {
    const token = bearer('alice').slice(7);
    let response;
    try { response = await open(`/stream/mine?access_token=${token}`); } catch { response = { status: 'open stream' }; }
    expect(response.status).toBe(401);
  });
  test('retires the unrestricted global feed rather than exposing transaction events to every account', async () => {
    const response = await open('/events', { Authorization: bearer('alice') });
    expect(response.status).toBe(410);
    expect(response.headers.get('content-type')).not.toContain('text/event-stream');
  });
  test('owner receives only conversation-scoped events and deletion ends the stream', async () => {
    const response = await open('/stream/mine', { Authorization: bearer('alice') });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    const reader = response.body.getReader();
    global.emitMessage('foreign', { content: 'Bobs secret' });
    global.emitMessage('mine', { content: 'Alice answer' });
    const chunk = new TextDecoder().decode((await reader.read()).value);
    expect(chunk).toContain('Alice answer');
    expect(chunk).not.toContain('Bobs secret');
    const deletion = await fetch(base + '/conversations/mine', { method: 'DELETE', headers: { Authorization: bearer('alice') } });
    expect(deletion.status).toBe(204);
    expect((await reader.read()).done).toBe(true);
  });
  test('a connection closes when its account token expires', async () => {
    const response = await open('/stream/mine', { Authorization: `Bearer ${jwt.sign({ userId: 'alice', exp: Math.ceil(Date.now() / 1000) + 1 }, process.env.JWT_SECRET)}` });
    expect(response.status).toBe(200);
    const read = await response.body.getReader().read();
    expect(read.done).toBe(true);
    expect((await open('/stream/mine', { Authorization: bearer('alice', -1) })).status).toBe(401);
  });

  test('parent deletion closes streams even when message cleanup fails', async () => {
    const response = await open('/stream/mine', { Authorization: bearer('alice') });
    const reader = response.body.getReader();
    mockCleanupFailure = true;
    const expectedError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const deletion = await fetch(base + '/conversations/mine', { method: 'DELETE', headers: { Authorization: bearer('alice') } });
    expectedError.mockRestore();
    expect(deletion.status).toBe(500);
    expect(mockConversations.has('mine')).toBe(false);
    global.emitMessage('mine', { content: 'late answer' });
    const next = await reader.read();
    expect(next.done).toBe(true);
  });

  test('deletion revokes a stream whose ownership lookup is still in flight', async () => {
    let release;
    let started;
    const reading = new Promise(resolve => { started = resolve; });
    mockHoldRead = { started, wait: new Promise(resolve => { release = resolve; }) };
    const pending = open('/stream/mine', { Authorization: bearer('alice') });
    await reading;
    const deletion = await fetch(base + '/conversations/mine', { method: 'DELETE', headers: { Authorization: bearer('alice') } });
    expect(deletion.status).toBe(204);
    release();
    const response = await pending;
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).not.toContain('text/event-stream');
  });
  test('retired global feed returns 410 without account credentials', async () => {
    const response = await open('/events');
    expect(response.status).toBe(410);
  });
  test('stream opening requests have an account budget before ownership reads', async () => {
    const auth = { Authorization: bearer('stream-rate-fixture') };
    const first = await open('/stream/missing', auth);
    expect(first.status).toBe(404);
    expect(first.headers.get('ratelimit-limit')).not.toBeNull();
    const limit = Number(first.headers.get('ratelimit-limit'));
    for (let i = 1; i < limit; i++) expect((await open('/stream/missing', auth)).status).toBe(404);
    const blocked = await open('/stream/missing', auth);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await open('/stream/missing', { Authorization: bearer('other-stream-user') })).status).toBe(404);
  });

});
