const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

function createMock() {
  const fn = (...args) => {
    fn.calls.push(args);
  };
  fn.calls = [];
  return fn;
}

const listingMock = { updateOne: createMock() };
const transactionMock = { updateOne: createMock() };
const userMock = { updateOne: createMock() };

const listingsPath = path.resolve(__dirname, '../marketplace/models/listings.js');
const transactionPath = path.resolve(__dirname, '../models/transaction.js');
const userPath = path.resolve(__dirname, '../models/user.js');

require.cache[listingsPath] = { id: listingsPath, filename: listingsPath, loaded: true, exports: listingMock };
require.cache[transactionPath] = { id: transactionPath, filename: transactionPath, loaded: true, exports: transactionMock };
require.cache[userPath] = { id: userPath, filename: userPath, loaded: true, exports: userMock };

const { importFederatedData } = require('./importHelper');

test('imports listings, transactions, and users', async () => {
  const listing = { _id: 'l1', name: 'Listing 1' };
  const transaction = { _id: 't1', total: 100 };
  const user = { _id: 'u1', name: 'User 1' };

  await importFederatedData({
    listings: [listing],
    transactions: [transaction],
    users: [user],
  });

  assert.deepStrictEqual(listingMock.updateOne.calls[0], [
    { _id: listing._id },
    { $set: listing },
    { upsert: true },
  ]);
  assert.strictEqual(transactionMock.updateOne.calls.length, 1);
  assert.strictEqual(userMock.updateOne.calls.length, 1);
});
