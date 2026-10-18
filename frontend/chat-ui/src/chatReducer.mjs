const handlers = {
  ADD_MESSAGE: (state, action) => ({ ...state, messages: [...state.messages, action.message] }),
  UPSERT_MESSAGE(state, action) {
    const index = state.messages.findIndex((message) => message.id === action.message.id);
    const messages = [...state.messages];
    if (index >= 0) messages[index] = { ...messages[index], ...action.message };
    else messages.push(action.message);
    return { ...state, messages };
  },
  APPEND_MESSAGE_CONTENT: (state, action) => ({
    ...state,
    messages: state.messages.map((message) =>
      message.id === action.id ? { ...message, content: (message.content || '') + action.content } : message
    ),
  }),
  SET_MESSAGES: (state, action) => ({ ...state, messages: action.messages }),
  SET_CONVERSATIONS: (state, action) => ({ ...state, conversations: action.conversations }),
  SET_CURRENT_CONVERSATION: (state, action) => ({ ...state, currentConversation: action.conversation }),
  TOGGLE_SIDEBAR: (state) => ({ ...state, sidebarOpen: !state.sidebarOpen }),
  SET_THEME: (state, action) => ({ ...state, theme: action.theme }),
  TOGGLE_MEMORY: (state) => ({ ...state, memory: !state.memory }),
  SET_AI_THINKING: (state, action) => ({ ...state, aiThinking: action.value }),
};

export function reducer(state, action) {
  return Object.hasOwn(handlers, action.type) ? handlers[action.type](state, action) : state;
}
