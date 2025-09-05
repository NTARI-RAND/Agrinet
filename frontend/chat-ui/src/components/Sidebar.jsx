/*
 * API endpoints used:
 *   GET /conversations                -> [{ id, title, pinned }]
 *   POST /conversations               -> { id, title, pinned }
 *   GET /messages/{conversationId}    -> [{ id, role, content }]
 *   POST /conversations/{id}/pin      -> body: { pinned: boolean }
 *
 * All requests include an 'x-api-key' header and expect JSON responses.
 * Errors are caught and logged to the console without user-facing feedback.
 */
import React, { useEffect } from 'react';
import { useStore } from '../store';
import { API_BASE_URL } from '../api';
import { get, post } from '../api';

export default function Sidebar() {
  const { state, dispatch } = useStore();

  useEffect(() => {
    const load = async () => {
      try {
        const data = await get('/conversations');
        dispatch({ type: 'SET_CONVERSATIONS', conversations: data });
      } catch (e) {
        console.error(e);
      }
    };
    load();
  }, [dispatch]);

  const newChat = async () => {
    try {
      const convo = await post('/conversations', {});
      dispatch({ type: 'SET_CURRENT_CONVERSATION', conversation: convo });
      dispatch({ type: 'SET_MESSAGES', messages: [] });
    } catch (e) {
      console.error(e);
    }
  };

  const openConversation = async (c) => {
    try {
      const msgs = await get(`/messages/${c.id}`);
      dispatch({ type: 'SET_CURRENT_CONVERSATION', conversation: c });
      dispatch({ type: 'SET_MESSAGES', messages: msgs });
    } catch (e) {
      console.error(e);
    }
  };

  const togglePin = async (c) => {
    try {
      await post(`/conversations/${c.id}/pin`, { pinned: !c.pinned });
      const updated = { ...c, pinned: !c.pinned };
      dispatch({
        type: 'SET_CONVERSATIONS',
        conversations: state.conversations.map((x) => (x.id === c.id ? updated : x)),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const pinned = state.conversations.filter((c) => c.pinned);
  const others = state.conversations.filter((c) => !c.pinned);

  return (
    <div className="w-60 border-r p-2 flex flex-col">
      <button className="mb-2 p-2 border rounded" onClick={newChat}>
        New Chat
      </button>
      <div className="flex-1 overflow-y-auto space-y-2">
        {pinned.length > 0 && (
          <div>
            <h3 className="text-xs text-gray-500 mb-1">Pinned</h3>
            {pinned.map((c) => (
              <div
                key={c.id}
                className="p-2 border-b cursor-pointer flex justify-between"
                onClick={() => openConversation(c)}
              >
                <span>{c.title}</span>
                <button onClick={(e) => { e.stopPropagation(); togglePin(c); }}>📌</button>
              </div>
            ))}
          </div>
        )}
        {others.map((c) => (
          <div
            key={c.id}
            className="p-2 border-b cursor-pointer flex justify-between"
            onClick={() => openConversation(c)}
          >
            <span>{c.title}</span>
            <button onClick={(e) => { e.stopPropagation(); togglePin(c); }}>📍</button>
          </div>
        ))}
      </div>
      <button
        className="mt-2 p-2 border rounded"
        onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
      >
        Close
      </button>
    </div>
  );
}
