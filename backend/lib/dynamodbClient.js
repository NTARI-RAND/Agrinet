const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocument } = require('@aws-sdk/lib-dynamodb');

const client = DynamoDBDocument.from(new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT }),
}), { marshallOptions: { removeUndefinedValues: true } });

// Keep the request interface used by existing models while using the supported SDK.
module.exports = Object.fromEntries(
  ['get', 'put', 'update', 'delete', 'query', 'scan', 'batchWrite'].map((method) => [
    method, (params) => ({ promise: async () => {
      try {
        return await client[method](params);
      } catch (error) {
        error.code = error.name;
        throw error;
      }
    } }),
  ])
);
