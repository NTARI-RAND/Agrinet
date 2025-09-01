let dynamo;
try {
  const AWS = require('aws-sdk');
  dynamo = new AWS.DynamoDB({});
} catch (err) {
  dynamo = null;
}
const TABLE = process.env.AGRI_TABLE || 'AgriculturalData';

async function getPrice(crop) {
  if (dynamo) {
    const params = {
      TableName: TABLE,
      Key: { crop: { S: crop.toLowerCase() } },
      ProjectionExpression: 'price',
    };
    try {
      const { Item } = await dynamo.getItem(params).promise();
      if (Item.price.S !== undefined) {
        return Item.price.S;
      } else if (Item.price.N !== undefined) {
        return Item.price.N.toString();
      }
    } catch (err) {
      // fall through to fallback
    }
  }
  const fallback = { maize: '300', rice: '500' };
  return fallback[crop.toLowerCase()] || null;
}

module.exports = { getPrice };
