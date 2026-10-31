const request = require('supertest');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const mockTables = { Conversations: new Map(), Messages: new Map() };
let mockMessageWrites = 0;
let mockMessageReads = 0;
function mockConditionalFailure() {
  return Object.assign(new Error('condition failed'), { code: 'ConditionalCheckFailedException' });
}
jest.mock('../lib/dynamodbClient', () => ({
  put: ({ TableName, Item }) => ({ promise: async () => {
    if (TableName === 'Messages') mockMessageWrites++;
    mockTables[TableName].set(Item.id, { ...Item });
    return {};
  } }),
  get: ({ TableName, Key }) => ({ promise: async () => ({ Item: mockTables[TableName].get(Key.id) }) }),
  scan: ({ TableName, ExpressionAttributeValues, ExclusiveStartKey }) => ({ promise: async () => {
    let Items = [...mockTables[TableName].values()];
    // Deliberately include a continuation page with no matching items first.
    if (ExclusiveStartKey) Items = Items.slice(1);
    else if (Items.length > 1) Items = Items.slice(0, 1);
    const LastEvaluatedKey = !ExclusiveStartKey && mockTables[TableName].size > 1 ? { id: Items[0].id } : undefined;
    if (ExpressionAttributeValues?.[':ownerId']) {
      Items = Items.filter(item => item.ownerId === ExpressionAttributeValues[':ownerId']);
    }
    if (ExpressionAttributeValues?.[':filePath']) {
      Items = Items.filter(item => item.file?.path === ExpressionAttributeValues[':filePath']);
    }
    return { Items, LastEvaluatedKey };
  } }),
  update: ({ TableName, Key, ExpressionAttributeNames, ExpressionAttributeValues, ConditionExpression }) => ({ promise: async () => {
    const item = mockTables[TableName].get(Key.id);
    if (!item || (ConditionExpression.includes('ownerId') && item.ownerId !== ExpressionAttributeValues[':ownerId'])) throw mockConditionalFailure();
    item[ExpressionAttributeNames['#field']] = ExpressionAttributeValues[':value'];
    return { Attributes: { ...item } };
  } }),
  delete: ({ TableName, Key, ConditionExpression, ExpressionAttributeValues }) => ({ promise: async () => {
    const item = mockTables[TableName].get(Key.id);
    if (ConditionExpression && (!item || item.ownerId !== ExpressionAttributeValues[':ownerId'])) throw mockConditionalFailure();
    mockTables[TableName].delete(Key.id);
    return { Attributes: item };
  } }),
  query: ({ ExpressionAttributeValues }) => ({ promise: async () => {
    mockMessageReads++;
    return { Items: [...mockTables.Messages.values()].filter(item => item.conversationId === ExpressionAttributeValues[':cid']) };
  } }),
  batchWrite: ({ RequestItems }) => ({ promise: async () => {
    for (const { DeleteRequest: { Key } } of RequestItems.Messages || []) mockTables.Messages.delete(Key.id);
    return {};
  } }),
}));
jest.mock('../bull/pingJobs', () => ({ addPingJob: jest.fn() }));
jest.mock('../bull/smsQueue', () => ({ enqueueSms: jest.fn() }));
jest.mock('../federation/federationSyncJob', () => jest.fn());
jest.mock('../services/openAIResponder', () => ({ generateResponse: async () => ({ from: 'ai', content: 'fixture reply' }) }));

