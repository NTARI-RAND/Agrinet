jest.mock('axios');
jest.mock('../../lib/dynamodbClient', () => ({
  scan: jest.fn(),
  update: jest.fn(),
}));

jest.mock('../../marketplace/models/listings', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  updateOne: jest.fn(),
}));

jest.mock('../../models/transaction', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  updateOne: jest.fn(),
}));

jest.mock('../../models/user', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  updateOne: jest.fn(),
}));

describe('scheduler', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('syncFromPeers upserts data and updates lastSyncAt', async () => {
    const dynamodbClient = require('../../lib/dynamodbClient');
    dynamodbClient.scan.mockReturnValue({
      promise: () => Promise.resolve({ Items: [{ nodeUrl: 'http://node1' }] }),
    });
    dynamodbClient.update.mockReturnValue({ promise: () => Promise.resolve() });

    const axios = require('axios');
    axios.get.mockResolvedValue({
      data: {
        listings: [{ _id: 'l1', updatedAt: '2024-01-01T00:00:00.000Z' }],
        transactions: [{ _id: 't1', updatedAt: '2024-01-01T00:00:00.000Z' }],
        users: [{ _id: 'u1', updatedAt: '2024-01-01T00:00:00.000Z' }],
      },
    });

    const listingMock = require('../../marketplace/models/listings');
    const transactionMock = require('../../models/transaction');
    const userMock = require('../../models/user');
    listingMock.findOne.mockResolvedValue(null);
    transactionMock.findOne.mockResolvedValue(null);
    userMock.findOne.mockResolvedValue(null);

    const { syncFromPeers } = require('../scheduler');
    await syncFromPeers();

    expect(listingMock.create).toHaveBeenCalledTimes(1);
    expect(transactionMock.create).toHaveBeenCalledTimes(1);
    expect(userMock.create).toHaveBeenCalledTimes(1);

    expect(dynamodbClient.update).toHaveBeenCalledTimes(1);
    const params = dynamodbClient.update.mock.calls[0][0];
    const lastSyncAt = params.ExpressionAttributeValues[':lastSyncAt'];
    expect(new Date(lastSyncAt).toISOString()).toBe(lastSyncAt);
  });

  test('schedules syncFromPeers at interval', () => {
    const dynamodbClient = require('../../lib/dynamodbClient');
    dynamodbClient.scan.mockReturnValue({ promise: () => Promise.resolve({ Items: [] }) });
    dynamodbClient.update.mockReturnValue({ promise: () => Promise.resolve() });
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    require('../scheduler');
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30 * 60 * 1000);
    setIntervalSpy.mock.calls[0][0]();
  });
});
