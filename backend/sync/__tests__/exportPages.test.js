jest.mock('axios');
const axios = require('axios');
const { forEachExportPage } = require('../exportPages');

describe('federation export traversal', () => {
  const env = { ...process.env };
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.API_KEY = 'never-send-the-local-write-key';
    process.env.FEDERATION_PEER_KEYS = JSON.stringify({ 'https://peer.example': 'peer-read-only-key' });
  });
  afterAll(() => { process.env = env; });
  const page = (listings, cursor) => ({
    data: { listings, transactions: [], users: [] },
    headers: { 'x-pagination': 'cursor-v1', ...(cursor && { 'x-next-cursor': cursor }) },
  });
  test('imports every page including an empty continuation, using only the configured peer read key', async () => {
    axios.get.mockResolvedValueOnce(page([{ id: 'l1' }], 'first'))
      .mockResolvedValueOnce(page([], 'second')).mockResolvedValueOnce(page([{ id: 'l2' }]));
    const seen = [];
    await forEachExportPage('https://peer.example/', data => { seen.push(data); });
    expect(seen.flatMap(data => data.listings)).toEqual([{ id: 'l1' }, { id: 'l2' }]);
    expect(axios.get).toHaveBeenCalledTimes(3);
    expect(axios.get.mock.calls[0]).toEqual(['https://peer.example/federation/export', {
      headers: { 'x-federation-key': 'peer-read-only-key' }, params: { limit: 50 },
      timeout: 5000, maxRedirects: 0, maxContentLength: 16 * 1024 * 1024,
    }]);
    expect(axios.get.mock.calls[1][1].params.cursor).toBe('first');
    expect(axios.get.mock.calls[2][1].params.cursor).toBe('second');
    expect(JSON.stringify(axios.get.mock.calls)).not.toContain(process.env.API_KEY);
  });
  test('unknown destinations and userinfo cannot receive a configured credential', async () => {
    for (const url of ['https://unconfigured.example', 'https://peer.example.evil', 'https://user@peer.example', 'https://peer.example/?redirect=elsewhere']) {
      await expect(forEachExportPage(url, () => {})).rejects.toThrow();
    }
    expect(axios.get).not.toHaveBeenCalled();
  });
  test('old unpaged responses and exported account rows fail closed', async () => {
    const consume = jest.fn();
    axios.get.mockResolvedValueOnce({ data: { listings: [], transactions: [], users: [] } });
    await expect(forEachExportPage('https://peer.example', consume)).rejects.toThrow(/pagination/);
    axios.get.mockResolvedValueOnce({ ...page([]), data: { listings: [], transactions: [], users: [{ id: 'u1', password: 'secret' }] } });
    await expect(forEachExportPage('https://peer.example', consume)).rejects.toThrow(/account/);
    expect(consume).not.toHaveBeenCalled();
  });
  test('a failed later page is not treated as a complete export', async () => {
    axios.get.mockResolvedValueOnce(page([{ id: 'l1' }], 'next')).mockRejectedValueOnce(new Error('peer unavailable'));
    const consume = jest.fn();
    await expect(forEachExportPage('https://peer.example', consume)).rejects.toThrow('peer unavailable');
    expect(consume).toHaveBeenCalledTimes(1);
  });
  test('repeating cursors and malformed page shapes stop without looping or consuming bad data', async () => {
    axios.get.mockResolvedValue(page([], 'same'));
    await expect(forEachExportPage('https://peer.example', () => {})).rejects.toThrow(/cursor/);
    expect(axios.get).toHaveBeenCalledTimes(2);
    axios.get.mockResolvedValue({ ...page([]), data: { listings: {}, transactions: [], users: [] } });
    await expect(forEachExportPage('https://peer.example', () => {})).rejects.toThrow(/page/);
  });
});
