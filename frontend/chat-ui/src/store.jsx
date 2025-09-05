import React, { createContext, useContext, useReducer } from 'react';

/**
 * @typedef {import('./types').Message} Message
 * @typedef {import('./types').Conversation} Conversation
 */

/**
 * @typedef {Object} State
 * @property {Message[]} messages
 * @property {Conversation[]} conversations
 * @property {Conversation|null} currentConversation
 * @property {boolean} sidebarOpen
 * @property {string} theme
 * @property {boolean} memory
 */

/**
 * @typedef {(
 *   | { type: 'ADD_MESSAGE', message: Message }
 *   | { type: 'UPSERT_MESSAGE', message: Message }
 *   | { type: 'APPEND_MESSAGE_CONTENT', id: string, content: string }
 *   | { type: 'SET_MESSAGES', messages: Message[] }
 *   | { type: 'SET_CONVERSATIONS', conversations: Conversation[] }
 *   | { type: 'SET_CURRENT_CONVERSATION', conversation: Conversation | null }
 *   | { type: 'TOGGLE_SIDEBAR' }
 *   | { type: 'SET_THEME', theme: string }
 *   | { type: 'TOGGLE_MEMORY' }
 * )} Action
 */

/** @type {State} */
const initialState = {
  messages: [],
  conversations: [],
  currentConversation: null,
  sidebarOpen: true,
  theme: 'light',
  memory: true,
};

/**
 * Reducer handling chat UI actions.
 * @param {State} state
 * @param {Action} action
 * @returns {State}
 */
function reducer(state, action) {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] };
    case 'UPSERT_MESSAGE': {
      const idx = state.messages.findIndex((m) => m.id === action.message.id);
      if (idx >= 0) {
        const updated = [...state.messages];
        updated[idx] = { ...updated[idx], ...action.message };
        return { ...state, messages: updated };
      }
      return { ...state, messages: [...state.messages, action.message] };
    }
    case 'APPEND_MESSAGE_CONTENT':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id ? { ...m, content: (m.content || '') + action.content } : m
        ),
      };
    case 'SET_MESSAGES':
      return { ...state, messages: action.messages };
    case 'SET_CONVERSATIONS':
      return { ...state, conversations: action.conversations };
    case 'SET_CURRENT_CONVERSATION':
      return { ...state, currentConversation: action.conversation };
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'SET_THEME':
      return { ...state, theme: action.theme };
    case 'TOGGLE_MEMORY':
      return { ...state, memory: !state.memory };
    default:
      return state;
  }
}

/** @type {React.Context<{state: State, dispatch: React.Dispatch<Action>}>} */
const StoreContext = createContext();

/**
 * Provides the global store context.
 * @param {{children: React.ReactNode}} props
 * @returns {JSX.Element}
 */
export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  );
}

/**
 * Hook to access store state and dispatch.
 * @returns {{state: State, dispatch: React.Dispatch<Action>}}
 */
export function useStore() {
  return useContext(StoreContext);
}
