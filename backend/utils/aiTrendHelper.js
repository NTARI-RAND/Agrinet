const docClient = require('../lib/dynamodbClient');
const { USER_TABLE_NAME } = require('../models/user');
const { LISTING_TABLE_NAME } = require('../models/listing');
const { TRANSACTION_TABLE_NAME } = require('../models/transaction');
const { translateMessage, translateTerm } = require('./translation');

/**
 * Generate localized AI insights for marketplace trends.
 * @param {string} region - Region or locale identifier used for data filtering.
 * @param {string} locale - Language/region code (e.g. "en", "es-MX").
 * @returns {Promise<string[]>} Array of translated insight strings.
 */
async function generateAIInsight(region, locale = 'en') {
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
    insights.push(
      translateMessage('high_listing_volume', locale, {
        region: region || translateMessage('this_region', locale),
        listingTerm: translateTerm('listing', locale),
        listingTermPlural: translateTerm('listingPlural', locale)
      })
    );
  } else if (listingCount < 10) {
    insights.push(
      translateMessage('low_market_activity', locale, {
        region: region || translateMessage('this_region', locale)
      })
    );
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
    insights.push(
      translateMessage('top_rated_producers', locale, {
        names,
        producerTermPlural: translateTerm('producerPlural', locale)
      })
    );
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
    insights.push(
      translateMessage('transaction_delays', locale, {
        transactionTermPlural: translateTerm('transactionPlural', locale),
        producerTermPlural: translateTerm('producerPlural', locale),
        pingTermPlural: translateTerm('pingPlural', locale)
      })
    );
  } else {
    insights.push(
      translateMessage('transaction_health_good', locale, {
        transactionTerm: translateTerm('transaction', locale),
        pingTerm: translateTerm('ping', locale)
      })
    );
  }

  return insights;
}

module.exports = { generateAIInsight };
