jest.useFakeTimers();
const setIntervalSpy = jest.spyOn(global, 'setInterval');
jest.mock('axios');
jest.mock('../../lib/dynamodbClient', () => ({
  scan: jest.fn(),
  update: jest.fn()
}));

const axios = require('axios');
const dynamodbClient = require('../../lib/dynamodbClient');
const runFederationSync = require('../federationSyncJob');
const SIX_HOURS = 6 * 60 * 60 * 1000;
const scheduledSync = setIntervalSpy.mock.calls.find(([, ms]) => ms === SIX_HOURS)[0];
setIntervalSpy.mockRestore();

describe('runFederationSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('updates lastSyncAt on successful sync', async () => {
    dynamodbClient.scan.mockReturnValue({
      promise: () => Promise.resolve({ Items: [{ url: 'http://node1.com' }] })
    });
    dynamodbClient.update.mockReturnValue({
      promise: () => Promise.resolve()
    });
    axios.get.mockResolvedValue({ data: { foo: 'bar' } });
    axios.post.mockResolvedValue({});

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
    axios.get.mockRejectedValue(new Error('fail'));

    await runFederationSync();

    expect(dynamodbClient.update).not.toHaveBeenCalled();
  });

  it('contains a failed NodeRegistry scan and syncs on the next scheduled run', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    dynamodbClient.scan.mockReturnValueOnce({
      promise: () => Promise.reject(new Error('Requested resource not found'))
    });

    await expect(scheduledSync()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0].every((arg) => typeof arg === 'string')).toBe(true);
    expect(axios.get).not.toHaveBeenCalled();

    dynamodbClient.scan.mockReturnValueOnce({
      promise: () => Promise.resolve({ Items: [{ url: 'http://down.example' }, { url: 'http://up.example' }] })
    });
    dynamodbClient.update.mockReturnValue({ promise: () => Promise.resolve() });
    axios.get.mockImplementation((url) => (url.startsWith('http://down.example')
      ? Promise.reject(new Error('fail'))
      : Promise.resolve({ data: {} })));
    axios.post.mockResolvedValue({});

    await jest.advanceTimersByTimeAsync(SIX_HOURS);

    expect(dynamodbClient.scan).toHaveBeenCalledTimes(2);
    expect(dynamodbClient.update).toHaveBeenCalledTimes(1);
    expect(dynamodbClient.update.mock.calls[0][0].Key).toEqual({ url: 'http://up.example' });
  });

  it('contains a failed NodeRegistry scan on the first run started by the server', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    dynamodbClient.scan.mockReturnValueOnce({
      promise: () => Promise.reject(new Error('Requested resource not found'))
    });

    await expect(runFederationSync()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('treats a scan with no Items as an empty registry', async () => {
    dynamodbClient.scan.mockReturnValueOnce({
      promise: () => Promise.resolve({})
    });

    await expect(runFederationSync()).resolves.toBeUndefined();

    expect(axios.get).not.toHaveBeenCalled();
  });
});
