const docClient = require('../lib/dynamodbClient');
const { LISTING_TABLE_NAME } = require('../models/listing');
const { TRANSACTION_TABLE_NAME } = require('../models/transaction');
const { USER_TABLE_NAME } = require('../models/user');

function sanitizeImportedUser(user, sourceNodeId) {
  if (!user || typeof user !== 'object' || Array.isArray(user)) {
    throw new Error('Invalid user entry in federated import');
  }
  if (typeof user.id !== 'string' || !user.id.trim()) {
    throw new Error('Federated user must have a remote user id');
  }
  if (typeof user.username !== 'string' || !user.username.trim()) {
    throw new Error('Federated user must have a username');
  }
  if (!sourceNodeId || typeof sourceNodeId !== 'string') {
    throw new Error('Authenticated federation source identity is required');
  }

  // Never spread an untrusted remote object into a local account record.
  // Role, password, contact details, verification state and unknown fields are omitted.
  return {
    id: user.id,
    username: user.username,
    ...(Number.isFinite(user.reputationScore) ? { reputationScore: user.reputationScore } : {}),
    ...(Number.isFinite(user.reputationWeight) ? { reputationWeight: user.reputationWeight } : {}),
    sourceNodeId,                 // Set from verified peer authentication, not request JSON.
    remoteUserId: user.id,        // Explicit identity at the authenticated remote node.
    originNodeId: typeof user.originNodeId === 'string' ? user.originNodeId : sourceNodeId,
    originUserId: typeof user.originUserId === 'string' ? user.originUserId : user.id
  };
}

async function importFederatedData(data, { sourceNodeId } = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Federation payload must be an object');
  }

  for (const listing of data.listings || []) {
    await docClient.put({ TableName: LISTING_TABLE_NAME, Item: listing }).promise();
  }
  for (const transaction of data.transactions || []) {
    await docClient.put({ TableName: TRANSACTION_TABLE_NAME, Item: transaction }).promise();
  }
  for (const user of data.users || []) {
    const item = sanitizeImportedUser(user, sourceNodeId);
    await docClient.put({
      TableName: USER_TABLE_NAME,
      Item: item,
      ConditionExpression: 'attribute_not_exists(#id)',
      ExpressionAttributeNames: { '#id': 'id' }
    }).promise();
  }
  return { success: true };
}

module.exports = { importFederatedData, sanitizeImportedUser };
