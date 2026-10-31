import { readFrames } from './sseFrames.mjs';

// EventSource-shaped subset used by ChatWindow, with bearer headers and an
// abortable lifetime. No credential is ever appended to a stream URL.
export function authenticatedStream(client, path, { fetchImpl = (...args) => fetch(...args), retryMs = 1000 } = {}) {
  const events = new EventTarget();
  const controller = new AbortController();
  const state = { reader: null, retry: null, closed: false };
  events.readyState = 0;
  events.close = () => {
    state.closed = true;
    events.readyState = 2;
    clearTimeout(state.retry);
    controller.abort();
    if (state.reader) void state.reader.cancel().catch(() => {});
    client.changes.removeEventListener('change', events.close);
  };
  client.changes.addEventListener('change', events.close);

  const connection = { client, path, fetchImpl, retryMs, events, controller, state };
  queueMicrotask(() => connect(connection));
  return events;
}

async function connect(connection) {
  const { client, path, fetchImpl, retryMs, events, controller, state } = connection;
  if (state.closed) return;
  try {
    if (!client.getToken()) {
      events.close();
      events.dispatchEvent(new Event('error'));
      return;
    }
    const response = await fetchImpl(client.url(path), {
      headers: { ...client.headers(), Accept: 'text/event-stream' },
      signal: controller.signal,
      redirect: 'error',
    });
    if (state.closed) { await response.body?.cancel(); return; }
    if (!response.ok || !response.headers.get('content-type')?.startsWith('text/event-stream')) {
      await response.body?.cancel();
      if (response.status === 401) client.setToken(null);
      events.close();
      events.dispatchEvent(new Event('error'));
      return;
    }
    state.reader = response.body.getReader();
    events.readyState = 1;
    events.dispatchEvent(new Event('open'));
    await readFrames(state.reader, events, () => state.closed);
  } catch (error) {
    if (error instanceof RangeError) { events.close(); events.dispatchEvent(new Event('error')); }
    else if (!state.closed) events.dispatchEvent(new Event('error'));
  } finally {
    if (state.reader) { await state.reader.cancel().catch(() => {}); state.reader = null; }
    if (!state.closed) {
      events.readyState = 0;
      state.retry = setTimeout(() => connect(connection), retryMs);
    }
  }
}
