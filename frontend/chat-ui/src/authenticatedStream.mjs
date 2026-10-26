// EventSource-shaped subset used by ChatWindow, with bearer headers and an
// abortable lifetime. No credential is ever appended to a stream URL.
export function authenticatedStream(client, path, { fetchImpl = (...args) => fetch(...args), retryMs = 1000 } = {}) {
  const events = new EventTarget();
  const controller = new AbortController();
  let reader;
  let retry;
  let closed = false;
  events.readyState = 0;
  events.close = () => {
    closed = true;
    events.readyState = 2;
    clearTimeout(retry);
    controller.abort();
    if (reader) void reader.cancel().catch(() => {});
    client.changes.removeEventListener('change', events.close);
  };
  client.changes.addEventListener('change', events.close);

  async function connect() {
    if (closed) return;
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
      if (closed) { await response.body?.cancel(); return; }
      if (!response.ok || !response.headers.get('content-type')?.startsWith('text/event-stream')) {
        await response.body?.cancel();
        events.close();
        events.dispatchEvent(new Event('error'));
        return;
      }
      reader = response.body.getReader();
      events.readyState = 1;
      events.dispatchEvent(new Event('open'));
      const decoder = new TextDecoder();
      let buffer = '';
      let type = 'message';
      let data = [];
      let frameSize = 0;
      while (!closed) {
        const result = await reader.read();
        if (closed || result.done) break;
        buffer += decoder.decode(result.value, { stream: true });
        if (buffer.length + frameSize > 1024 * 1024) throw new Error('Stream frame too large');
        while (!closed) {
          const end = buffer.search(/[\r\n]/);
          if (end < 0 || (buffer[end] === '\r' && end === buffer.length - 1)) break;
          const line = buffer.slice(0, end);
          const width = buffer[end] === '\r' && buffer[end + 1] === '\n' ? 2 : 1;
          buffer = buffer.slice(end + width);
          if (!line) {
            if (data.length) events.dispatchEvent(new MessageEvent(type, { data: data.join('\n') }));
            type = 'message'; data = []; frameSize = 0;
          } else if (line.startsWith('event:')) type = line.slice(6).replace(/^ /, '') || 'message';
          else if (line.startsWith('data:')) { data.push(line.slice(5).replace(/^ /, '')); frameSize += line.length; }
        }
      }
    } catch {
      if (!closed) events.dispatchEvent(new Event('error'));
    } finally {
      if (reader) { await reader.cancel().catch(() => {}); reader = null; }
      if (!closed) {
        events.readyState = 0;
        retry = setTimeout(connect, retryMs);
      }
    }
  }
  queueMicrotask(connect);
  return events;
}
