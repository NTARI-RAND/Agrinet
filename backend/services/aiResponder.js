const { randomUUID } = require('crypto');
const { streamChatCompletion } = require('../lib/claudeClient');

async function generateResponse({ conversationId, message, chatHistory }) {
  const history = Array.isArray(chatHistory) ? [...chatHistory] : [];
  const userMessage = message?.content || '';
  history.push({ role: 'user', content: userMessage });

  const responseId = randomUUID();
  let content = '';
  let streamedTokens = false;

  try {
    const stream = streamChatCompletion({ messages: history });
    for await (const token of stream) {
      if (!token) continue;
      streamedTokens = true;
      content += token;
      if (global.emitToken) {
        global.emitToken(conversationId, responseId, token);
      }
      if (global.broadcast) {
        global.broadcast('token', { id: responseId, token }, conversationId);
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Claude streaming failed', error);
    }
  }

  if (!content) {
    content = `AI assistant is unavailable right now. You said: ${userMessage}`.trim();
  }

  return {
    id: responseId,
    from: 'ai',
    to: message?.from,
    content,
    type: 'text',
    streamedTokens,
  };
}

module.exports = { generateResponse };
