const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

test('DynamoDB adapter marshals records and preserves conditional error codes', async (t) => {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push(JSON.parse(body));
    res.setHeader('Content-Type', 'application/x-amz-json-1.0');
    if (requests.length === 1) res.end('{}');
    else if (requests.length === 2) res.end(JSON.stringify({ Item: { id: { S: 'item' }, count: { N: '2' } } }));
    else {
      res.statusCode = 400;
      res.end(JSON.stringify({ __type: 'ConditionalCheckFailedException', message: 'missing item' }));
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const env = {
    DYNAMODB_ENDPOINT: `http://127.0.0.1:${server.address().port}`,
    AWS_REGION: 'us-east-1',
    AWS_ACCESS_KEY_ID: 'test-access-key',
    AWS_SECRET_ACCESS_KEY: 'test-secret-key',
  };
  const original = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  t.after(() => {
    server.closeAllConnections();
    server.close();
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  Object.assign(process.env, env);
  const client = require('../lib/dynamodbClient');
  await client.put({ TableName: 'Items', Item: { id: 'item', count: 2, optional: undefined } }).promise();
  assert.deepEqual(requests[0].Item, { id: { S: 'item' }, count: { N: '2' } });
  const { Item } = await client.get({ TableName: 'Items', Key: { id: 'item' } }).promise();
  assert.deepEqual(Item, { id: 'item', count: 2 });
  await assert.rejects(client.update({ TableName: 'Items', Key: { id: 'missing' } }).promise(), {
    code: 'ConditionalCheckFailedException',
  });
});
