function normalizeToken(value) {
  return typeof value === 'string' && value ? value : null;
}

function apiUrl(baseUrl, path) {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid API path');
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

function requestHeaders(token, apiKey) {
  const result = {};
  if (token) result.Authorization = `Bearer ${token}`;
  if (apiKey) result['x-api-key'] = apiKey;
  return result;
}

function requestError(response, data) {
  const error = new Error(data?.error || data?.message || `Request failed with status ${response.status}`);
  error.status = response.status;
  error.data = data;
  return error;
}

async function responseData(response, binary) {
  if (binary && response.ok) return response.blob();
  const text = await response.text();
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}

function attachmentDestination(path, conversationId) {
  const prefix = '/uploads/';
  if (!path.startsWith(prefix)) throw new Error('Invalid attachment path');
  const name = path.slice(prefix.length);
  if (!name || name === '.' || name === '..' || /[/\\\0]/.test(name)) throw new Error('Invalid attachment path');
  return conversationId
    ? `/conversations/${encodeURIComponent(conversationId)}/attachments/${encodeURIComponent(name)}`
    : prefix + encodeURIComponent(name);
}

export function createAccountClient({ baseUrl = '', apiKey = '', fetchImpl = (...args) => fetch(...args) } = {}) {
  let token = null;
  let version = 0;
  const changes = new EventTarget();
  function setToken(value) {
    const next = normalizeToken(value);
    if (next !== token) {
      token = next;
      version++;
      changes.dispatchEvent(new Event('change'));
    }
  }
  const url = path => apiUrl(baseUrl, path);
  const headers = () => requestHeaders(token, apiKey);
  async function readPage(method, path, body, binary, started) {
    const options = { method, headers: headers(), redirect: 'error' };
    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    const response = await fetchImpl(url(path), options);
    const data = await responseData(response, binary);
    if (version !== started) throw new Error('Account changed during request');
    if (!response.ok) {
      if (response.status === 401) setToken(null);
      throw requestError(response, data);
    }
    return { data, cursor: method === 'GET' && !binary && response.headers.get('X-Next-Cursor') };
  }
  async function read(method, path, body, binary = false) {
    const started = version;
    let page = await readPage(method, path, body, binary, started);
    if (!page.cursor || !Array.isArray(page.data)) return page.data;

    const items = [...page.data];
    const seen = new Set();
    const [pathname, query = ''] = path.split('?');
    const params = new URLSearchParams(query);
    while (page.cursor) {
      if (seen.size >= 9999 || seen.has(page.cursor) || !/^[\w-]+$/.test(page.cursor) || page.cursor.length > 16384) {
        throw new Error('Invalid collection cursor');
      }
      if (version !== started) throw new Error('Account changed during request');
      seen.add(page.cursor);
      params.set('cursor', page.cursor);
      page = await readPage(method, `${pathname}?${params}`, undefined, false, started);
      if (!Array.isArray(page.data)) throw new Error('Invalid collection page');
      items.push(...page.data);
    }
    return items;
  }
  async function attachment(path, conversationId) {
    if (!token) throw new Error('Sign in to download attachments');
    return read('GET', attachmentDestination(path, conversationId), undefined, true);
  }

  return { setToken, getToken: () => token, changes, url, headers, request: read, attachment };
}
