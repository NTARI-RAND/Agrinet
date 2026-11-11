// Disposable local-storage check. No production endpoint or data is accepted.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DynamoDBClient, CreateTableCommand, DeleteTableCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocument, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const express = require('express');
const jwt = require('jsonwebtoken');

async function checkAuthenticationBudget(base) {
  for (let i = 0; i < 1001; i++) {
    const response = await fetch(`${base}/users`, { headers: { Authorization: 'Bearer invalid' } });
    await response.text();
    if (response.status === 429) {
      assert.ok(Number(response.headers.get('retry-after')) > 0);
      return;
    }
    assert.equal(response.status, 401);
  }
  assert.fail('verification server authentication attempts must be rate limited');
}

async function main() {
  const endpoint = new URL(process.env.DYNAMODB_ENDPOINT);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)) throw new Error('DynamoDB Local loopback endpoint required');
  process.env.AWS_ACCESS_KEY_ID = 'localcheck';
  process.env.AWS_SECRET_ACCESS_KEY = 'localcheck';
  process.env.AWS_REGION = 'us-east-1';
  process.env.JWT_SECRET = randomUUID();
  process.env.API_KEY = randomUUID();
  const peerSecret = randomUUID();
  process.env.FEDERATION_LOCAL_NODE_ID = 'local-check';
  process.env.FEDERATION_PEERS_JSON = JSON.stringify({ 'local-check': peerSecret });
  process.env.FEDERATION_OUTBOUND_PEERS_JSON = JSON.stringify({ 'local-check': peerSecret });
  const admin = new DynamoDBClient({ endpoint: endpoint.href, region: 'us-east-1', credentials: { accessKeyId: 'localcheck', secretAccessKey: 'localcheck' } });
  const store = DynamoDBDocument.from(admin);
  const prefix = `CollectionPages_${randomUUID().replaceAll('-', '')}`;
  const tables = Object.fromEntries(['Conversations', 'Users', 'Listings', 'Transactions'].map(name => [name, `${prefix}_${name}`]));
  process.env.CONVERSATION_TABLE_NAME = tables.Conversations;
  const created = [];
  let server;
  try {
    for (const TableName of Object.values(tables)) {
      await admin.send(new CreateTableCommand({ TableName, BillingMode: 'PAY_PER_REQUEST',
        KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }], AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
      }));
      created.push(TableName);
    }
    const put = (table, Item) => store.send(new PutCommand({ TableName: tables[table], Item }));
    for (let i = 0; i < 8; i++) {
      await put('Conversations', { id: `c${i}`, ownerId: i % 2 ? 'alice' : 'bob', title: 'private'.repeat(33000) });
      await put('Users', { id: `u${i}`, username: `member${i}`, role: i % 2 ? 'producer' : 'consumer', locationType: i % 2 ? 'farm' : 'delivery', reputationScore: 99, reputationWeight: 1000, location: 'Town', locationPrivacy: i % 2 === 1,
        password: 'private hash', verificationCode: 'private code', email: 'private@example.invalid', coordinates: { lat: 1, long: 2 }, privatePadding: 'x'.repeat(230000) });
      await put('Listings', { id: `l${i}`, userId: `u${i}`, title: `Public listing ${i}`, description: 'advertised text'.repeat(16000), price: i + 1, privateExtra: 'not an advertised field' });
      await put('Transactions', { id: `t${i}`, buyerId: 'alice', sellerId: 'bob', status: 'pending', dialogNotes: 'local narrative'.repeat(15000) });
    }
    await put('Conversations', { id: 'legacy', title: 'no owner' });

    const db = require('../lib/dynamodbClient');
    const scan = db.scan;
    const scans = [];
    // Only substitute isolated table names. The production SDK adapter, scan
    // limit, filters, projections and continuation keys all remain real.
    db.scan = params => {
      scans.push(params);
      return scan({ ...params, TableName: tables[params.TableName] || params.TableName });
    };
    const app = express();
    app.use(express.json());
    app.use('/federation', require('../federation/federationRoutes'));
    app.use(require('../middleware/requestRateLimit')(), require('../middleware/authMiddleware'));
    app.use('/conversations', require('../routes/conversationRoutes'));
    app.use('/users', require('../routes/userRoutes'));
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const token = jwt.sign({ userId: 'alice' }, process.env.JWT_SECRET, { expiresIn: '2h' });
    const headers = { Authorization: `Bearer ${token}` };
    async function collect(path) {
      const result = [];
      let cursor;
      let pages = 0;
      do {
        const response = await fetch(`${base}${path}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { headers, redirect: 'error' });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('X-Pagination'), 'cursor-v1');
        result.push(...await response.json());
        cursor = response.headers.get('X-Next-Cursor');
        assert.ok(++pages < 30);
      } while (cursor);
      return { result, pages };
    }
    const directory = await collect('/users?limit=100');
    assert.ok(directory.pages > 1, 'the 1 MiB scan boundary must require continuation even with a projection');
    assert.equal(directory.result.length, 8);
    for (const user of directory.result) {
      assert.deepEqual(Object.keys(user).sort(), ['id', 'username', 'role', 'locationType', ...(Number(user.id.slice(1)) % 2 ? ['location'] : [])].sort());
    }
    const byType = await collect('/users?limit=1&locationType=delivery');
    assert.deepEqual(byType.result.map(user => user.id).sort(), ['u0', 'u2', 'u4', 'u6']);
    assert.ok(byType.result.every(user => !Object.hasOwn(user, 'location') && !Object.hasOwn(user, 'reputationScore') && !Object.hasOwn(user, 'reputationWeight')));
    const filtered = await collect('/users?limit=1&role=producer&location=Town');
    assert.deepEqual(filtered.result.map(user => user.id).sort(), ['u1', 'u3', 'u5', 'u7']);
    const { createAccountClient } = await import('../../frontend/chat-ui/src/accountClient.mjs');
    const client = createAccountClient({ baseUrl: base });
    client.setToken(token);
    const conversations = await client.request('GET', '/conversations?limit=100');
    assert.deepEqual(conversations.map(item => item.id).sort(), ['c1', 'c3', 'c5', 'c7']);
    const first = await fetch(`${base}/conversations?limit=1`, { headers });
    const cursor = first.headers.get('X-Next-Cursor');
    assert.ok(cursor);
    const foreign = await fetch(`${base}/conversations?limit=1&cursor=${cursor}`, { headers: { Authorization: `Bearer ${jwt.sign({ userId: 'bob' }, process.env.JWT_SECRET)}` } });
    assert.equal(foreign.status, 400);

    const { forEachExportPage, inspectExport } = require('../sync/exportPages');
    const peer = { nodeId: 'local-check', url: base };
    const exported = { listings: [], transactions: [], users: [] };
    let exportPages = 0;
    await forEachExportPage(peer, page => {
      exportPages++;
      for (const name of Object.keys(exported)) exported[name].push(...page[name]);
    });
    assert.ok(exportPages > 1);
    assert.deepEqual(exported.listings.map(item => item.id).sort(), Array.from({ length: 8 }, (_, i) => `l${i}`));
    assert.deepEqual(exported.transactions.map(item => item.id).sort(), Array.from({ length: 8 }, (_, i) => `t${i}`));
    assert.deepEqual(exported.users, []);
    assert.ok(exported.listings.every(item => !Object.hasOwn(item, 'privateExtra')));
    assert.ok(exported.transactions.every(item => !Object.hasOwn(item, 'dialogNotes')));
    assert.deepEqual(await inspectExport(peer), { listings: 8, transactions: 8, users: 0 });
    assert.equal((await store.send(new GetCommand({ TableName: tables.Users, Key: { id: 'u0' } }))).Item.password, 'private hash');
    assert.ok((await store.send(new GetCommand({ TableName: tables.Transactions, Key: { id: 't0' } }))).Item.dialogNotes.length > 100000);
    assert.ok(scans.some(params => params.ExclusiveStartKey));
    assert.ok(scans.every(params => params.Limit > 0 && params.Limit <= 100));
    await checkAuthenticationBudget(base);
    console.log('PASS: real DynamoDB 1 MiB continuation, ownership, private projections, filters, browser adapter, read-only exports and unchanged local records');
  } finally {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    for (const TableName of created) await admin.send(new DeleteTableCommand({ TableName }));
    admin.destroy();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
