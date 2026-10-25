const assert = require('node:assert/strict');
const path = require('node:path');
const { fork } = require('node:child_process');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const { DynamoDBClient, CreateTableCommand, DeleteTableCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const jwt = require('../utils/jwt');

async function main() {
  const endpoint = process.env.DYNAMODB_TEST_ENDPOINT;
  if (!endpoint || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(endpoint).hostname)) {
    throw new Error('Set DYNAMODB_TEST_ENDPOINT to a loopback DynamoDB Local URL. This check refuses remote endpoints.');
  }
  const client = new DynamoDBClient({ endpoint, region: 'us-east-1',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' } });
  const suffix = randomUUID();
  const messages = `RetryMessages-${suffix}`;
  const receipts = `RetrySends-${suffix}`;
  const created = [];
  const workers = [];
  const secret = 'local-integration-secret';
  const payload = { from: 'user', to: 'ai', content: 'When should I plant?', type: 'text' };

  async function worker(hold) {
    const child = fork(path.join(__dirname, '../test-support/message-retry-worker.js'), [], {
      env: { ...process.env, DYNAMODB_ENDPOINT: endpoint, AWS_REGION: 'us-east-1',
        AWS_ACCESS_KEY_ID: 'local', AWS_SECRET_ACCESS_KEY: 'local', JWT_SECRET: secret,
        MESSAGE_TABLE_NAME: messages, MESSAGE_SEND_TABLE_NAME: receipts, TEST_HOLD_AI: String(hold) },
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });
    const state = { child, ai: 0 };
    workers.push(state);
    let signalAI;
    state.startedAI = new Promise(resolve => { signalAI = resolve; });
    state.url = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Worker did not start')), 15000);
      child.once('error', reject);
      child.on('message', message => {
        if (message.type === 'ready') { clearTimeout(timeout); resolve(message.url); }
        if (message.type === 'ai') { state.ai++; signalAI(); }
      });
    });
    return state;
  }

  async function send(target, { key = 'send-1', conversation = 'conversation-1', body = payload } = {}) {
    const response = await fetch(`${target.url}/messages/${conversation}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key,
        Authorization: `Bearer ${jwt.sign({ userId: 'local-grower' }, secret)}` },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
    return { status: response.status, body: await response.json() };
  }

  async function stop(target, signal = 'SIGTERM') {
    const exited = once(target.child, 'exit');
    target.child.kill(signal);
    await exited;
  }

  async function waitForAI(target) {
    let timeout;
    try {
      await Promise.race([target.startedAI, new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Worker did not reach the AI provider')), 15000);
      })]);
    } finally { clearTimeout(timeout); }
  }

  try {
    for (const [name, composite] of [[messages, true], [receipts, false]]) {
      await client.send(new CreateTableCommand({ TableName: name, BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: composite ? [{ AttributeName: 'conversationId', AttributeType: 'S' }, { AttributeName: 'id', AttributeType: 'S' }]
          : [{ AttributeName: 'id', AttributeType: 'S' }],
        KeySchema: composite ? [{ AttributeName: 'conversationId', KeyType: 'HASH' }, { AttributeName: 'id', KeyType: 'RANGE' }]
          : [{ AttributeName: 'id', KeyType: 'HASH' }],
      }));
      created.push(name);
    }
    const firstWorker = await worker(true);
    const secondWorker = await worker(false);
    const first = send(firstWorker);
    await waitForAI(firstWorker);
    const racing = await Promise.all(Array.from({ length: 8 }, () => send(secondWorker)));
    assert.ok(racing.every(response => response.status === 409 && response.body.code === 'message_send_pending'));
    firstWorker.child.send('release');
    const original = await first;
    assert.equal(original.status, 201);
    assert.deepEqual(await send(secondWorker), original);
    assert.equal((await send(secondWorker, { body: { ...payload, content: 'changed' } })).status, 409);
    await stop(firstWorker);
    const restarted = await worker(true);
    assert.deepEqual(await send(restarted), original);
    const rows = await client.send(new ScanCommand({ TableName: messages }));
    assert.equal(rows.Count, 2);
    assert.equal(workers.reduce((total, value) => total + value.ai, 0), 1);
    console.log('PASS: real conditional writes serialize two workers; completed response survives a worker restart.');

    // Kill a worker after it has saved the user message and invoked the
    // provider. Another worker must not run that operation again.
    const interrupted = send(restarted, { key: 'crash-1', conversation: 'crash-conversation' }).catch(() => null);
    await waitForAI(restarted);
    await stop(restarted, 'SIGKILL');
    await interrupted;
    const retry = await send(secondWorker, { key: 'crash-1', conversation: 'crash-conversation' });
    assert.equal(retry.status, 409);
    assert.equal(retry.body.code, 'message_send_pending');
    assert.equal(secondWorker.ai, 0);
    const afterCrash = await client.send(new ScanCommand({ TableName: messages }));
    assert.equal(afterCrash.Count, 3);
    console.log('PASS: process death leaves a pending receipt and does not duplicate a message or AI invocation.');
  } finally {
    for (const target of workers) {
      if (target.child.exitCode === null && target.child.signalCode === null) await stop(target);
    }
    for (const name of created.reverse()) await client.send(new DeleteTableCommand({ TableName: name }));
    client.destroy();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
