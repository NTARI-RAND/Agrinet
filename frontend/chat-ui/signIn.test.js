const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const React = require('react');
const { renderToString } = require('react-dom/server');

test('sidebar and chat return to sign-in after the active stream rejects a token', async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
  try {
    const { StoreProvider } = await server.ssrLoadModule('/src/store.jsx');
    const { accountClient } = await server.ssrLoadModule('/src/api.js');
    const { authenticatedStream } = await server.ssrLoadModule('/src/authenticatedStream.mjs');
    const views = [];
    for (const file of ['Sidebar', 'ChatWindow']) {
      const { default: Component } = await server.ssrLoadModule(`/src/components/${file}.jsx`);
      const render = () => renderToString(React.createElement(StoreProvider, null, React.createElement(Component)));
      views.push({ file, render });
    }
    for (const { file, render } of views) assert.match(render(), /Sign in to use chat/, file);
    accountClient.setToken('account-token');
    for (const { file, render } of views) assert.doesNotMatch(render(), /Sign in to use chat/, file);

    const stream = authenticatedStream(accountClient, '/stream/owned', {
      fetchImpl: async () => new Response(null, { status: 401 }),
    });
    await once(stream, 'error');
    for (const { file, render } of views) assert.match(render(), /Sign in to use chat/, file);
  } finally { await server.close(); }
});
