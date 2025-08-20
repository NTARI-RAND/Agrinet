const docClient = require('../../lib/dynamodbClient');
const {
  createKeyItem,
  putKey,
  getKeyByValue,
  updateKey,
  KEY_TABLE_NAME
} = require('../../models/key');

jest.mock('../../lib/dynamodbClient', () => ({
  put: jest.fn(),
  get: jest.fn(),
  scan: jest.fn(),
  update: jest.fn()
}));

describe('key model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('createKeyItem sets defaults and returns expected structure', () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));
    const item = createKeyItem({
      id: '1',
      userId: 'user',
      key: 'abc',
      expiresAt: '2025-01-01T00:00:00Z'
    });

    expect(item).toEqual({
      id: '1',
      userId: 'user',
      key: 'abc',
      issuedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
      usageCount: 0,
      expiresAt: '2025-01-01T00:00:00Z'
    });
  });

  test('putKey calls docClient.put with correct params', async () => {
    const item = { id: '1', key: 'abc' };
    docClient.put.mockReturnValue({
      promise: () => Promise.resolve({})
    });

    await putKey(item);

    expect(docClient.put).toHaveBeenCalledWith({
      TableName: KEY_TABLE_NAME,
      Item: item
    });
  });

  test('getKeyByValue builds FilterExpression and returns first item', async () => {
    const expected = { id: '1', key: 'abc' };
    docClient.scan.mockReturnValue({
      promise: () => Promise.resolve({ Items: [expected] })
    });

    const result = await getKeyByValue('abc');

    expect(docClient.scan).toHaveBeenCalledWith({
      TableName: KEY_TABLE_NAME,
      FilterExpression: '#k = :keyValue',
      ExpressionAttributeNames: { '#k': 'key' },
      ExpressionAttributeValues: { ':keyValue': 'abc' }
    });
    expect(result).toEqual(expected);
  });

  test('updateKey builds UpdateExpression and returns attributes', async () => {
    const attrs = { usageCount: 1, expiresAt: '2025-01-01' };
    const updated = { id: '1', ...attrs };
    docClient.update.mockReturnValue({
      promise: () => Promise.resolve({ Attributes: updated })
    });

    const result = await updateKey('1', attrs);

    expect(docClient.update).toHaveBeenCalledWith({
      TableName: KEY_TABLE_NAME,
      Key: { id: '1' },
      UpdateExpression: 'set #usageCount = :usageCount, #expiresAt = :expiresAt',
      ExpressionAttributeNames: { '#usageCount': 'usageCount', '#expiresAt': 'expiresAt' },
      ExpressionAttributeValues: { ':usageCount': 1, ':expiresAt': '2025-01-01' },
      ReturnValues: 'ALL_NEW'
    });
    expect(result).toEqual(updated);
  });
});

