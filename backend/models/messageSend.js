const docClient = require('../lib/dynamodbClient');

const MESSAGE_SEND_TABLE_NAME = process.env.MESSAGE_SEND_TABLE_NAME || 'MessageSends';

async function begin(id, fingerprint) {
  try {
    await docClient.put({
      TableName: MESSAGE_SEND_TABLE_NAME,
      Item: { id, fingerprint, state: 'processing' },
      ConditionExpression: 'attribute_not_exists(id)',
    }).promise();
    return { claimed: true };
  } catch (error) {
    if (error.code !== 'ConditionalCheckFailedException') throw error;
    const { Item } = await docClient.get({
      TableName: MESSAGE_SEND_TABLE_NAME,
      Key: { id },
      ConsistentRead: true,
    }).promise();
    if (!Item) throw new Error('Message send receipt unavailable');
    return { claimed: false, receipt: Item };
  }
}

async function complete(id, fingerprint, outcome) {
  await docClient.update({
    TableName: MESSAGE_SEND_TABLE_NAME,
    Key: { id },
    UpdateExpression: 'SET #state = :complete, outcome = :outcome',
    ConditionExpression: '#state = :processing AND fingerprint = :fingerprint',
    ExpressionAttributeNames: { '#state': 'state' },
    ExpressionAttributeValues: {
      ':complete': 'complete', ':processing': 'processing', ':fingerprint': fingerprint, ':outcome': outcome,
    },
  }).promise();
}

module.exports = { begin, complete };
