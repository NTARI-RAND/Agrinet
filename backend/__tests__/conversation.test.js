const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('removing a conversation deletes its messages', () => {
  const convoFile = path.join(__dirname, '../data/conversations.json');
  const msgFile = path.join(__dirname, '../data/messages.json');

  // seed files with a conversation and a message
  fs.writeFileSync(convoFile, JSON.stringify([
    { id: 1, title: 'seed', pinned: false, createdAt: new Date().toISOString() }
  ], null, 2));
  fs.writeFileSync(msgFile, JSON.stringify([
    { id: 1, conversationId: 1, from: 'a', to: 'b', sender: 'a', content: 'hi', type: 'text', timestamp: new Date().toISOString() }
  ], null, 2));

  // reload modules to pick up seeded data
  delete require.cache[require.resolve('../models/conversation')];
  delete require.cache[require.resolve('../models/message')];
  const Conversation = require('../models/conversation');
  const Message = require('../models/message');

  Conversation.remove(1);
  const msgs = Message.listMessages(1);
  assert.equal(msgs.length, 0);
});

