import { createAccountClient } from './accountClient.mjs';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const API_KEY = import.meta.env.VITE_API_KEY || '';
export const accountClient = createAccountClient({ baseUrl: API_BASE_URL, apiKey: API_KEY });
export const setAccountToken = accountClient.setToken;

function buildUrl(path) {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL.replace(/\/$/, '')}${clean}` : clean;
}

async function request(method, path, body) {
  return accountClient.request(method, path.startsWith('/') ? path : `/${path}`, body);
}

export async function downloadAttachment(file) {
  const blob = await accountClient.attachment(file.path);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = file.originalname || 'attachment';
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
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
