import { reducer } from './chatReducer.mjs';
import React, { createContext, useContext, useEffect, useReducer } from 'react';
import { accountClient } from './api';

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
 * @property {boolean} aiThinking
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
 *   | { type: 'SET_AI_THINKING', value: boolean }
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
  aiThinking: false,
};

/** @type {React.Context<{state: State, dispatch: React.Dispatch<Action>}>} */
const StoreContext = createContext();

/**
 * Provides the global store context.
 * @param {{children: React.ReactNode}} props
 * @returns {JSX.Element}
 */
export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  useEffect(() => {
    const reset = () => dispatch({ type: 'RESET_ACCOUNT' });
    accountClient.changes.addEventListener('change', reset);
    return () => accountClient.changes.removeEventListener('change', reset);
  }, []);
  return (
    <StoreContext.Provider key={state.accountVersion || 0} value={{ state, dispatch }}>
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
