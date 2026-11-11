export function createAccountClient({ baseUrl = '', apiKey = '', fetchImpl = (...args) => fetch(...args) } = {}) {
  let token = null;
  let version = 0;
  const changes = new EventTarget();
  function setToken(value) {
    token = typeof value === 'string' && value ? value : null;
    version++;
    changes.dispatchEvent(new Event('change'));
  }
  function url(path) {
    if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid API path');
    return `${baseUrl.replace(/\/$/, '')}${path}`;
  }
  function headers() {
    const result = {};
    if (token) result.Authorization = `Bearer ${token}`;
    if (apiKey) result['x-api-key'] = apiKey;
    return result;
  }
  async function readPage(method, path, body, binary, started) {
    const options = { method, headers: headers(), redirect: 'error' };
    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    const response = await fetchImpl(url(path), options);
    let data;
    if (binary && response.ok) data = await response.blob();
    else {
      const text = await response.text();
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    }
    if (version !== started) throw new Error('Account changed during request');
    if (!response.ok) {
      const error = new Error(data?.error || data?.message || `Request failed with status ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return { data, cursor: response.headers.get('X-Next-Cursor') };
  }
  async function read(method, path, body, binary = false) {
    const started = version;
    let page = await readPage(method, path, body, binary, started);
    if (method !== 'GET' || binary || !Array.isArray(page.data)) return page.data;
    const items = [...page.data];
    let previous;
    const [pathname, query = ''] = path.split('?');
    for (let pages = 1; page.cursor; pages++) {
      if (pages >= 10000 || page.cursor === previous || !/^[\w-]+$/.test(page.cursor) || page.cursor.length > 16384) throw new Error('Invalid collection cursor');
      if (version !== started) throw new Error('Account changed during request');
      previous = page.cursor;
      const params = new URLSearchParams(query);
      params.set('cursor', page.cursor);
      page = await readPage(method, `${pathname}?${params}`, undefined, false, started);
      if (!Array.isArray(page.data)) throw new Error('Invalid collection page');
      items.push(...page.data);
    }
    return items;
  }
  async function attachment(path) {
    if (!token) throw new Error('Sign in to download attachments');
    // Never forward a bearer to a path supplied by another origin or endpoint.
    if (!/^\/uploads\/[^/?#\\]+$/.test(path)) throw new Error('Invalid attachment path');
    let name;
    try { name = decodeURIComponent(path.slice('/uploads/'.length)); } catch { /* invalid encoding */ }
    if (!name || name === '.' || name === '..' || /[/\\\0]/.test(name)) throw new Error('Invalid attachment path');
    return read('GET', path, undefined, true);
  }
  return { setToken, getToken: () => token, changes, url, headers, request: read, attachment };
}
