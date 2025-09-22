const { randomUUID } = require('crypto');
const Message = require('../models/message');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');

function normaliseRole(message) {
  if (!message) return 'assistant';
  const role = message.role || message.sender || message.from;
  return role === 'user' ? 'user' : 'assistant';
}

function convertMessagesToChatHistory(messages) {
  return messages
    .map((msg) => {
      if (msg.type === 'file' && msg.file?.originalname) {
        return {
          role: normaliseRole(msg),
          content: `File shared: ${msg.file.originalname}`,
        };
      }
      return {
        role: normaliseRole(msg),
        content: msg.content || msg.message || '',
      };
    })
    .filter((msg) => msg.content);
}

async function streamChatCompletion(reader, onToken) {
  if (!reader) return '';

  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;
  let responseText = '';

  async function processBuffer() {
    let boundaryIndex;
    while ((boundaryIndex = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, boundaryIndex);
      buffer = buffer.slice(boundaryIndex + 2);

      const dataLines = rawEvent
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .filter(Boolean);

      if (!dataLines.length) continue;

      const payload = dataLines.join('');
      if (payload === '[DONE]') {
        finished = true;
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch (err) {
        continue;
      }

      const delta = parsed?.choices?.[0]?.delta?.content;
      if (delta) {
        responseText += delta;
        if (onToken) await onToken(delta);
      }
    }
  }

  while (!finished) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    await processBuffer();
  }

  buffer += decoder.decode(new Uint8Array(), { stream: false });
  await processBuffer();

  return responseText;
}

exports.sendMessage = async (req, res) => {
  const { conversationId } = req.params;
  const {
    id,
    from = 'user',
    to = 'assistant',
    content = '',
    type = 'text',
    file,
    timestamp,
    model,
  } = req.body;

  if (!content && !file) {
    return res.status(400).json({ error: 'Message content or file is required.' });
  }

  const userMessage = await Message.sendMessage(conversationId, {
    id,
    from,
    to,
    content,
    type,
    file,
    timestamp,
  });

  if (global.broadcast) {
    global.broadcast('message', { message: userMessage }, conversationId);
  }
  if (global.emitMessage) {
    global.emitMessage(conversationId, userMessage);
  }

  if (!OPENAI_API_KEY) {
    return res.status(500).json({
      error: 'OpenAI API key not configured on the server.',
      userMessage,
    });
  }

  const rawMessages = await Message.listMessages(conversationId);
  const conversationHistory = rawMessages
    .map((msg) => {
      const sortTimeRaw = msg?.timestamp ? new Date(msg.timestamp).getTime() : 0;
      const sortTime = Number.isNaN(sortTimeRaw) ? 0 : sortTimeRaw;
      return { ...msg, sortTime };
    })
    .sort((a, b) => a.sortTime - b.sortTime)
    .map(({ sortTime, ...msg }) => msg);
  const chatHistory = convertMessagesToChatHistory(conversationHistory);

  const targetModel = model || OPENAI_MODEL;
  const body = {
    model: targetModel,
    messages: chatHistory,
    stream: true,
  };

  let assistantId = null;
  let assistantContent = '';

  try {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorPayload = await response.text();
      throw new Error(errorPayload || `OpenAI API error (${response.status})`);
    }

    assistantId = randomUUID();
    const placeholder = {
      id: assistantId,
      conversationId,
      from: 'assistant',
      to: from,
      type: 'text',
      content: '',
      timestamp: new Date().toISOString(),
    };

    if (global.broadcast) {
      global.broadcast('message', { message: placeholder }, conversationId);
    }
    if (global.emitMessage) {
      global.emitMessage(conversationId, placeholder);
    }

    if (response.body?.getReader) {
      assistantContent = await streamChatCompletion(response.body.getReader(), async (token) => {
        if (global.broadcast) {
          global.broadcast('token', { id: assistantId, token }, conversationId);
        }
        if (global.emitToken) {
          global.emitToken(conversationId, assistantId, token);
        }
      });
    } else {
      const data = await response.json();
      assistantContent = data?.choices?.[0]?.message?.content || '';
    }

    const assistantMessage = await Message.sendMessage(conversationId, {
      id: assistantId,
      from: 'assistant',
      to: from,
      content: assistantContent,
      type: 'text',
    });

    if (global.broadcast) {
      global.broadcast('message', { message: assistantMessage }, conversationId);
    }
    if (global.emitMessage) {
      global.emitMessage(conversationId, assistantMessage);
    }

    return res.status(201).json({ userMessage, assistantMessage });
  } catch (err) {
    console.error('Failed to generate assistant response:', err);

    const fallbackContent =
      'Sorry, I had trouble generating a response. Please try again in a moment.';

    const failureMessage = await Message.sendMessage(conversationId, {
      id: assistantId || randomUUID(),
      from: 'assistant',
      to: from,
      content: fallbackContent,
      type: 'text',
    });

    if (global.broadcast) {
      global.broadcast('message', { message: failureMessage }, conversationId);
    }
    if (global.emitMessage) {
      global.emitMessage(conversationId, failureMessage);
    }

    return res.status(500).json({
      error: 'Failed to generate assistant response.',
      userMessage,
      assistantMessage: failureMessage,
    });
  }
};

exports.listMessages = async (req, res) => {
  const { conversationId } = req.params;
  const msgs = await Message.listMessages(conversationId);
  res.json(msgs);
};
