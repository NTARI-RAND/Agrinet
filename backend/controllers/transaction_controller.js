const crypto = require('crypto');
const docClient = require('../lib/dynamodbClient');
const { TRANSACTION_TABLE_NAME, createTransactionItem } = require('../models/transaction');
const { logTransactionEvent } = require('../utils/logHelper');

exports.createTransaction = async (req, res) => {
  try {
    const { contractId, consumerId, producerId } = req.body;
    const id = crypto.randomUUID();
    const item = createTransactionItem({ id, contractId, consumerId, producerId });

    await docClient.put({ TableName: TRANSACTION_TABLE_NAME, Item: item }).promise();
    await logTransactionEvent({ transactionId: id, actorId: consumerId, action: 'create', note: 'Transaction created' });

    res.status(201).json({ message: 'Transaction created', data: item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.submitRating = async (req, res) => {
  try {
    const { transactionId, rating } = req.body;
    if (rating < -1 || rating > 4) {
      return res.status(400).json({ error: 'Invalid rating value' });
    }

    const params = {
      TableName: TRANSACTION_TABLE_NAME,
      Key: { id: transactionId },
      UpdateExpression: 'set rating = :r, #status = :s',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':r': rating,
        ':s': 'completed'
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await docClient.update(params).promise();
    await logTransactionEvent({ transactionId, actorId: req.user?.id, action: 'rating', note: `Rating: ${rating}` });

    res.json({ message: 'Rating submitted successfully', data: result.Attributes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
