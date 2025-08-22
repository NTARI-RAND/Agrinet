const Listing = require("../marketplace/models/listings");
const Transaction = require("../models/transaction");
const User = require("../models/user");
const docClient = require('../lib/dynamodbClient');
const { LISTING_TABLE_NAME } = require('../models/listing');
const { TRANSACTION_TABLE_NAME } = require('../models/transaction');
const { USER_TABLE_NAME } = require('../models/user');

async function importFederatedData(data) {
  for (const listing of data.listings || []) {
    await docClient.put({ TableName: LISTING_TABLE_NAME, Item: listing }).promise();
  }
  for (const transaction of data.transactions || []) {
    await docClient.put({ TableName: TRANSACTION_TABLE_NAME, Item: transaction }).promise();
  }
  for (const user of data.users || []) {
    await docClient.put({ TableName: USER_TABLE_NAME, Item: user }).promise();
  }
  return { success: true };
}

module.exports = { importFederatedData };
