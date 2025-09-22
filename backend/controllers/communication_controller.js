const Message = require('../models/message');
const agrinetResponder = require('../services/agrinetResponder');
const openAIResponder = require('../services/openAIResponder');

function broadcastMessage(conversationId, msg) {
  if (!msg) return;

  if (global.broadcast) {
    const tokens = (msg.content || '').split(/\s+/);
    tokens.forEach((token) => {
      global.broadcast('message', { type: 'token', id: msg.id, token }, conversationId);
    });

    global.broadcast('message', { type: 'message', message: msg }, conversationId);
  }

  if (global.emitMessage) {
    global.emitMessage(conversationId, msg);
  }
}

async function persistAssistantMessage(conversationId, reply) {
  if (!reply || !reply.content) return null;

  const assistantMsg = await Message.sendMessage(conversationId, {
    from: reply.from || 'assistant',
    to: reply.to,
    content: reply.content,
    type: reply.type || 'text',
    file: reply.file,
  });

  broadcastMessage(conversationId, assistantMsg);
  return assistantMsg;
}

function shouldAutoRespond({ from, type }) {
  if (type && type !== 'text') return false;
  if (!from) return true;
  const normalized = String(from).toLowerCase();
  return ['user', 'client', 'farmer'].includes(normalized);
}

exports.sendMessage = async (req, res) => {
  const { conversationId } = req.params;
  const { from, to, content, type, file } = req.body;

  // Create and persist the message
  const msg = await Message.sendMessage(conversationId, { from, to, content, type, file });

  broadcastMessage(conversationId, msg);

  let assistantReply = null;

  if (shouldAutoRespond({ from, type })) {
    const latestContent = msg.content || '';

    if (agrinetResponder.shouldHandle(latestContent)) {
      const reply = await agrinetResponder.generateResponse({
        conversationId,
        message: msg,
      });
      assistantReply = await persistAssistantMessage(conversationId, reply);
    } else {
      const historyMessages = await Message.listMessages(conversationId);
      const MAX_HISTORY_MESSAGES = 20;
      const recentMessages = historyMessages.slice(-MAX_HISTORY_MESSAGES);
      const chatHistory = recentMessages.map((m) => ({
        role: String(m.from || '').toLowerCase() === 'assistant' ? 'assistant' : 'user',
        content: m.content || '',
      }));

      const reply = await openAIResponder.generateResponse({
        conversationId,
        message: msg,
        chatHistory,
      });

      assistantReply = await persistAssistantMessage(conversationId, reply);
    }
  }

  const responsePayload = msg && typeof msg.toObject === 'function' ? msg.toObject() : { ...msg };
  if (responsePayload && typeof responsePayload === 'object') {
    responsePayload.reply = assistantReply;
  }

  res.status(201).json(responsePayload);
};

exports.listMessages = async (req, res) => {
  const { conversationId } = req.params;
  const msgs = await Message.listMessages(conversationId);
  res.json(msgs);
};
