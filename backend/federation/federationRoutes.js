const express = require('express');
const router = express.Router();
const docClient = require('../lib/dynamodbClient');
const { LISTING_TABLE_NAME } = require('../models/listing');
const { TRANSACTION_TABLE_NAME } = require('../models/transaction');
const { USER_TABLE_NAME } = require('../models/user');
const { importFederatedData } = require('../sync/importHelper');

// Export route for peer sync
router.get('/export', async (req, res) => {
  try {
    const listingsRes = await docClient.scan({ TableName: LISTING_TABLE_NAME }).promise();
    const transactionsRes = await docClient.scan({ TableName: TRANSACTION_TABLE_NAME }).promise();
    const usersRes = await docClient.scan({ TableName: USER_TABLE_NAME }).promise();
    res.json({
      listings: listingsRes.Items || [],
      transactions: transactionsRes.Items || [],
      users: usersRes.Items || []
    });
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// Import route for federation sync
router.post('/import', async (req, res) => {
  try {
    await importFederatedData(req.body);

    res.json({ message: 'Import successful' });
  } catch (err) {
    res.status(500).json({ error: 'Import failed' });
  }
});

module.exports = router;
