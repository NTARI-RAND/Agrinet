const crypto = require('crypto');
const docClient = require('../lib/dynamodbClient');
const { TRANSACTION_TABLE_NAME, createTransactionItem } = require('../models/transaction');
const { logTransactionEvent } = require('../utils/logHelper');
const { USER_TABLE_NAME } = require('../models/user');
const { calculateReputationScore } = require('../utils/reputation');

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
    const { transactionId, rating, raterId, feedback = '' } = req.body;
    if (rating < -1 || rating > 4) {
      return res.status(400).json({ error: 'Invalid rating value' });
    }

    // Retrieve transaction to determine the ratee
    const { Item: transaction } = await docClient
      .get({ TableName: TRANSACTION_TABLE_NAME, Key: { id: transactionId } })
      .promise();

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    let rateeId;
    if (raterId === transaction.consumerId) {
      rateeId = transaction.producerId;
    } else if (raterId === transaction.producerId) {
      rateeId = transaction.consumerId;
    } else {
      return res.status(403).json({ error: 'Rater not part of transaction' });
    }

    const params = {
      TableName: TRANSACTION_TABLE_NAME,
      Key: { id: transactionId },
      UpdateExpression: 'set rating = :r, feedback = :f, #status = :s',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':r': rating,
        ':f': feedback,
        ':s': 'completed'
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await docClient.update(params).promise();

    // Update reputation of the ratee
    const [ratee, rater] = await Promise.all([
      docClient.get({ TableName: USER_TABLE_NAME, Key: { id: rateeId } }).promise(),
      docClient.get({ TableName: USER_TABLE_NAME, Key: { id: raterId } }).promise()
    ]);

    const rateeItem = ratee.Item || {};
    const raterScore = rater.Item?.reputationScore || 0;
    const { score, weight } = calculateReputationScore({
      currentScore: rateeItem.reputationScore || 0,
      currentWeight: rateeItem.reputationWeight || 0,
      newRating: rating,
      raterScore
    });

    await docClient.update({
      TableName: USER_TABLE_NAME,
      Key: { id: rateeId },
      UpdateExpression: 'set reputationScore = :s, reputationWeight = :w',
      ExpressionAttributeValues: {
        ':s': score,
        ':w': weight
      }
    }).promise();

    await logTransactionEvent({
      transactionId,
      actorId: raterId,
      action: 'rating',
      note: `Rating: ${rating} Feedback: ${feedback}`
    });

    res.json({ message: 'Rating submitted successfully', data: result.Attributes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
