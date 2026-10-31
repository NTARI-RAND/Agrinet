import { createAccountClient } from './accountClient.mjs';
import { authenticatedStream } from './authenticatedStream.mjs';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const API_KEY = import.meta.env.VITE_API_KEY || '';
export const accountClient = createAccountClient({ baseUrl: API_BASE_URL, apiKey: API_KEY });
export const setAccountToken = accountClient.setToken;

async function request(method, path, body) {
  return accountClient.request(method, path.startsWith('/') ? path : `/${path}`, body);
}

export async function downloadAttachment(file, conversationId) {
  const blob = await accountClient.attachment(file.path, conversationId);
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

// Native EventSource cannot carry Authorization. Use streaming fetch instead.
export function stream(path) {
  return authenticatedStream(accountClient, path);
}

const api = { get, post, put, del, stream };
export default api;
