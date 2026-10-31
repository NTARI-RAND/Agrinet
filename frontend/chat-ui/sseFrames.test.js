const { test } = require('node:test');
const assert = require('node:assert/strict');

// A network chunk may contain several independent, individually valid frames.
test('coalesced frames each below the size limit are delivered even when their transport chunk exceeds it', async () => {
  const { readFrames } = await import('./src/sseFrames.mjs');
  const first = 'a'.repeat(600000);
  const second = 'b'.repeat(600000);
  const bytes = new TextEncoder().encode(`data: ${first}\n\ndata: ${second}\n\n`);
  const body = new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } });
  const events = new EventTarget();
  const messages = [];
  events.addEventListener('message', event => messages.push(event.data));
  await readFrames(body.getReader(), events, () => false);
  assert.deepEqual(messages, [first, second]);
});

test('one frame exceeding the limit across separate data lines and chunks is rejected before delivery', async () => {
  const { readFrames } = await import('./src/sseFrames.mjs');
  const encoder = new TextEncoder();
  const body = new ReadableStream({ start(controller) {
    controller.enqueue(encoder.encode('data: ' + 'a'.repeat(600000) + '\n'));
    controller.enqueue(encoder.encode('data: ' + 'b'.repeat(600000) + '\n\n'));
    controller.close();
  } });
  const events = new EventTarget();
  let messages = 0;
  events.addEventListener('message', () => messages++);
  await assert.rejects(readFrames(body.getReader(), events, () => false), /Stream frame too large/);
  assert.equal(messages, 0);
});
