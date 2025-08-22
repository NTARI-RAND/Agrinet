const express = require('express');
const router = express.Router();
const docClient = require('../lib/dynamodbClient');
const { LISTING_TABLE_NAME } = require('../models/listing');
const { TRANSACTION_TABLE_NAME } = require('../models/transaction');
const { USER_TABLE_NAME } = require('../models/user');

// Export core objects
router.get('/export', async (req, res) => {
  try {
    const listingsRes = await docClient.scan({ TableName: LISTING_TABLE_NAME }).promise();
    const transactionsRes = await docClient.scan({ TableName: TRANSACTION_TABLE_NAME }).promise();
    const usersRes = await docClient
      .scan({
        TableName: USER_TABLE_NAME,
        ProjectionExpression: 'id, email, reputationScore, role'
      })
      .promise();

    res.json({
      listings: listingsRes.Items || [],
      transactions: transactionsRes.Items || [],
      users: usersRes.Items || []
    });
  } catch (error) {
    res.status(500).json({ error: 'Export error' });
  }
});

// Import core objects
router.post('/import', async (req, res) => {
  try {
    const { listings = [], transactions = [], users = [] } = req.body;

    const putAll = async (items, TableName) => {
      for (const item of items) {
        await docClient.put({ TableName, Item: item }).promise();
      }
    };

    await putAll(listings, LISTING_TABLE_NAME);
    await putAll(transactions, TRANSACTION_TABLE_NAME);
    await putAll(users, USER_TABLE_NAME);

    res.json({ message: 'Data imported successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Import error' });
  }
});

module.exports = router;
