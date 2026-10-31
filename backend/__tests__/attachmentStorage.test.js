const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Message = require('../models/message');

// Same-name writes in the same millisecond must never alias another message.
test('same-name attachments retain distinct bytes and server-generated names', async () => {
  Message.setDocClient({ put: () => ({ promise: async () => ({}) }) });
  const now = Date.now;
  const files = [];
  Date.now = () => 123456789;
  try {
    for (const content of ['first', 'second']) {
      const msg = await Message.sendMessage('mine', { file: { name: 'same.txt', data: Buffer.from(content).toString('base64') } });
      files.push(msg.file);
    }
    assert.notEqual(files[0].path, files[1].path);
    for (const [index, file] of files.entries()) {
      assert.match(file.path, /^\/uploads\/[0-9a-f-]{36}\.txt$/);
      assert.equal(file.originalname, 'same.txt');
      assert.equal(fs.readFileSync(path.join(__dirname, '..', file.path), 'utf8'), ['first', 'second'][index]);
    }
  } finally {
    Date.now = now;
    for (const file of files) fs.rmSync(path.join(__dirname, '..', file.path), { force: true });
  }
});

test('scoped attachment lookup follows empty filtered pages within its conversation partition', async () => {
  let reads = 0;
  Message.setDocClient({ query: params => ({ promise: async () => {
    assert.equal(params.KeyConditionExpression, 'conversationId = :cid');
    assert.deepEqual(params.ExpressionAttributeValues, { ':cid': 'mine', ':filePath': '/uploads/100%.txt' });
    reads++;
    if (!params.ExclusiveStartKey) return { Items: [], LastEvaluatedKey: { conversationId: 'mine', id: 'first' } };
    assert.deepEqual(params.ExclusiveStartKey, { conversationId: 'mine', id: 'first' });
    return { Items: [{ file: { path: '/uploads/100%.txt' } }] };
  } }) });
  assert.equal(await Message.findConversationAttachment('mine', '/uploads/100%.txt'), true);
  assert.equal(reads, 2);
});
