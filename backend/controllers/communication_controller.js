const { randomUUID } = require('crypto');
const Message = require('../models/message');
const { streamChatCompletion } = require('../lib/openaiClient');

function buildPrompt(content) {
  const systemPrompt =
    process.env.OPENAI_SYSTEM_PROMPT ||
    'You are Fruitful, a helpful assistant that provides concise, friendly answers for farmers and growers.';
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: content || '' },
  ];
}

async function emitTokens(conversationId, messageId, iterator) {
  let full = '';
  for await (const token of iterator) {
    if (!token) continue;
    full += token;
    if (global.emitToken) {
      global.emitToken(conversationId, messageId, token);
    }
    if (global.broadcast) {
      global.broadcast('token', { id: messageId, token }, conversationId);
    }
  }
  return full;
}

exports.sendMessage = async (req, res) => {
  const { conversationId } = req.params;
  const { from, to, content, type, file } = req.body;

  // Create and persist the message
  const userMessage = await Message.sendMessage(conversationId, { from, to, content, type, file });

  if (global.broadcast) {
    global.broadcast('message', { type: 'message', message: userMessage }, conversationId);
  }
  if (global.emitMessage) {
    global.emitMessage(conversationId, userMessage);
  }

  let aiMessage = null;
  if (typeof content === 'string' && content.trim()) {
    try {
      const aiMessageId = randomUUID();
      const iterator = streamChatCompletion({ messages: buildPrompt(content) });
      const aiContent = await emitTokens(conversationId, aiMessageId, iterator);

      if (aiContent) {
        aiMessage = await Message.sendMessage(conversationId, {
          id: aiMessageId,
          from: 'ai',
          to: from || to,
          content: aiContent,
          type: 'ai',
        });

        if (global.broadcast) {
          global.broadcast('message', { type: 'message', message: aiMessage }, conversationId);
        }
        if (global.emitMessage) {
          global.emitMessage(conversationId, aiMessage);
        }
      }
    } catch (error) {
      console.error('Failed to generate AI response', error);
      if (global.broadcast) {
        global.broadcast('message', { type: 'error', error: 'AI response failed' }, conversationId);
      }
    }
  }

  res.status(201).json({ message: userMessage, ai: aiMessage });
};

exports.listMessages = async (req, res) => {
  const { conversationId } = req.params;
  const msgs = await Message.listMessages(conversationId);
  res.json(msgs);
};
