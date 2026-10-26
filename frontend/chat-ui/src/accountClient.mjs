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
  async function read(method, path, body, binary = false) {
    const started = version;
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
    return data;
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
