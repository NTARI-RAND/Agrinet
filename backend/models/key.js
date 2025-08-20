// DynamoDB does not require a schema or model definition like Mongoose.
// Use this file to export the table name and provide a helper for building key items if desired.

const KEY_TABLE_NAME = "Keys";
const docClient = require('../lib/dynamodbClient');

// Helper function to build a key item for DynamoDB
function createKeyItem({
  id, // You should generate a unique id for each key (e.g., uuid)
  userId,
  key,
  issuedAt = new Date().toISOString(),
  usageCount = 0,
  expiresAt // should be an ISO string
}) {
  return {
    id, // Partition key for DynamoDB table
    userId,
    key,
    issuedAt,
    usageCount,
    expiresAt
  };
}

async function putKey(item) {
  return docClient.put({ TableName: KEY_TABLE_NAME, Item: item }).promise();
}

async function getKeyByValue(keyValue) {
  const params = {
    TableName: KEY_TABLE_NAME,
    FilterExpression: '#k = :keyValue',
    ExpressionAttributeNames: { '#k': 'key' },
    ExpressionAttributeValues: { ':keyValue': keyValue }
  };
    IndexName: KEY_GSI_NAME,
    KeyConditionExpression: '#k = :keyValue',
    ExpressionAttributeNames: { '#k': 'key' },
    ExpressionAttributeValues: { ':keyValue': keyValue }
  };
  const data = await docClient.query(params).promise();
  return data.Items ? data.Items[0] : undefined;
}

async function updateKey(id, attributes) {
  const keys = Object.keys(attributes);
  const ExpressionAttributeNames = {};
  const ExpressionAttributeValues = {};
  const updates = keys.map((attr) => {
    ExpressionAttributeNames[`#${attr}`] = attr;
    ExpressionAttributeValues[`:${attr}`] = attributes[attr];
    return `#${attr} = :${attr}`;
  });

  const params = {
    TableName: KEY_TABLE_NAME,
    Key: { id },
    UpdateExpression: `set ${updates.join(', ')}`,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  };

  const data = await docClient.update(params).promise();
  return data.Attributes;
}

module.exports = {
  KEY_TABLE_NAME,
  createKeyItem,
  putKey,
  getKeyByValue,
  updateKey
};
