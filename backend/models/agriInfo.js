const { DynamoDBClient, GetItemCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({});
const TABLE = process.env.AGRI_TABLE || 'AgriculturalData';

async function getPrice(crop) {
  const params = {
    TableName: TABLE,
    Key: { crop: { S: crop.toLowerCase() } },
    ProjectionExpression: 'price',
  };
  try {
    const { Item } = await client.send(new GetItemCommand(params));
      if (Item.price.S !== undefined) {
        return Item.price.S;
      } else if (Item.price.N !== undefined) {
        return Item.price.N.toString();
      }
    }
  } catch (err) {
    // Fallback to static data when DB is unavailable
    const fallback = { maize: '300', rice: '500' };
    return fallback[crop.toLowerCase()] || null;
  }
  return null;
}

module.exports = { getPrice };
