let Queue, Worker, docClient, TRANSACTION_TABLE_NAME;
try {
  ({ Queue, Worker } = require('bullmq'));
  docClient = require('../lib/dynamodbClient');
  ({ TRANSACTION_TABLE_NAME } = require('../marketplace/models/transaction'));
} catch (e) {
  Queue = class { add() {} };
  Worker = class {};
  docClient = null;
}

const connection = {
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
};

const pingQueue = new Queue('ping-deadline', { connection });

const addPingJob = (buyerId, transactionId) => {
  pingQueue.add('checkPing', { buyerId, transactionId }, { delay: 24 * 60 * 60 * 1000 }); // 24h delay
};

if (docClient) {
  new Worker(
    'ping-deadline',
    async job => {
      const { buyerId, transactionId } = job.data;
      const params = {
        TableName: TRANSACTION_TABLE_NAME,
        Key: { buyerId, transactionId }
      };
      const { Item: transaction } = await docClient.get(params).promise();
      if (!transaction) return;

      const now = new Date();
      const pingAge = now - new Date(transaction.lastPing);

      if (pingAge > 3 * 24 * 60 * 60 * 1000) {
        if (global.broadcast) {
          global.broadcast('ping-overdue', {
            transactionId,
            message: '🚨 A transaction has not been updated in 3+ days',
          });
        }
      }
    },
    { connection }
  );
}

module.exports = { addPingJob };
