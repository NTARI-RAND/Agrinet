const test = require('node:test');
const assert = require('node:assert/strict');

const docClient = require('../../lib/dynamodbClient');
const { memoryUserTables } = require('../../test-support/memoryUserTables');
const { claimExistingEmails, createUserWithEmail, findUserByEmail } = require('../userEmail');

function withUsers(users) {
  const db = memoryUserTables();
  for (const user of users) db.tables.Users.set(user.id, user);
  Object.assign(docClient, db);
  return db;
}

test('refuses to replace an existing account and leaves its email claim alone', async () => {
  const db = withUsers([]);
  assert.equal(await createUserWithEmail({ id: 'u1', email: 'ann@example.com' }), true);

  await assert.rejects(createUserWithEmail({ id: 'u1', email: 'bob@example.com' }), {
    code: 'TransactionCanceledException',
  });
  assert.deepEqual([...db.tables.UserEmails.values()], [{ email: 'ann@example.com', userId: 'u1' }]);
  assert.deepEqual(db.tables.Users.get('u1'), { id: 'u1', email: 'ann@example.com' });
});

test('finds the claimed user with strongly consistent reads', async () => {
  const db = withUsers([{ id: 'u1', email: 'ann@example.com' }]);
  db.tables.UserEmails.set('ann@example.com', { email: 'ann@example.com', userId: 'u1' });
  const reads = [];
  docClient.get = (params) => { reads.push(params); return db.get(params); };

  assert.equal((await findUserByEmail(' ANN@example.com ')).id, 'u1');
  assert.deepEqual(reads.map(({ ConsistentRead }) => ConsistentRead), [true, true]);
});

test('claims normalised emails from every scan page and is safe to re-run', async () => {
  const db = withUsers([
    { id: 'u1', email: ' Ann@Example.com' },
    { id: 'u2', email: 'bob@example.com' },
    { id: 'u3' },
  ]);

  assert.deepEqual(await claimExistingEmails(), { claimed: 2, alreadyClaimed: 0, needsReview: [] });
  assert.deepEqual(db.tables.UserEmails.get('ann@example.com'), { email: 'ann@example.com', userId: 'u1' });
  assert.deepEqual(db.tables.UserEmails.get('bob@example.com'), { email: 'bob@example.com', userId: 'u2' });
  assert.deepEqual(await claimExistingEmails(), { claimed: 0, alreadyClaimed: 2, needsReview: [] });
});

test('leaves an email shared by several accounts unclaimed and reports their ids', async () => {
  const db = withUsers([
    { id: 'u1', email: 'john@example.com' },
    { id: 'u2', email: 'JOHN@example.com ' },
  ]);

  assert.deepEqual(await claimExistingEmails(), { claimed: 0, alreadyClaimed: 0, needsReview: [['u1', 'u2']] });
  assert.equal(db.tables.UserEmails.size, 0);
});

test('reports an email already claimed by a different account', async () => {
  const db = withUsers([{ id: 'u2', email: 'carl@example.com' }]);
  db.tables.UserEmails.set('carl@example.com', { email: 'carl@example.com', userId: 'u9' });

  assert.deepEqual(await claimExistingEmails(), { claimed: 0, alreadyClaimed: 0, needsReview: [['u9', 'u2']] });
  assert.equal(db.tables.UserEmails.get('carl@example.com').userId, 'u9');
});
