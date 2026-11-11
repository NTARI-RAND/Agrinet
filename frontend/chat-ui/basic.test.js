const { test } = require('node:test');
const assert = require('node:assert/strict');

test('chat streaming appends content and upsert preserves message metadata', async () => {
  const { reducer } = await import('./src/chatReducer.mjs');
  const initial = { messages: [{ id: 'm1', content: 'Hello', from: 'ai' }] };
  const streamed = reducer(initial, { type: 'APPEND_MESSAGE_CONTENT', id: 'm1', content: ' world' });
  const updated = reducer(streamed, { type: 'UPSERT_MESSAGE', message: { id: 'm1', type: 'text' } });
  assert.deepEqual(updated.messages, [{ id: 'm1', content: 'Hello world', from: 'ai', type: 'text' }]);
  assert.equal(initial.messages[0].content, 'Hello');
});

test('chat upsert creates missing messages and unknown actions preserve state', async () => {
  const { reducer } = await import('./src/chatReducer.mjs');
  const state = reducer({ messages: [] }, { type: 'UPSERT_MESSAGE', message: { id: 'm1' } });
  assert.deepEqual(state.messages, [{ id: 'm1' }]);
  assert.equal(reducer(state, { type: 'unknown' }), state);
  assert.equal(reducer(state, { type: 'toString' }), state);
});

test('mode attachments deduplicate by file identity without mutating state', async () => {
  const { reducer, initialState } = await import('./src/components/modeReducer.mjs');
  const file = { name: 'crop.csv', size: 10, lastModified: 1 };
  const state = reducer(initialState, { type: 'ADD_FILES', files: [file, { ...file }] });
  assert.deepEqual(state.files, [file]);
  assert.deepEqual(initialState.files, []);
  assert.deepEqual(reducer(state, { type: 'REMOVE_FILE', index: 0 }).files, []);
});

test('connector selection toggles without mutating the original Set', async () => {
  const { reducer, initialState } = await import('./src/components/modeReducer.mjs');
  const selected = reducer(initialState, { type: 'TOGGLE_CONNECTOR', id: 'github' });
  assert.equal(selected.selectedConnectors.has('github'), true);
  assert.equal(initialState.selectedConnectors.size, 0);
  assert.equal(reducer(selected, { type: 'TOGGLE_CONNECTOR', id: 'github' }).selectedConnectors.size, 0);
});

test('research progress retains logs and resets on stop', async () => {
  const { reducer, initialState } = await import('./src/components/modeReducer.mjs');
  const started = reducer(initialState, { type: 'DEEP_START' });
  const progress = reducer(started, { type: 'DEEP_SET_STAGE', stage: 'searching', log: 'Working' });
  assert.deepEqual(progress.deepProgress.log, ['Working']);
  assert.equal(progress.deepProgress.running, true);
  assert.deepEqual(started.deepProgress.log, []);
  assert.deepEqual(reducer(progress, { type: 'DEEP_STOP' }).deepProgress, initialState.deepProgress);
});

test('mode results merge and reset while unknown actions preserve state', async () => {
  const { reducer, initialState } = await import('./src/components/modeReducer.mjs');
  const state = reducer(initialState, { type: 'SET_RESULTS', results: { text: 'done' } });
  const updated = reducer(state, { type: 'SET_RESULTS', results: { citations: [] } });
  assert.deepEqual(updated.results, { text: 'done', citations: [] });
  assert.deepEqual(reducer(updated, { type: 'RESET_RESULTS' }).results, {});
  assert.equal(reducer(state, { type: 'unknown' }), state);
});
