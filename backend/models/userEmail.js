const docClient = require('../lib/dynamodbClient');
const { USER_TABLE_NAME } = require('./user');

// One item per normalised email, { email, userId }, so a conditional write can
// refuse a second account and login can find the owner without scanning Users.
const USER_EMAIL_TABLE_NAME = process.env.USER_EMAIL_TABLE_NAME || 'UserEmails';

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

// Writes the email claim and a new user together; returns false if the email is
// taken. An id that already exists cancels the transaction and throws.
async function createUserWithEmail(user) {
  try {
    await docClient.transactWrite({
      TransactItems: [
        { Put: {
          TableName: USER_EMAIL_TABLE_NAME,
          Item: { email: normalizeEmail(user.email), userId: user.id },
          ConditionExpression: 'attribute_not_exists(email)',
        } },
        { Put: { TableName: USER_TABLE_NAME, Item: user, ConditionExpression: 'attribute_not_exists(id)' } },
      ],
    }).promise();
    return true;
  } catch (error) {
    if (error.code === 'TransactionCanceledException' &&
        error.CancellationReasons?.[0]?.Code === 'ConditionalCheckFailed') return false;
    throw error;
  }
}

async function findUserByEmail(email) {
  const key = normalizeEmail(email);
  if (!key) return undefined;
  const { Item: claim } = await docClient.get({
    TableName: USER_EMAIL_TABLE_NAME,
    Key: { email: key },
    ConsistentRead: true,
  }).promise();
  if (!claim) return undefined;
  const { Item: user } = await docClient.get({
    TableName: USER_TABLE_NAME,
    Key: { id: claim.userId },
    ConsistentRead: true,
  }).promise();
  return user;
}

// Claims the emails of accounts created before UserEmails existed. Safe to re-run;
// Users rows are never changed. An email held by more than one account is left
// unclaimed, so none of them can log in until an operator decides which owns it.
async function claimExistingEmails() {
  const owners = new Map();
  let ExclusiveStartKey;
  do {
    const page = await docClient.scan({ TableName: USER_TABLE_NAME, ExclusiveStartKey }).promise();
    for (const user of page.Items || []) {
      const key = normalizeEmail(user.email);
      if (key) owners.set(key, [...(owners.get(key) || []), user.id]);
    }
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  const report = { claimed: 0, alreadyClaimed: 0, needsReview: [] };
  for (const [email, ids] of owners) {
    if (ids.length > 1) {
      report.needsReview.push(ids);
      continue;
    }
    try {
      await docClient.put({
        TableName: USER_EMAIL_TABLE_NAME,
        Item: { email, userId: ids[0] },
        ConditionExpression: 'attribute_not_exists(email)',
      }).promise();
      report.claimed++;
    } catch (error) {
      if (error.code !== 'ConditionalCheckFailedException') throw error;
      const { Item } = await docClient.get({
        TableName: USER_EMAIL_TABLE_NAME,
        Key: { email },
        ConsistentRead: true,
      }).promise();
      if (Item?.userId === ids[0]) report.alreadyClaimed++;
      else report.needsReview.push([Item?.userId, ids[0]]);
    }
  }
  return report;
}

module.exports = {
  USER_EMAIL_TABLE_NAME,
  normalizeEmail,
  createUserWithEmail,
  findUserByEmail,
  claimExistingEmails,
};
