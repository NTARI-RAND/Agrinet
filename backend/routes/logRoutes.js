const express = require('express');
const router = express.Router();
const docClient = require('../lib/dynamodbClient');
const {
  TRANSACTION_LOG_TABLE_NAME,
  createTransactionLogItem
} = require('../models/transactionLog');
const authMiddleware = require('../middleware/authMiddleware');

// Store a new transaction log entry
router.post('/logs', authMiddleware, async (req, res) => {
  try {
    const { transactionId, actorId, action, note } = req.body;
    const item = createTransactionLogItem({ transactionId, actorId, action, note });
    await docClient.put({ TableName: TRANSACTION_LOG_TABLE_NAME, Item: item }).promise();
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: 'Error saving log' });
  }
});

// Retrieve logs for a given transaction
router.get('/logs', authMiddleware, async (req, res) => {
  try {
    const { transactionId } = req.query;
    if (!transactionId) {
      return res.status(400).json({ error: 'transactionId query param required' });
    }
    const params = {
      TableName: TRANSACTION_LOG_TABLE_NAME,
      KeyConditionExpression: 'transactionId = :tid',
      ExpressionAttributeValues: { ':tid': transactionId },
      ScanIndexForward: false
    };
    const result = await docClient.query(params).promise();
    res.json(result.Items);
  } catch (error) {
    res.status(500).json({ error: 'Error retrieving logs' });
  }
});

module.exports = router;
