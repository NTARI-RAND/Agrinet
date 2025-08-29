const fs = require('fs');
const path = require('path');
const Message = require('./message');

const DATA_FILE = path.join(__dirname, '../data/conversations.json');
let conversations = [];
try {
  conversations = JSON.parse(fs.readFileSync(DATA_FILE));
} catch (e) {
  conversations = [];
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(conversations, null, 2));
}

function create(title = 'New Chat') {
  const convo = {
    id: conversations.length + 1,
    title,
    pinned: false,
    createdAt: new Date().toISOString(),
  };
  conversations.push(convo);
  save();
  return convo;
}

function list() {
  return conversations;
}

function rename(id, title) {
  const convo = conversations.find((c) => c.id === parseInt(id));
  if (convo) {
    convo.title = title;
    save();
  }
  return convo;
}

function remove(id) {
  const cid = parseInt(id);
  conversations = conversations.filter((c) => c.id !== cid);
  save();
  Message.removeByConversation(cid);
}

function pin(id, pinned) {
  const convo = conversations.find((c) => c.id === parseInt(id));
  if (convo) {
    convo.pinned = pinned;
    save();
  }
  return convo;
}

module.exports = { create, list, rename, remove, pin };
