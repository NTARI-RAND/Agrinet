const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const docClient = require('../lib/dynamodbClient');
const { TRANSACTION_TABLE_NAME, createTransactionItem } = require('../models/transaction');
const { logTransactionEvent } = require('../utils/logHelper');

router.post('/transactions', async (req, res) => {
  try {
    const { contractId, consumerId, producerId } = req.body;
    const id = crypto.randomUUID();
    const item = createTransactionItem({ id, contractId, consumerId, producerId });
    await docClient.put({ TableName: TRANSACTION_TABLE_NAME, Item: item }).promise();

    global.io.emit('new-transaction', {
      transactionId: id,
      buyerId: consumerId
    });

    await logTransactionEvent({ transactionId: id, actorId: consumerId, action: 'create', note: 'Transaction initiated' });

    res.status(201).json({ message: 'Transaction initiated', transaction: item });
  } catch (error) {
    res.status(500).json({ error: 'Error initiating transaction' });
  }
});

module.exports = router;
