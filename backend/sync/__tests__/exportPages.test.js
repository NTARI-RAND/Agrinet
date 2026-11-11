jest.mock('axios');
const axios = require('axios');
const { createHmac, createHash } = require('node:crypto');
const { createPeerResponseHeaders } = require('../../middleware/federationPeerAuth');
const peer = { nodeId: 'peer-1', url: 'https://peer.example/' };
const secret = '0123456789abcdef0123456789abcdef';
const { forEachExportPage } = require('../exportPages');

describe('federation export traversal', () => {
  const env = { ...process.env };
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.API_KEY = 'never-send-the-local-write-key';
    process.env.FEDERATION_PEER_KEYS = JSON.stringify({ 'https://peer.example': 'obsolete-read-key-must-not-be-used' });
    process.env.FEDERATION_LOCAL_NODE_ID = 'local-node';
    process.env.FEDERATION_OUTBOUND_PEERS_JSON = JSON.stringify({ 'peer-1': secret });
  });
  afterAll(() => { process.env = env; });
  const signed = data => ({ data, headers: createPeerResponseHeaders({ nodeId: 'peer-1', secret, method: 'GET', path: '/federation/export', body: JSON.stringify(data) }) });
  const page = (listings, cursor) => {
    const data = { listings, transactions: [], users: [] };
    return { data, headers: { ...createPeerResponseHeaders({ nodeId: 'peer-1', secret, method: 'GET', path: '/federation/export', body: JSON.stringify(data) }),
      'x-pagination': 'cursor-v1', ...(cursor && { 'x-next-cursor': cursor }) } };
  };
  test('inspects every signed page including empty continuations, using per-peer HMAC credentials', async () => {
    axios.get.mockResolvedValueOnce(page([{ id: 'l1' }], 'first'))
      .mockResolvedValueOnce(page([], 'second')).mockResolvedValueOnce(page([{ id: 'l2' }]));
    const seen = [];
    await forEachExportPage(peer, data => { seen.push(data); });
    expect(seen.flatMap(data => data.listings)).toEqual([{ id: 'l1' }, { id: 'l2' }]);
    expect(axios.get).toHaveBeenCalledTimes(3);
    expect(axios.get.mock.calls[0]).toEqual(['https://peer.example/federation/export', {
      headers: expect.objectContaining({ 'x-federation-node-id': 'local-node', 'x-federation-signature': expect.any(String) }), params: { limit: 50 },
      timeout: 5000, maxRedirects: 0, maxContentLength: 16 * 1024 * 1024,
    }]);
    const sent = axios.get.mock.calls[0][1].headers;
    const digest = createHash('sha256').update('').digest('hex');
    expect(sent['x-federation-signature']).toBe(createHmac('sha256', secret).update([sent['x-federation-timestamp'], 'GET', '/federation/export', digest].join('.')).digest('hex'));
    expect(JSON.stringify(axios.get.mock.calls)).not.toContain(secret);
    expect(axios.get.mock.calls[1][1].params.cursor).toBe('first');
    expect(axios.get.mock.calls[2][1].params.cursor).toBe('second');
    expect(JSON.stringify(axios.get.mock.calls)).not.toContain(process.env.API_KEY);
  });
  test('unconfigured peers and unsafe destinations never receive credentials', async () => {
    for (const url of ['http://peer.example', 'https://user@peer.example', 'https://peer.example/?redirect=elsewhere', 'https://peer.example/#fragment']) {
      await expect(forEachExportPage({ nodeId: 'peer-1', url }, () => {})).rejects.toThrow();
    }
    await expect(forEachExportPage({ nodeId: 'unknown', url: 'https://peer.example' }, () => {})).rejects.toThrow();
    expect(axios.get).not.toHaveBeenCalled();
  });
  test('old unpaged responses and exported account rows fail closed', async () => {
    const consume = jest.fn();
    axios.get.mockResolvedValueOnce(signed({ listings: [], transactions: [], users: [] }));
    await expect(forEachExportPage(peer, consume)).rejects.toThrow(/pagination/);
    axios.get.mockResolvedValueOnce({ ...signed({ listings: [], transactions: [], users: [{ id: 'u1', password: 'secret' }] }), headers: { ...signed({ listings: [], transactions: [], users: [{ id: 'u1', password: 'secret' }] }).headers, 'x-pagination': 'cursor-v1' } });
    await expect(forEachExportPage(peer, consume)).rejects.toThrow(/account/);
    expect(consume).not.toHaveBeenCalled();
  });
  test('rejects a tampered signed page before passing it to the consumer', async () => {
    const response = page([]);
    response.data.listings.push({ id: 'forged' });
    axios.get.mockResolvedValue(response);
    const consume = jest.fn();
    await expect(forEachExportPage('https://peer.example', consume, 'peer-1')).rejects.toThrow(/signature/);
    expect(consume).not.toHaveBeenCalled();
  });
  test('a failed later page is not treated as a complete export', async () => {
    axios.get.mockResolvedValueOnce(page([{ id: 'l1' }], 'next')).mockRejectedValueOnce(new Error('peer unavailable'));
    const consume = jest.fn();
    await expect(forEachExportPage(peer, consume)).rejects.toThrow('peer unavailable');
    expect(consume).toHaveBeenCalledTimes(1);
  });
  test('repeating cursors and malformed page shapes stop without looping or consuming bad data', async () => {
    axios.get.mockResolvedValue(page([], 'same'));
    await expect(forEachExportPage(peer, () => {})).rejects.toThrow(/cursor/);
    expect(axios.get).toHaveBeenCalledTimes(2);
    axios.get.mockResolvedValue({ ...signed({ listings: {}, transactions: [], users: [] }), headers: { ...signed({ listings: {}, transactions: [], users: [] }).headers, 'x-pagination': 'cursor-v1' } });
    await expect(forEachExportPage(peer, () => {})).rejects.toThrow(/page/);
  });
});
