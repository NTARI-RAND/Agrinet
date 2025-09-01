const fetch = global.fetch || require('node-fetch');

async function request(method, url, { timeout, headers = {}, body } = {}) {
  const controller = new AbortController();
  const id = timeout ? setTimeout(() => controller.abort(), timeout) : null;
  const res = await fetch(url, {
    method,
    headers,
    body,
    signal: controller.signal,
  });
  if (id) clearTimeout(id);
  let data;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  return { data, status: res.status };
}

async function get(url, options = {}) {
  return request('GET', url, options);
}

async function post(url, data, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  return request('POST', url, { ...options, headers, body: JSON.stringify(data) });
}

module.exports = { get, post };
