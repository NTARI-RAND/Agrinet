const KEYWORDS = [
  'agrinet',
  'federation node',
  'agrinet topology',
  'mesh planning',
  'node federation',
  'agrinet relay',
  'agri mesh',
];

function normalize(text) {
  return (text || '').toLowerCase();
}

function shouldHandle(content) {
  const normalized = normalize(content);
  return KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function buildAgrinetGuidance(message) {
  const focus = normalize(message.content);

  if (focus.includes('federation node')) {
    return (
      'Agrinet federation nodes coordinate handoffs between regional clusters. ' +
      'Deploy them near the mesh core so they maintain redundant uplinks and ' +
      'keep cooperative ledgers synchronized.'
    );
  }

  if (focus.includes('topology')) {
    return (
      'For Agrinet topology planning, start from the food hubs, map producer ' +
      'routes, and fan out low-power relays so farmers stay connected even when grid power drops.'
    );
  }

  return (
    'Agrinet guidance: blend resilient mesh relays with cooperative governance. ' +
    'Pair each deployment with a stewardship circle and keep the node registry mirrored across co-ops.'
  );
}

async function generateResponse({ conversationId, message }) {
  return {
    from: 'agrinet',
    to: message.from,
    content: buildAgrinetGuidance(message),
    type: 'text',
    meta: {
      handledBy: 'agrinetResponder',
      conversationId,
    },
  };
}

module.exports = { shouldHandle, generateResponse };
