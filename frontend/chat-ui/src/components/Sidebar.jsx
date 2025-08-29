import React, { useEffect } from 'react';
import { useStore } from '../store.js';

export default function Sidebar() {
  const { state, dispatch } = useStore();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/conversations', {
          headers: { 'x-api-key': import.meta.env.VITE_API_KEY }
        });
        const data = await res.json();
        dispatch({ type: 'SET_CONVERSATIONS', conversations: data });
      } catch (e) {
        console.error(e);
      }
    };
    load();
  }, [dispatch]);

  const newChat = async () => {
    try {
      const res = await fetch('/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_API_KEY,
        },
        body: JSON.stringify({}),
      });
      const convo = await res.json();
      dispatch({ type: 'SET_CURRENT_CONVERSATION', conversation: convo });
      dispatch({ type: 'SET_MESSAGES', messages: [] });
    } catch (e) {
      console.error(e);
    }
  };

  const openConversation = async (c) => {
    try {
      const res = await fetch(`/messages/${c.id}`, {
        headers: { 'x-api-key': import.meta.env.VITE_API_KEY },
      });
      const msgs = await res.json();
      dispatch({ type: 'SET_CURRENT_CONVERSATION', conversation: c });
      dispatch({ type: 'SET_MESSAGES', messages: msgs });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="w-60 border-r p-2 flex flex-col">
      <button className="mb-2 p-2 border rounded" onClick={newChat}>
        New Chat
      </button>
      <div className="flex-1 overflow-y-auto">
        {state.conversations.map((c) => (
          <div
            key={c.id}
            className="p-2 border-b cursor-pointer"
            onClick={() => openConversation(c)}
          >
            {c.title}
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
