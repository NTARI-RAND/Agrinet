import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { put, del } from '../api';
import ProfileMenu from './ProfileMenu.jsx';

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
      await put(`/conversations/${state.currentConversation.id}`, { title: t });
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
      await del(`/conversations/${state.currentConversation.id}`);
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
    <div className="flex items-center gap-2 border-b p-2">
      <input
        className="flex-1 min-w-0 bg-transparent text-lg font-semibold focus:outline-none"
        value={title}
        onChange={(e) => rename(e.target.value)}
        placeholder="Untitled conversation"
      />
      <select value={model} onChange={(e) => setModel(e.target.value)} className="rounded border px-2 py-1">
        <option>Agrinet</option>
        <option>Agrinet-2</option>
        <option>Agrinet-3</option>
      </select>
      <button
        type="button"
        className="rounded border px-2 py-1 hover:bg-gray-100"
        onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
        title="Toggle sidebar"
      >
        ☰
      </button>
      <div className="relative">
        <button
          type="button"
          className="rounded border px-2 py-1 hover:bg-gray-100"
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title="Conversation options"
        >
          ⋮
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded border bg-white shadow-lg">
            <button
              type="button"
              className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
              onClick={remove}
            >
              Delete conversation
            </button>
          </div>
        )}
      </div>
      <ProfileMenu className="ml-1" />
    </div>
  );
}
