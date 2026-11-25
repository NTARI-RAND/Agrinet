const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToString } = require('react-dom/server');

test('sidebar and chat show sign-in guidance until an account token is supplied', async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
  try {
    const { StoreProvider } = await server.ssrLoadModule('/src/store.jsx');
    const { accountClient } = await server.ssrLoadModule('/src/api.js');
    for (const file of ['Sidebar', 'ChatWindow']) {
      const { default: Component } = await server.ssrLoadModule(`/src/components/${file}.jsx`);
      const render = () => renderToString(React.createElement(StoreProvider, null, React.createElement(Component)));
      accountClient.setToken(null);
      assert.match(render(), /Sign in to use chat/);
      accountClient.setToken('account-token');
      assert.doesNotMatch(render(), /Sign in to use chat/);
    }
    accountClient.setToken(null);
  } finally { await server.close(); }
});
