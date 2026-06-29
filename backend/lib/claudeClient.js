let client;
let AnthropicConstructor;

function resolveAnthropic() {
  if (!AnthropicConstructor) {
    // Lazy-load so tests can mock the SDK and a missing key doesn't crash module load.
    // eslint-disable-next-line global-require
    const mod = require('@anthropic-ai/sdk');
    AnthropicConstructor = mod.default || mod;
  }
  return AnthropicConstructor;
}

function getClient() {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }
  const Anthropic = resolveAnthropic();
  client = new Anthropic({ apiKey });
  return client;
}

function setClient(mockClient) {
  client = mockClient;
}

function resetClient() {
  client = undefined;
}

// The Messages API keeps the system prompt separate from the user/assistant turns,
// so split any OpenAI-style {role:'system'} entries out of the messages array.
function splitMessages(messages) {
  const system = [];
  const chat = [];
  for (const m of messages || []) {
    if (!m) continue;
    if (m.role === 'system') {
      if (typeof m.content === 'string') system.push(m.content);
    } else {
      chat.push({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content ?? ''),
      });
    }
  }
  return { system: system.join('\n\n'), chat };
}

/**
 * Stream a chat completion from Claude, yielding text tokens as they arrive.
 * Mirrors the previous OpenAI helper's interface so callers are unchanged.
 *
 * Model defaults to Claude Opus 4.8; override with ANTHROPIC_MODEL (e.g.
 * claude-sonnet-4-6 or claude-haiku-4-5 for a cheaper/faster chat responder).
 * Thinking is intentionally left off here for low-latency interactive chat; add
 * `thinking: { type: 'adaptive' }` via `rest` for harder reasoning tasks.
 */
async function* streamChatCompletion({
  messages,
  model = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8',
  system,
  maxTokens = Number(process.env.ANTHROPIC_MAX_TOKENS) || 4096,
  ...rest
}) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages array is required');
  }

  const { system: extractedSystem, chat } = splitMessages(messages);
  const sys = [system, extractedSystem].filter(Boolean).join('\n\n') || undefined;

  const stream = getClient().messages.stream({
    model,
    max_tokens: maxTokens,
    ...(sys ? { system: sys } : {}),
    messages: chat,
    ...rest,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      const token = event.delta.text;
      if (token) yield token;
    }
  }
}

module.exports = {
  getClient,
  setClient,
  resetClient,
  streamChatCompletion,
};
