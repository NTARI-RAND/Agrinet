import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { API_BASE_URL } from '../api';

export default function TopBar() {
  const { state, dispatch } = useStore();
  const [title, setTitle] = useState('');
  const [model, setModel] = useState('Agrinet');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setTitle(state.currentConversation?.title || '');
  }, [state.currentConversation]);

  const rename = async (t) => {
    setTitle(t);
    if (!state.currentConversation) return;
    try {
      await fetch(`${API_BASE_URL}/conversations/${state.currentConversation.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_API_KEY,
        },
        body: JSON.stringify({ title: t }),
      });
      const updated = { ...state.currentConversation, title: t };
      dispatch({ type: 'SET_CURRENT_CONVERSATION', conversation: updated });
      dispatch({
        type: 'SET_CONVERSATIONS',
        conversations: state.conversations.map((c) => (c.id === updated.id ? updated : c)),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const remove = async () => {
    if (!state.currentConversation) return;
    try {
      await fetch(`${API_BASE_URL}/conversations/${state.currentConversation.id}`, {
        method: 'DELETE',
        headers: { 'x-api-key': import.meta.env.VITE_API_KEY },
      });
      dispatch({
        type: 'SET_CONVERSATIONS',
        conversations: state.conversations.filter((c) => c.id !== state.currentConversation.id),
      });
      dispatch({ type: 'SET_CURRENT_CONVERSATION', conversation: null });
      dispatch({ type: 'SET_MESSAGES', messages: [] });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="relative flex items-center justify-between p-2 border-b">
      <input
        className="text-lg font-semibold flex-1 mr-2 bg-transparent"
        value={title}
        onChange={(e) => rename(e.target.value)}
      />
      <select value={model} onChange={(e) => setModel(e.target.value)} className="border rounded p-1">
        <option>Agrinet</option>
        <option>Agrinet-2</option>
        <option>Agrinet-3</option>
      </select>
      <button className="ml-2 p-2" onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}>
        ☰
      </button>
      <button className="ml-2 p-2" onClick={() => setMenuOpen((o) => !o)}>
        ⋮
      </button>
      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 border rounded bg-white shadow">
          <button
            className="block px-4 py-2 text-left w-full hover:bg-gray-100"
            onClick={remove}
          >
            Delete conversation
          </button>
        </div>
      )}
    </div>
  );
}
