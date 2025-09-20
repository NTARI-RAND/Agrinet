let client;
let OpenAIConstructor;

function resolveOpenAI() {
  if (!OpenAIConstructor) {
    // Lazy-load to keep tests independent from the real SDK when mocked
    // eslint-disable-next-line global-require
    OpenAIConstructor = require('openai');
  }
  return OpenAIConstructor;
}

function getClient() {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  const OpenAI = resolveOpenAI();
  client = new OpenAI({ apiKey });
  return client;
}

function setClient(mockClient) {
  client = mockClient;
}

function resetClient() {
  client = undefined;
}

function normaliseDeltaContent(deltaContent) {
  if (typeof deltaContent === 'string') {
    return [deltaContent];
  }
  if (Array.isArray(deltaContent)) {
    const tokens = [];
    deltaContent.forEach((item) => {
      if (!item) return;
      if (typeof item === 'string') {
        tokens.push(item);
      } else if (typeof item.text === 'string') {
        tokens.push(item.text);
      }
    });
    return tokens;
  }
  return [];
}

async function* streamChatCompletion({ messages, model = process.env.OPENAI_MODEL || 'gpt-4o-mini', ...rest }) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages array is required');
  }
  const responseStream = await getClient().chat.completions.create({
    model,
    messages,
    stream: true,
    ...rest,
  });

  for await (const part of responseStream) {
    const choice = part?.choices?.[0];
    if (!choice) continue;
    const delta = choice.delta || {};
    const tokens = normaliseDeltaContent(delta.content);
    for (const token of tokens) {
      if (token) {
        yield token;
      }
    }
  }
}

module.exports = {
  getClient,
  setClient,
  resetClient,
  streamChatCompletion,
};
