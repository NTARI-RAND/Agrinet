const { v4: uuid } = require('uuid');
const docClient = require('../lib/dynamodbClient');

const TABLE = process.env.KEY_TABLE_NAME || 'Keys';
// Expected attributes:
//   id (PK) | userId | key | transmissions | retired (bool) | issuedAt | retiredAt | failedAttempts

class KeyLibrary {
  constructor(data) {
    Object.assign(this, data);
    if (!this.id) this.id = uuid();
    if (this.transmissions == null) this.transmissions = 0;
    if (this.retired == null) this.retired = false;
    if (!this.issuedAt) this.issuedAt = new Date().toISOString();
    if (this.failedAttempts == null) this.failedAttempts = 0;
  }

  async save() {
    await docClient.put({
      TableName: TABLE,
      Item: {
        id: this.id,
        userId: this.userId,
        key: this.key,
        transmissions: this.transmissions,
        retired: this.retired,
        issuedAt: this.issuedAt,
        retiredAt: this.retiredAt || null,
        failedAttempts: this.failedAttempts
      }
    }).promise();
    return this;
  }

  // Inefficient scans for now (replace with Query + GSI later)
  static async find({ userId, retired }) {
    const res = await docClient.scan({
      TableName: TABLE,
      FilterExpression: '#u = :u AND #r = :r',
      ExpressionAttributeNames: { '#u': 'userId', '#r': 'retired' },
      ExpressionAttributeValues: { ':u': userId, ':r': retired }
    }).promise();
    return res.Items.map(i => new KeyLibrary(i));
  }

  static async findOne({ userId, key, retired }) {
    const res = await docClient.scan({
      TableName: TABLE,
      FilterExpression: '#u = :u AND #k = :k AND #r = :r',
      ExpressionAttributeNames: { '#u': 'userId', '#k': 'key', '#r': 'retired' },
      ExpressionAttributeValues: { ':u': userId, ':k': key, ':r': retired }
    }).promise();
    const item = res.Items[0];
    return item ? new KeyLibrary(item) : null;
  }

  static async countDocuments(filter) {
    // Only needed for failedAttempts logic in retryKeyValidation
    const { userId } = filter;
    const res = await docClient.scan({
      TableName: TABLE,
      FilterExpression: '#u = :u AND failedAttempts >= :n',
      ExpressionAttributeNames: { '#u': 'userId' },
      ExpressionAttributeValues: { ':u': userId, ':n': 3 }
    }).promise();
    return res.Count || 0;
  }

  static async updateMany({ userId }, { $inc }) {
    // Increment failedAttempts for all active (non-retired) keys for user
    const res = await docClient.scan({
      TableName: TABLE,
      FilterExpression: '#u = :u AND retired = :falseVal',
      ExpressionAttributeNames: { '#u': 'userId' },
      ExpressionAttributeValues: { ':u': userId, ':falseVal': false }
    }).promise();

    const promises = (res.Items || []).map(item =>
      docClient.update({
        TableName: TABLE,
        Key: { id: item.id },
        UpdateExpression: 'SET failedAttempts = if_not_exists(failedAttempts, :zero) + :inc',
        ExpressionAttributeValues: {
          ':zero': 0,
          ':inc': $inc.failedAttempts
        }
      }).promise()
    );
    await Promise.all(promises);
  }
}

module.exports = KeyLibrary;
