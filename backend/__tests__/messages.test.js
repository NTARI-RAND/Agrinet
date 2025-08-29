const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '../data/messages.json');

test('sendMessage stores and listMessages retrieves', () => {
  fs.writeFileSync(dataFile, '[]');
  delete require.cache[require.resolve('../models/message')];
  const Message = require('../models/message');
  const msg = Message.sendMessage(1, 'u1', 'u2', 'hello');
  assert.ok(msg.id);
  const list = Message.listMessages(1);
  assert.deepStrictEqual(list[0].content, 'hello');
});
