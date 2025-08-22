const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

function createModelStub() {
  const calls = [];
  return {
    calls,
    stub: {
      updateOne: async (filter, update, options) => {
        calls.push({ filter, update, options });
      },
    },
  };
}

const listing = createModelStub();
const transaction = createModelStub();
const user = createModelStub();

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request.endsWith(path.join('models', 'listing'))) return listing.stub;
  if (request.endsWith(path.join('models', 'transaction'))) return transaction.stub;
  if (request.endsWith(path.join('models', 'user'))) return user.stub;
  return originalLoad(request, parent, isMain);
};

const { importFederatedData } = require('../importHelper');
Module._load = originalLoad;

test('importFederatedData upserts listings, transactions, and users', async () => {
  const data = {
    listings: [
      { _id: 'listing1', name: 'Listing One' },
      { _id: 'listing2', name: 'Listing Two' },
    ],
    transactions: [
      { _id: 'txn1', amount: 100 },
      { _id: 'txn2', amount: 200 },
    ],
    users: [
      { _id: 'user1', username: 'User One' },
      { _id: 'user2', username: 'User Two' },
    ],
  };

  const result = await importFederatedData(data);

  assert.equal(listing.calls.length, 2);
  assert.deepEqual(listing.calls[0].filter, { _id: 'listing1' });
  assert.deepEqual(listing.calls[1].filter, { _id: 'listing2' });
  assert.deepEqual(listing.calls[0].options, { upsert: true });
  assert.deepEqual(listing.calls[1].options, { upsert: true });

  assert.equal(transaction.calls.length, 2);
  assert.deepEqual(transaction.calls[0].filter, { _id: 'txn1' });
  assert.deepEqual(transaction.calls[1].filter, { _id: 'txn2' });
  assert.deepEqual(transaction.calls[0].options, { upsert: true });
  assert.deepEqual(transaction.calls[1].options, { upsert: true });

  assert.equal(user.calls.length, 2);
  assert.deepEqual(user.calls[0].filter, { _id: 'user1' });
  assert.deepEqual(user.calls[1].filter, { _id: 'user2' });
  assert.deepEqual(user.calls[0].options, { upsert: true });
  assert.deepEqual(user.calls[1].options, { upsert: true });

  assert.deepEqual(result, { success: true });
});
