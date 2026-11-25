// Isolated HTTP worker for scripts/check-message-retries.js. Only the external
// AI provider is replaced; storage uses the real SDK against DynamoDB Local.
const express = require('express');
const { setClient } = require('../lib/openaiClient');

let release;
const gate = new Promise(resolve => { release = resolve; });
process.on('message', message => { if (message === 'release') release(); });
setClient({ chat: { completions: { create: async () => {
  process.send({ type: 'ai' });
  if (process.env.TEST_HOLD_AI === 'true') await gate;
  return (async function* () { yield { choices: [{ delta: { content: 'Local integration reply' } }] }; })();
} } } });

const app = express();
app.use(express.json());
app.use('/messages', require('../routes/communicationRoutes'));
const server = app.listen(0, '127.0.0.1', () => {
  process.send({ type: 'ready', url: `http://127.0.0.1:${server.address().port}` });
});
process.on('SIGTERM', () => { server.closeAllConnections(); server.close(() => process.exit(0)); });
