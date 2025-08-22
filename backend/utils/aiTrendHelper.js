const docClient = require('../lib/dynamodbClient');
const { USER_TABLE_NAME } = require('../models/user');
const { LISTING_TABLE_NAME } = require('../models/listing');
const { TRANSACTION_TABLE_NAME } = require('../models/transaction');

async function generateAIInsight(region) {
  const insights = [];

  // 1. Top Listing Density
  const listingParams = { TableName: LISTING_TABLE_NAME };
  if (region) {
    listingParams.FilterExpression = 'contains(#loc, :r)';
    listingParams.ExpressionAttributeNames = { '#loc': 'location' };
    listingParams.ExpressionAttributeValues = { ':r': region };
  }
  const listingRes = await docClient.scan(listingParams).promise();
  const listingCount = listingRes.Items.length;
  if (listingCount > 100) {
    insights.push(`📈 High listing volume detected in ${region || 'this region'} – over 100 active listings.`);
  } else if (listingCount < 10) {
    insights.push(`🌱 Low market activity in ${region || 'this region'}. Consider broadcasting market needs.`);
  }

  // 2. Top Sellers Reputation
  const userParams = {
    TableName: USER_TABLE_NAME,
    FilterExpression: '#role = :producer',
    ExpressionAttributeNames: { '#role': 'role' },
    ExpressionAttributeValues: { ':producer': 'producer' }
  };
  if (region) {
    userParams.FilterExpression += ' AND contains(#loc, :r)';
    userParams.ExpressionAttributeNames['#loc'] = 'location';
    userParams.ExpressionAttributeValues[':r'] = region;
  }
  const usersRes = await docClient.scan(userParams).promise();
  const topUsers = usersRes.Items.sort((a, b) => b.reputationScore - a.reputationScore).slice(0, 3);
  if (topUsers.length > 0) {
    const names = topUsers.map(u => u.name || u.email).join(', ');
    insights.push(`🏆 Top rated producers this week: ${names}`);
  }

  // 3. PING Health
  const transParams = {
    TableName: TRANSACTION_TABLE_NAME,
    FilterExpression: 'pingCount > :limit',
    ExpressionAttributeValues: { ':limit': 5 }
  };
  const transRes = await docClient.scan(transParams).promise();
  const slowPings = transRes.Items.length;
  if (slowPings > 10) {
    insights.push('⚠️ Several transactions are experiencing delays. Encourage producers to respond to PINGs promptly.');
  } else {
    insights.push('✅ Average transaction health is good. PING responsiveness is within expected limits.');
  }

  return insights;
}

module.exports = { generateAIInsight };
