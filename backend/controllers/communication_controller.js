const Message = require('../models/message');
const agrinetResponder = require('../services/agrinetResponder');
const openAIResponder = require('../services/openAIResponder');

function broadcastMessage(conversationId, msg, options = {}) {
  if (!msg) return;

  const { emitTokens = true } = options;
  const tokens = emitTokens ? (msg.content || '').match(/\S+/g) || [] : [];

  if (emitTokens && global.broadcast) {
    tokens.forEach((token) => {
      global.broadcast('token', { id: msg.id, token }, conversationId);
    });
  }

  if (emitTokens && global.emitToken) {
    tokens.forEach((token) => {
      global.emitToken(conversationId, msg.id, token);
    });
  }

  if (global.broadcast) {
    global.broadcast('message', { type: 'message', message: msg }, conversationId);
  }
  if (global.emitMessage) {
    global.emitMessage(conversationId, msg);
  }
}

async function persistAssistantMessage(conversationId, reply) {
  if (!reply || !reply.content) return null;

  const replyFrom = reply.from || 'ai';
  const normalizedFrom = replyFrom === 'assistant' ? 'ai' : replyFrom;
  const skipTokenBroadcast = reply.streamedTokens === true;

  const assistantMsg = await Message.sendMessage(conversationId, {
    id: reply.id,
    from: normalizedFrom,
    to: reply.to,
    content: reply.content,
    type: reply.type || 'text',
    file: reply.file,
  });

  broadcastMessage(conversationId, assistantMsg, { emitTokens: !skipTokenBroadcast });
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

  broadcastMessage(conversationId, msg, { emitTokens: false });

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

  const normalize = (value) => {
    if (!value) return value;
    if (typeof value.toObject === 'function') return value.toObject();
    if (typeof value.toJSON === 'function') return value.toJSON();
    return { ...value };
  };

  const responsePayload = { message: normalize(msg) };
  const formattedReply = normalize(assistantReply);
  if (formattedReply) {
    responsePayload.ai = formattedReply;
    responsePayload.reply = formattedReply;
  }

  res.status(201).json(responsePayload);
};

exports.listMessages = async (req, res) => {
  const { conversationId } = req.params;
  const msgs = await Message.listMessages(conversationId);
  res.json(msgs);
};