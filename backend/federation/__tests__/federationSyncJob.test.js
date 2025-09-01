jest.useFakeTimers();
jest.mock('../../lib/httpClient');
jest.mock('../../lib/dynamodbClient', () => ({
  scan: jest.fn(),
  update: jest.fn()
}));

const http = require('../../lib/httpClient');
const dynamodbClient = require('../../lib/dynamodbClient');
const { runFederationSync } = require('../federationSyncJob');

describe('runFederationSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates lastSyncAt on successful sync', async () => {
    dynamodbClient.scan.mockReturnValue({
      promise: () => Promise.resolve({ Items: [{ url: 'http://node1.com' }] })
    });
    dynamodbClient.update.mockReturnValue({
      promise: () => Promise.resolve()
    });
    http.get.mockResolvedValue({ data: { foo: 'bar' } });
    http.post.mockResolvedValue({});

    await runFederationSync();

    expect(dynamodbClient.update).toHaveBeenCalledTimes(1);
    const params = dynamodbClient.update.mock.calls[0][0];
    expect(params).toMatchObject({
      Key: { url: 'http://node1.com' },
      UpdateExpression: 'set lastSyncAt = :time',
      ExpressionAttributeValues: {
        ':time': expect.any(String)
      }
    });
    const timestamp = params.ExpressionAttributeValues[':time'];
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });

  it('does not update lastSyncAt on failed sync', async () => {
    dynamodbClient.scan.mockReturnValue({
      promise: () => Promise.resolve({ Items: [{ url: 'http://node1.com' }] })
    });
    http.get.mockRejectedValue(new Error('fail'));

    await runFederationSync();

    expect(dynamodbClient.update).not.toHaveBeenCalled();
  });
});
