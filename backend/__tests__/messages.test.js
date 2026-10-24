const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const Message = require('../models/message');

test('sendMessage stores and listMessages retrieves', async () => {
  const store = [];
  const mockClient = {
    put: ({ Item }) => ({ promise: async () => { store.push(Item); } }),
    query: ({ ExpressionAttributeValues }) => ({
      promise: async () => ({ Items: store.filter(i => i.conversationId === ExpressionAttributeValues[':cid']) }),
    }),
    batchWrite: () => ({ promise: async () => {} }),
  };
  Message.setDocClient(mockClient);
  const msg = await Message.sendMessage('c1', { from: 'u1', to: 'u2', content: 'hello' });
  assert.ok(msg.id);
  const list = await Message.listMessages('c1');
  assert.strictEqual(list[0].content, 'hello');
});

test('attachment names cannot overwrite files outside uploads', async (t) => {
  const targetName = `upload-sentinel-${randomUUID()}.txt`;
  const target = path.join(__dirname, '..', targetName);
  fs.writeFileSync(target, 'keep existing content');
  t.after(() => fs.rmSync(target, { force: true }));
  Message.setDocClient({ put: () => ({ promise: async () => ({}) }) });

  const msg = await Message.sendMessage('c1', {
    from: 'u1',
    file: {
      name: `/../../${targetName}`,
      data: Buffer.from('uploaded content').toString('base64'),
      type: 'text/plain',
    },
  });
  const storedPath = path.join(__dirname, '..', msg.file.path);
  if (path.dirname(storedPath) === path.join(__dirname, '../uploads')) {
    t.after(() => fs.rmSync(storedPath, { force: true }));
  }

  assert.strictEqual(fs.readFileSync(target, 'utf8'), 'keep existing content');
  assert.strictEqual(path.dirname(storedPath), path.join(__dirname, '../uploads'));
  assert.strictEqual(fs.readFileSync(storedPath, 'utf8'), 'uploaded content');
  assert.strictEqual(msg.file.originalname, `/../../${targetName}`);
  assert.strictEqual(msg.file.mimetype, 'text/plain');
});

test('an existing attachment is never overwritten or persisted on a filename collision', async (t) => {
  const writeFileSync = fs.writeFileSync;
  let target;
  let persisted = false;
  Message.setDocClient({ put: () => ({ promise: async () => { persisted = true; } }) });
  t.mock.method(fs, 'writeFileSync', (filename, data, options) => {
    target = filename;
    writeFileSync(filename, 'existing attachment');
    return writeFileSync(filename, data, options);
  });
  t.after(() => { if (target) fs.rmSync(target, { force: true }); });

  await assert.rejects(Message.sendMessage('c1', {
    file: { name: 'report.txt', data: Buffer.from('replacement').toString('base64') },
  }), { code: 'EEXIST' });
  assert.strictEqual(fs.readFileSync(target, 'utf8'), 'existing attachment');
  assert.strictEqual(persisted, false);
});

