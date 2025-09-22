async function generateResponse({ message, chatHistory }) {
  chatHistory = Array.isArray(chatHistory) ? chatHistory : [];
  const lastUserEntry = chatHistory.filter((entry) => entry.role === 'user').slice(-1)[0];
  const prompt = lastUserEntry ? lastUserEntry.content : message.content || '';

  return {
    from: 'assistant',
    to: message.from,
    content: `OpenAI response placeholder: ${prompt}`,
    type: 'text',
  };
}

module.exports = { generateResponse };
