let AWS;
let docClient;
try {
  AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });
  docClient = new AWS.DynamoDB.DocumentClient();
} catch (e) {
  console.warn('aws-sdk not installed; using in-memory stub for DynamoDB');
  const stub = () => ({ promise: async () => ({}) });
  docClient = {
    get: stub,
    put: stub,
    update: stub,
    query: () => ({ promise: async () => ({ Items: [] }) }),
    scan: () => ({ promise: async () => ({ Items: [] }) }),
    delete: stub
  };
}

module.exports = docClient;
