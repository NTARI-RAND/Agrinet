const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const marketplaceRoutes = require('../../marketplace/marketplace_routes');
const authMiddleware = require('../../middleware/authMiddleware');
const docClient = require('../../lib/dynamodbClient');
const { TRANSACTION_FIELDS } = require('../../marketplace/models/transaction');
const jwt = require('../../utils/jwt');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'transactions-test-secret';
process.env.API_KEY = 'shared-key';
const bearer = (userId) => `Bearer ${jwt.sign({ userId }, process.env.JWT_SECRET)}`;

const app = express();
app.use(express.json());
app.use('/', marketplaceRoutes);

// The same router behind the real middleware, as server.js mounts it.
const served = express();
served.use(express.json());
served.use(authMiddleware);
served.use('/', marketplaceRoutes);

let tables;
let scans;
let updates;
let gate;
let scanIgnoresFilter;
const copy = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const validation = (message) => Object.assign(new Error(message), { code: 'ValidationException' });
const RESERVED = new Set(['status', 'name', 'date', 'data', 'count', 'key', 'value', 'role', 'user', 'timestamp', 'location', 'type', 'comment', 'size']);

// Rejects what DynamoDB rejects: undefined or unused placeholders, bare reserved words.
function validate(expressions, names = {}, values = {}) {
  const text = expressions.filter(Boolean).join(' ');
  for (const token of text.match(/#\w+/g) || []) if (!(token in names)) throw validation(`undefined name ${token}`);
  for (const token of text.match(/:\w+/g) || []) if (!(token in values)) throw validation(`undefined value ${token}`);
  for (const token of Object.keys(names)) if (!(text.match(/#\w+/g) || []).includes(token)) throw validation(`unused name ${token}`);
  for (const token of Object.keys(values)) if (!(text.match(/:\w+/g) || []).includes(token)) throw validation(`unused value ${token}`);
  const bare = text.replace(/[#:]\w+/g, ' ').replace(/\b(attribute_not_exists|attribute_exists|if_not_exists|set|OR|AND)\b/g, ' ');
  for (const word of bare.match(/[A-Za-z_]\w*/g) || []) if (RESERVED.has(word.toLowerCase())) throw validation(`reserved keyword ${word}`);
}

function holds(expression, item, names = {}, values = {}) {
  const n = (token) => names[token] || token;
  return expression.split(/\s+OR\s+/).some((part) => part.split(/\s+AND\s+/).every((term) => {
    let m;
    if ((m = term.match(/^attribute_not_exists\(([#\w]+)\)$/))) return item[n(m[1])] === undefined;
    if ((m = term.match(/^attribute_exists\(([#\w]+)\)$/))) return item[n(m[1])] !== undefined;
    if ((m = term.match(/^([#\w]+)\s*=\s*(:\w+)$/))) return item[n(m[1])] !== undefined && JSON.stringify(item[n(m[1])]) === JSON.stringify(values[m[2]]);
    throw validation(`unsupported term ${term}`);
  }));
}

function applyUpdate(params) {
  updates.push(params);
  const { TableName, Key, UpdateExpression, ConditionExpression, ReturnValues = 'NONE',
    ExpressionAttributeNames = {}, ExpressionAttributeValues = {} } = params;
  validate([UpdateExpression, ConditionExpression], ExpressionAttributeNames, ExpressionAttributeValues);
  const item = copy(tables[TableName].get(Key.id)) || { id: Key.id };
  const name = (token) => ExpressionAttributeNames[token] || token;
  if (ConditionExpression && !holds(ConditionExpression, item, ExpressionAttributeNames, ExpressionAttributeValues)) {
    throw Object.assign(new Error('The conditional request failed'), { code: 'ConditionalCheckFailedException' });
  }
  const changed = {};
  for (const assignment of UpdateExpression.replace(/^set /, '').split(/,\s*(?![^()]*\))/)) {
    const [lhs, rhs] = assignment.split(/\s*=\s*/);
    const sum = rhs.match(/^if_not_exists\((\w+), (:\w+)\) \+ (:\w+)$/);
    item[name(lhs)] = sum
      ? (item[sum[1]] ?? ExpressionAttributeValues[sum[2]]) + ExpressionAttributeValues[sum[3]]
      : ExpressionAttributeValues[rhs];
    changed[name(lhs)] = item[name(lhs)];
  }
  tables[TableName].set(Key.id, item);
  if (ReturnValues === 'ALL_NEW') return { Attributes: copy(item) };
  if (ReturnValues === 'UPDATED_NEW') return { Attributes: copy(changed) };
  return {};
}

beforeEach(() => {
  tables = { Transactions: new Map(), Listings: new Map(), Users: new Map() };
  scans = [];
  updates = [];
  gate = null;
  scanIgnoresFilter = false;
  docClient.get = ({ TableName, Key }) => ({ promise: async () => {
    if (gate && TableName === 'Transactions') {
      await new Promise((resolve) => {
        gate.waiting.push(resolve);
        if (gate.waiting.length === gate.size) { gate.waiting.forEach((r) => r()); gate = null; }
      });
    }
    return { Item: copy(tables[TableName].get(Key.id)) };
  } });
  docClient.put = ({ TableName, Item }) => ({ promise: async () => { tables[TableName].set(Item.id, copy(Item)); return {}; } });
  docClient.update = (params) => ({ promise: async () => applyUpdate(params) });
  // One stored row per page, filtered and projected per page as DynamoDB does,
  // so a page can come back empty with a LastEvaluatedKey.
  docClient.scan = (params) => ({
    promise: async () => {
      scans.push(params);
      const { FilterExpression, ProjectionExpression, ExpressionAttributeNames: names = {}, ExpressionAttributeValues: values = {} } = params;
      validate([FilterExpression, ProjectionExpression], names, values);
      const rows = [...tables[params.TableName].values()];
      const index = params.ExclusiveStartKey ? rows.findIndex((row) => row.id === params.ExclusiveStartKey.id) + 1 : 0;
      let page = rows.slice(index, index + 1);
      if (FilterExpression && !scanIgnoresFilter) page = page.filter((row) => holds(FilterExpression, row, names, values));
      if (ProjectionExpression && !scanIgnoresFilter) {
        const fields = ProjectionExpression.split(/,\s*/).map((t) => names[t] || t);
        page = page.map((row) => Object.fromEntries(fields.filter((f) => f in row).map((f) => [f, row[f]])));
      }
      return { Items: copy(page), LastEvaluatedKey: index + 1 < rows.length ? { id: rows[index].id } : undefined };
    }
  });
  tables.Listings.set('listing-1', { id: 'listing-1', userId: 'seller-1', title: 'Tomato seedlings' });
  tables.Listings.set('listing-legacy', { id: 'listing-legacy', userId: '', title: 'Old row' });
  tables.Transactions.set('tx-1', {
    id: 'tx-1', buyerId: 'buyer-1', sellerId: 'seller-1', listingTitle: 'Tomato seedlings',
    buyerRated: false, sellerRated: false, dialogNotes: 'pickup at noon', escrowLocked: true
  });
  tables.Transactions.set('tx-2', { id: 'tx-2', buyerId: 'buyer-2', sellerId: 'seller-2', dialogNotes: 'private' });
  tables.Transactions.set('tx-3', { id: 'tx-3', buyerId: 'seller-2', sellerId: 'buyer-1', internalNote: 'not a field' });
});

test('reading transactions needs a signed-in account', async () => {
  assert.equal((await request(app).get('/transactions')).status, 401);
  assert.equal((await request(app).get('/transactions').set('Authorization', 'Bearer forged.token.value')).status, 401);
  const wrongKey = `Bearer ${jwt.sign({ userId: 'buyer-1' }, 'not-the-secret')}`;
  assert.equal((await request(app).get('/transactions').set('Authorization', wrongKey)).status, 401);
  assert.equal(scans.length, 0);
});

test('the shared API key never names an account on any route', async () => {
  const snapshot = JSON.stringify([...tables.Transactions], null, 0) + JSON.stringify([...tables.Users]);
  const as = { userId: 'buyer-1', buyerId: 'buyer-1' };
  for (const [verb, path, body] of [
    ['get', '/transactions', as],
    ['post', '/transactions', { ...as, listingId: 'listing-1' }],
    ['post', '/listings', { ...as, t: 'x', c: 'y', d: 'z' }],
    ['post', '/transactions/rate', { ...as, transactionId: 'tx-1', rating: 4 }],
    ['post', '/transactions/release-escrow', { ...as, transactionId: 'tx-1' }],
    ['post', '/transactions/dialog-validate', { ...as, transactionId: 'tx-1', dialogNotes: 'tomato seedlings' }],
    ['post', '/transactions/ping', { ...as, transactionId: 'tx-1' }],
  ]) {
    const response = await request(served)[verb](path).query({ userId: 'buyer-1' })
      .set('x-api-key', 'shared-key').send(body);
    assert.equal(response.status, 401, path);
  }
  assert.equal(JSON.stringify([...tables.Transactions], null, 0) + JSON.stringify([...tables.Users]), snapshot);
  assert.equal(tables.Listings.size, 2);
  assert.equal(scans.length, 0);
  // A Bearer token through the real middleware still works.
  assert.equal((await request(served).get('/transactions').set('Authorization', bearer('buyer-1'))).status, 200);
});

test('a reader gets only their own transactions, across every page, with known fields only', async () => {
  const response = await request(app).get('/transactions').set('Authorization', bearer('buyer-1'));
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.map((t) => t.id).sort(), ['tx-1', 'tx-3']);
  assert.ok(response.body.every((t) => !('internalNote' in t)));
  assert.equal(scans.length, 3);
  assert.equal(scans[0].FilterExpression, 'buyerId = :me OR sellerId = :me');
  assert.deepEqual(scans[0].ExpressionAttributeValues, { ':me': 'buyer-1' });
  const projected = scans[0].ProjectionExpression.split(/,\s*/).map((t) => scans[0].ExpressionAttributeNames[t] || t);
  assert.deepEqual(projected.sort(), [...TRANSACTION_FIELDS].sort());
  assert.equal(scans[0].ExclusiveStartKey, undefined);
  assert.deepEqual(scans[1].ExclusiveStartKey, { id: 'tx-1' });
});

test('the route filters and trims even if the scan returns other rows', async () => {
  scanIgnoresFilter = true;
  const response = await request(app).get('/transactions').set('Authorization', bearer('buyer-1'));
  assert.deepEqual(response.body.map((t) => t.id).sort(), ['tx-1', 'tx-3']);
  assert.ok(response.body.every((t) => !('internalNote' in t)));
});

test('a new transaction takes the buyer from the token and the seller and title from the listing', async () => {
  const response = await request(app).post('/transactions').set('Authorization', bearer('buyer-3'))
    .send({ listingId: 'listing-1', buyerId: 'victim', sellerId: 'victim-2', listingTitle: 'anything', escrowLocked: false, buyerRated: true });
  assert.equal(response.status, 201);
  const stored = tables.Transactions.get(response.body.transaction.id);
  assert.equal(stored.buyerId, 'buyer-3');
  assert.equal(stored.sellerId, 'seller-1');
  assert.equal(stored.listingTitle, 'Tomato seedlings');
  assert.equal(stored.escrowLocked, true);
  assert.equal(stored.buyerRated, false);
});

test('a new transaction needs a real, owned listing that is not the buyer\'s own', async () => {
  const auth = bearer('seller-1');
  assert.equal((await request(app).post('/transactions').set('Authorization', auth).send({})).status, 400);
  assert.equal((await request(app).post('/transactions').set('Authorization', auth).send({ listingId: 'missing' })).status, 404);
  assert.equal((await request(app).post('/transactions').set('Authorization', auth).send({ listingId: 'listing-legacy' })).status, 404);
  assert.equal((await request(app).post('/transactions').set('Authorization', auth).send({ listingId: 'listing-1' })).status, 400);
  assert.equal((await request(app).post('/transactions').send({ listingId: 'listing-1' })).status, 401);
});

test('only a party can rate, release escrow, validate the dialog or ping', async () => {
  tables.Transactions.set('tx-4', { id: 'tx-4', buyerId: 'buyer-1', sellerId: 'seller-1', buyerRated: true, sellerRated: true, escrowLocked: true });
  const outsider = bearer('buyer-2');
  for (const [path, body] of [
    ['/transactions/rate', { transactionId: 'tx-1', rating: -1 }],
    ['/transactions/release-escrow', { transactionId: 'tx-4' }],
    ['/transactions/dialog-validate', { transactionId: 'tx-1', dialogNotes: 'tomato seedlings' }],
    ['/transactions/ping', { transactionId: 'tx-1' }],
  ]) {
    const response = await request(app).post(path).set('Authorization', outsider).send(body);
    assert.equal(response.status, 403, path);
  }
  assert.equal(tables.Users.size, 0);
  assert.equal(tables.Transactions.get('tx-1').dialogNotes, 'pickup at noon');
  assert.equal(tables.Transactions.get('tx-4').escrowLocked, true);
});

test('a party can validate the dialog', async () => {
  const response = await request(app).post('/transactions/dialog-validate').set('Authorization', bearer('seller-1'))
    .send({ transactionId: 'tx-1', dialogNotes: 'tomato seedlings ready' });
  assert.equal(response.status, 200);
  assert.equal(response.body.dialogConfirmed, true);
  assert.equal(tables.Transactions.get('tx-1').dialogNotes, 'tomato seedlings ready');
});

test('a party rates only as their own role, once, and the counterparty is the one rated', async () => {
  const buyer = bearer('buyer-1');
  assert.equal((await request(app).post('/transactions/rate').set('Authorization', buyer)
    .send({ transactionId: 'tx-1', rating: 4, role: 'seller' })).status, 403);
  assert.equal((await request(app).post('/transactions/rate').set('Authorization', buyer)
    .send({ transactionId: 'tx-1', rating: '4' })).status, 400);
  assert.equal((await request(app).post('/transactions/rate').set('Authorization', buyer)
    .send({ transactionId: 'tx-1', rating: 1.5 })).status, 400);

  const first = await request(app).post('/transactions/rate').set('Authorization', buyer)
    .send({ transactionId: 'tx-1', rating: 3 });
  assert.equal(first.status, 200);
  assert.equal(tables.Users.get('seller-1').reputationScore, 3);

  const again = await request(app).post('/transactions/rate').set('Authorization', buyer)
    .send({ transactionId: 'tx-1', rating: 3, role: 'buyer' });
  assert.equal(again.status, 400);
  assert.equal(tables.Users.get('seller-1').reputationScore, 3);
  assert.equal(tables.Transactions.get('tx-1').status, undefined);

  const seller = await request(app).post('/transactions/rate').set('Authorization', bearer('seller-1'))
    .send({ transactionId: 'tx-1', rating: 2 });
  assert.equal(seller.status, 200);
  assert.equal(tables.Users.get('buyer-1').reputationScore, 2);
  assert.equal(tables.Transactions.get('tx-1').status, 'completed');
  assert.equal(tables.Transactions.get('tx-1').ratingGiven, true);
});

test('two concurrent ratings by one party count once', async () => {
  gate = { waiting: [], size: 2 };
  const send = () => request(app).post('/transactions/rate').set('Authorization', bearer('buyer-1'))
    .send({ transactionId: 'tx-1', rating: 4 });
  const results = await Promise.all([send(), send()]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
  assert.equal(tables.Users.get('seller-1').reputationScore, 4);
});

test('a row naming one account as both parties cannot be self-rated', async () => {
  tables.Transactions.set('tx-5', { id: 'tx-5', buyerId: 'buyer-1', sellerId: 'buyer-1', buyerRated: false, sellerRated: false });
  const response = await request(app).post('/transactions/rate').set('Authorization', bearer('buyer-1'))
    .send({ transactionId: 'tx-5', rating: 4 });
  assert.equal(response.status, 403);
  assert.equal(tables.Users.size, 0);
  assert.equal(tables.Transactions.get('tx-5').buyerRated, false);
});

test('a party can release escrow once both sides have rated, and can ping', async () => {
  const seller = bearer('seller-1');
  assert.equal((await request(app).post('/transactions/release-escrow').set('Authorization', seller)
    .send({ transactionId: 'tx-1' })).status, 403);
  tables.Transactions.get('tx-1').buyerRated = true;
  tables.Transactions.get('tx-1').sellerRated = true;
  const released = await request(app).post('/transactions/release-escrow').set('Authorization', seller)
    .send({ transactionId: 'tx-1' });
  assert.equal(released.status, 200);
  assert.equal(tables.Transactions.get('tx-1').escrowLocked, false);
  const ping = await request(app).post('/transactions/ping').set('Authorization', bearer('buyer-1'))
    .send({ transactionId: 'tx-1' });
  assert.equal(ping.status, 200);
  assert.equal(ping.body.pingCount, 1);
});