describe('private conversation HTTP boundary', () => {
  let app;
  const originalEnv = { ...process.env };
  const globals = Object.fromEntries(['broadcast', 'emitToken', 'emitMessage'].map(key => [key, global[key]]));
  const filename = 'ownership-fixture.txt';
  const attachment = `/uploads/${filename}`;
  const authorization = (userId, extra = {}) => `Bearer ${jwt.sign({ userId, ...extra }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;

  beforeAll(() => {
    process.env.MINIMAL_SERVER = 'false';
    process.env.API_KEY = 'conversation-test-key';
    process.env.JWT_SECRET = 'conversation-test-secret';
    ({ app } = require('../server'));
    fs.writeFileSync(path.join(__dirname, '../uploads', filename), 'private attachment');
  });
  beforeEach(() => {
    mockTables.Conversations.clear();
    mockTables.Messages.clear();
    mockMessageWrites = 0;
    mockMessageReads = 0;
    mockTables.Conversations.set('foreign', { id: 'foreign', ownerId: 'bob', title: 'Bobs private chat' });
    mockTables.Conversations.set('mine', { id: 'mine', ownerId: 'alice', title: 'My chat', pinned: false });
    mockTables.Conversations.set('legacy', { id: 'legacy', title: 'Unknown owner' });
    mockTables.Messages.set('secret', { id: 'secret', conversationId: 'foreign', content: 'private', file: { path: attachment } });
  });
  afterAll(() => {
    fs.unlinkSync(path.join(__dirname, '../uploads', filename));
    process.env = originalEnv;
    for (const [key, value] of Object.entries(globals)) {
      if (value === undefined) delete global[key]; else global[key] = value;
    }
  });

  test('creation derives immutable ownership from the verified account, ignoring supplied owner fields', async () => {
    const result = await request(app).post('/conversations').set('Authorization', authorization('alice'))
      .send({ title: 'New chat', ownerId: 'bob', userId: 'bob' });
    expect(result.status).toBe(201);
    expect(result.body.ownerId).toBe('alice');
    expect(mockTables.Conversations.get(result.body.id).ownerId).toBe('alice');
  });
  async function allConversations(userId, apiKey) {
    const rows = [];
    let cursor;
    do {
      let call = request(app).get('/conversations').set('Authorization', authorization(userId));
      if (apiKey) call = call.set('x-api-key', apiKey);
      if (cursor) call = call.query({ cursor });
      const result = await call;
      expect(result.status).toBe(200);
      rows.push(...result.body);
      cursor = result.headers['x-next-cursor'];
    } while (cursor);
    return rows;
  }
  test('listing traverses empty filtered pages without exposing foreign or legacy chats', async () => {
    expect((await allConversations('alice')).map(item => item.id)).toEqual(['mine']);
  });
  test.each(['foreign', 'legacy', 'missing'])('all ID routes conceal %s and have no message side effects', async id => {
    for (const [method, url, body] of [
      ['get', `/messages/${id}`], ['get', `/conversations/${id}`], ['put', `/conversations/${id}`, { title: 'stolen' }],
      ['post', `/conversations/${id}/pin`, { pinned: true }], ['delete', `/conversations/${id}`],
      ['get', `/messages/${id}`], ['post', `/messages/${id}`, { from: 'user', content: 'private AI trigger' }],
    ]) {
      const result = await request(app)[method](url).set('Authorization', authorization('alice')).send(body);
      expect(result.status).toBe(404);
      expect(result.body).toEqual({ error: 'Not found' });
    }
    expect(mockMessageReads).toBe(0);
    expect(mockMessageWrites).toBe(0);
    expect(mockTables.Conversations.get('foreign').title).toBe('Bobs private chat');
    expect(mockTables.Messages.get('secret').content).toBe('private');
  });
  test.each([undefined, '', ' ', 7, ['alice']])('rejects a signed token without a valid userId (%p)', async userId => {
    const result = await request(app).get('/conversations').set('Authorization', authorization(userId));
    expect(result.status).toBe(401);
  });
  test('a shared API key cannot replace or bypass individual bearer authentication', async () => {
    for (const bearer of [undefined, 'Bearer invalid']) {
      let call = request(app).get('/conversations').set('x-api-key', process.env.API_KEY);
      if (bearer) call = call.set('Authorization', bearer);
      expect((await call).status).toBe(401);
    }
    const result = await request(app).get('/conversations').set('x-api-key', process.env.API_KEY)
      .set('Authorization', authorization('alice'));
    expect(result.status).toBe(200);
    expect((await allConversations('alice', process.env.API_KEY)).map(item => item.id)).toEqual(['mine']);
  });
  test('the rightful owner can read, rename, pin, send, list and delete', async () => {
    const auth = authorization('alice');
    expect((await request(app).get('/conversations/mine').set('Authorization', auth)).status).toBe(200);
    expect((await request(app).put('/conversations/mine').set('Authorization', auth).send({ title: 'Renamed', ownerId: 'bob' })).body.title).toBe('Renamed');
    expect((await request(app).post('/conversations/mine/pin').set('Authorization', auth).send({ pinned: true })).body.pinned).toBe(true);
    const sent = await request(app).post('/messages/mine').set('Authorization', auth).send({ from: 'alice', content: 'hello', type: 'text' });
    expect(sent.status).toBe(201);
    const messages = await request(app).get('/messages/mine').set('Authorization', auth);
    expect(messages.body.map(item => item.content)).toEqual(['hello']);
    expect((await request(app).delete('/conversations/mine').set('Authorization', auth)).status).toBe(204);
    expect(mockTables.Conversations.has('mine')).toBe(false);
    expect([...mockTables.Messages.values()].some(item => item.conversationId === 'mine')).toBe(false);
    expect(mockTables.Conversations.get('foreign').ownerId).toBe('bob');
  });
  test('attachment paths enforce the same owner boundary, including encoded paths', async () => {
    for (const url of [attachment, '/uploads/%6fwnership-fixture.txt']) {
      const foreign = await request(app).get(url).set('Authorization', authorization('alice'));
      expect(foreign.status).toBe(404);
      const owner = await request(app).get(url).set('Authorization', authorization('bob'));
      expect(owner.status).toBe(200);
      expect(owner.body.toString()).toBe('private attachment');
      expect(owner.headers['cache-control']).toContain('no-store');
      expect(owner.headers['content-disposition']).toBe('attachment');
    }
    expect((await request(app).get(attachment).set('x-api-key', process.env.API_KEY)).status).toBe(401);
  });

  test('conditional model writes cannot rename, pin or delete another owner or a legacy row', async () => {
    const Conversation = require('../models/conversation');
    for (const id of ['foreign', 'legacy', 'missing']) {
      expect(await Conversation.rename(id, 'stolen', 'alice')).toBeNull();
      expect(await Conversation.pin(id, true, 'alice')).toBeNull();
      expect(await Conversation.remove(id, 'alice')).toBe(false);
    }
    expect(mockTables.Messages.get('secret').content).toBe('private');
    expect(mockTables.Conversations.get('foreign').title).toBe('Bobs private chat');
  });
});
