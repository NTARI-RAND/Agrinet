const express = require('express');
const router = express.Router();
//const crypto = require('crypto');
//const Notification = require('../models/notifications');
const { randomUUID } = require('crypto');
const docClient = require('../lib/dynamodbClient');
const { addPingJob } = require('../bull/pingJobs');
const { TRANSACTION_TABLE_NAME } = require('../marketplace/models/transaction');
const { NOTIFICATION_TABLE_NAME, createNotificationItem } = require('../models/notifications');

// POST /api/transactions - create a new transaction and send notification
router.post('/transactions', async (req, res) => {
  try {
    const transactionData = req.body;
    //const id = crypto.randomUUID();
    const transactionId = randomUUID();
    const createdAt = new Date().toISOString();
    const transactionItem = {
    /*
    await docClient.put({ TableName: TRANSACTION_TABLE_NAME, Item: item }).promise();

    await Notification.create({
      userId: item.buyerId || item.consumerId,
      message: `Your transaction ${id} has been initiated.`
    });

    addPingJob(id);
    */
      buyerId: transactionData.buyerId, // Partition key
      transactionId,                    // Sort key
      sellerId: transactionData.sellerId,
      listingId: transactionData.listingId,
      status: 'pending',
      createdAt,
      lastPing: createdAt
    };

    await docClient.put({
      TableName: TRANSACTION_TABLE_NAME,
      Item: transactionItem
    }).promise();

    const notificationItem = createNotificationItem({
      userId: transactionItem.buyerId,
      notificationId: randomUUID(),
      message: `Your transaction ${transactionId} has been initiated.`
    });

    await docClient.put({
      TableName: NOTIFICATION_TABLE_NAME,
      Item: notificationItem
    }).promise();

    addPingJob(transactionItem.buyerId, transactionId);

    res.status(201).json({ message: 'Transaction created and notification sent.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
