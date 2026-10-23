export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const API_KEY = import.meta.env.VITE_API_KEY || '';

function buildUrl(path) {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL.replace(/\/$/, '')}${clean}` : clean;
}

async function request(method, path, body) {
  const url = buildUrl(path);
  const headers = {};
  if (API_KEY) headers['x-api-key'] = API_KEY;
  const options = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      // non-JSON response; preserve text in data
      data = text;
    }
  }
  if (!res.ok) {
    const error = new Error(data?.message || `Request failed with status ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const get = (path) => request('GET', path);
export const post = (path, body) => request('POST', path, body);
export const put = (path, body) => request('PUT', path, body);
export const del = (path) => request('DELETE', path);

// Create an EventSource for SSE. Many servers don't accept custom headers for SSE,
// so we append the API key as a query parameter named `x-api-key` when present.
export function stream(path) {
  let url = buildUrl(path);
  if (API_KEY) {
    const hasQuery = url.includes('?');
    url = `${url}${hasQuery ? '&' : '?'}x-api-key=${encodeURIComponent(API_KEY)}`;
  }
  return new EventSource(url);
}

const api = { get, post, put, del, stream };
export default api;
