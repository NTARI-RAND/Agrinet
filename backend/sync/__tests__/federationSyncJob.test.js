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
  });

  it('fetches nodes, imports data, and updates lastSyncAt', async () => {
    const nodes = [{ url: 'https://node.example' }];
    const exportData = { listings: [], transactions: [], users: [] };

    mockScan.mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Items: nodes })
    });
    axios.get.mockResolvedValue({ data: exportData });
    importFederatedData.mockResolvedValue({ success: true });
    mockPut.mockReturnValue({ promise: jest.fn().mockResolvedValue({}) });

    await runFederationSync();

    expect(importFederatedData).toHaveBeenCalledWith(exportData);
    expect(mockPut).toHaveBeenCalled();

    const params = mockPut.mock.calls[0][0];
    expect(params.Item.url).toBe(nodes[0].url);
    const timestamp = params.Item.lastSyncAt;
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
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
