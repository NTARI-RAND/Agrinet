const mockScan = jest.fn();
const mockPut = jest.fn();

jest.mock('../../lib/dynamodbClient', () => ({
  scan: mockScan,
  put: mockPut
}));

jest.mock('axios');
jest.mock('../importHelper', () => ({
  importFederatedData: jest.fn()
}));

const axios = require('axios');
const { importFederatedData } = require('../importHelper');
const runFederationSync = require('../federationSyncJob');

describe('runFederationSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FEDERATION_PEER_KEYS = JSON.stringify({ 'https://node.example': 'read-key' });
  });

  it('inspects the full export without importing summaries or updating lastSyncAt', async () => {
    const nodes = [{ url: 'https://node.example' }];
    const exportData = { listings: [], transactions: [], users: [] };

    mockScan.mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Items: nodes })
    });
    axios.get.mockResolvedValue({ data: exportData, headers: { 'x-pagination': 'cursor-v1' } });
    importFederatedData.mockResolvedValue({ success: true });
    mockPut.mockReturnValue({ promise: jest.fn().mockResolvedValue({}) });

    await runFederationSync();

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(importFederatedData).not.toHaveBeenCalled();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('logs errors from axios without updating', async () => {
    const nodes = [{ url: 'https://node.example' }];
    mockScan.mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Items: nodes })
    });

    axios.get.mockRejectedValue(new Error('Network error'));

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await runFederationSync();

    expect(errorSpy).toHaveBeenCalled();
    expect(mockPut).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
