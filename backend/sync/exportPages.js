const axios = require('axios');

function peerKey(base) {
  const url = new URL(base);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Invalid federation peer URL');
  let keys;
  try { keys = JSON.parse(process.env.FEDERATION_PEER_KEYS || '{}'); }
  catch { throw new Error('Invalid FEDERATION_PEER_KEYS configuration'); }
  if (!keys || typeof keys !== 'object' || Array.isArray(keys)) throw new Error('Invalid FEDERATION_PEER_KEYS configuration');
  const key = Object.hasOwn(keys, base) && keys[base];
  if (typeof key !== 'string' || !key) throw new Error('Federation peer has no configured read-only key');
  if (key === process.env.API_KEY || key === process.env.WIX_API_KEY) throw new Error('Refusing to forward the local write-capable API key');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !loopback) throw new Error('Federation peer credentials require HTTPS');
  return key;
}

// Stream pages to the consumer instead of collecting a complete peer export in
// memory. Completion means a final page under the explicit pagination contract.
async function forEachExportPage(peer, consume) {
  const base = peer.replace(/\/+$/, '');
  const key = peerKey(base);
  let cursor;
  for (let pages = 0; pages < 10000; pages++) {
    const response = await axios.get(`${base}/federation/export`, {
      headers: { 'x-federation-key': key }, params: { limit: 50, ...(cursor && { cursor }) },
      timeout: 5000, maxRedirects: 0, maxContentLength: 16 * 1024 * 1024,
    });
    const header = name => response.headers?.get?.(name) ?? response.headers?.[name];
    if (header('x-pagination') !== 'cursor-v1') throw new Error('Peer does not declare cursor pagination');
    const { data } = response;
    if (!data || !Array.isArray(data.listings) || !Array.isArray(data.transactions) || !Array.isArray(data.users)) throw new Error('Invalid federation export page');
    if (data.users.length) throw new Error('Peer export contains local account records');
    const next = header('x-next-cursor');
    if (next !== undefined && (typeof next !== 'string' || !/^[\w-]+$/.test(next) || next.length > 16384 || next === cursor)) throw new Error('Invalid federation export cursor');
    await consume({ listings: data.listings, transactions: data.transactions, users: [] });
    if (!next) return;
    cursor = next;
  }
  throw new Error('Federation export exceeded page safety limit; sync is incomplete');
}

async function inspectExport(peer) {
  const counts = { listings: 0, transactions: 0, users: 0 };
  await forEachExportPage(peer, page => {
    counts.listings += page.listings.length;
    counts.transactions += page.transactions.length;
  });
  return counts;
}

module.exports = { forEachExportPage, inspectExport };
