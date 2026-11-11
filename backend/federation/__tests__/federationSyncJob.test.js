const { configurePeers, signedResponse } = require('../../test-support/federation-pages');
jest.useFakeTimers();
jest.mock('axios');
jest.mock('../../lib/dynamodbClient', () => ({ scan: jest.fn(), update: jest.fn(), put: jest.fn() }));
const axios = require('axios');
const db = require('../../lib/dynamodbClient');
const run = require('../federationSyncJob');

describe('scheduled federation inspection', () => {
  const env = { ...process.env };
  let info;
  let errors;
  beforeEach(() => {
    jest.resetAllMocks();
    configurePeers();
    db.scan.mockReturnValue({ promise: async () => ({ Items: [{ nodeId: 'peer-1', url: 'https://peer.example' }] }) });
    info = jest.spyOn(console, 'info').mockImplementation(() => {});
    errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { info.mockRestore(); errors.mockRestore(); });
  afterAll(() => { process.env = env; jest.useRealTimers(); });
  const page = (listings, next) => ({ data: { listings, transactions: [], users: [] }, headers: { 'x-pagination': 'cursor-v1', ...(next && { 'x-next-cursor': next }) } });
  test('reads every page and reports inspection without canonical writes or a sync timestamp', async () => {
    axios.get.mockResolvedValueOnce(signedResponse(page([{ id: 'l1' }], 'next'))).mockResolvedValueOnce(signedResponse(page([{ id: 'l2' }])));
    await run();
    expect(info).toHaveBeenCalledWith('Federation export inspected; automatic import disabled', { peer: 'https://peer.example', counts: { listings: 2, transactions: 0, users: 0 } });
    expect(db.put).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });
  test('a failed later page never reports a successful inspection or sync', async () => {
    axios.get.mockResolvedValueOnce(signedResponse(page([{ id: 'l1' }], 'next'))).mockRejectedValueOnce(new Error('later page failed'));
    await run();
    expect(info).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalled();
    expect(db.put).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
  test('continues through registry pages even when an earlier peer fails', async () => {
    configurePeers();
    db.scan.mockReturnValueOnce({ promise: async () => ({ Items: [{ nodeId: 'peer-1', url: 'https://peer.example' }], LastEvaluatedKey: { url: 'https://peer.example' } }) })
      .mockReturnValueOnce({ promise: async () => ({ Items: [{ nodeId: 'peer-1', url: 'https://other.example' }] }) });
    axios.get.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(signedResponse(page([])));
    await run();
    expect(axios.get.mock.calls.map(call => call[0])).toEqual(['https://peer.example/federation/export', 'https://other.example/federation/export']);
    expect(db.scan.mock.calls[1][0].ExclusiveStartKey).toEqual({ url: 'https://peer.example' });
    expect(info).toHaveBeenCalledTimes(1);
    expect(db.update).not.toHaveBeenCalled();
  });
  test('a forged peer response is never reported as a successful inspection', async () => {
    const response = signedResponse(page([]));
    response.headers['x-federation-response-signature'] = '0'.repeat(64);
    axios.get.mockResolvedValueOnce(response);
    await run();
    expect(info).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalled();
    expect(db.put).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
  test('HTTP production peers receive no credentials', async () => {
    db.scan.mockReturnValue({ promise: async () => ({ Items: [{ nodeId: 'peer-1', url: 'http://peer.example' }] }) });
    await run();
    expect(axios.get).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
});
