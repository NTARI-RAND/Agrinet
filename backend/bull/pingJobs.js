const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const Transaction = require('../models/Transaction');

const pingQueue = new Queue('ping-deadline', {
  connection: new Redis()
});

const addPingJob = (transactionId) => {
  pingQueue.add('checkPing', { transactionId }, { delay: 24 * 60 * 60 * 1000 }); // 24h delay
};

const worker = new Worker('ping-deadline', async job => {
  const { transactionId } = job.data;
  const transaction = await Transaction.findById(transactionId);

  const now = new Date();
  const pingAge = now - new Date(transaction.lastPing);

  if (pingAge > 3 * 24 * 60 * 60 * 1000) {
    global.io.emit("ping-overdue", {
      transactionId,
      message: "🚨 A transaction has not been updated in 3+ days"
    });
  }
}, {
  connection: new Redis()
});

module.exports = { addPingJob };
