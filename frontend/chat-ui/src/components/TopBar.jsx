import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { put, del } from '../api';
import ProfileMenu from './ProfileMenu.jsx';
import FarmProgress from './FarmProgress.jsx';

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
    <header className="farm-hero">
      <span className="floating-grain" aria-hidden="true" />
      <div className="flex flex-wrap items-start gap-4">
        <div
          className="flex flex-col gap-2 flex-1 relative z-10"
          style={{ minWidth: '220px' }}
        >
          <span className="badge" aria-hidden="true">
            🌾 Agrinet Co-pilot
          </span>
          <input
            className="flex-1 min-w-0 bg-transparent text-lg font-semibold focus:outline-none border border-transparent rounded-lg px-3 py-2 transition"
            value={title}
            onChange={(e) => rename(e.target.value)}
            placeholder="Name this field session"
            aria-label="Conversation title"
            style={{
              boxShadow: 'inset 0 0 0 1px var(--color-border)',
            }}
            onFocus={(e) => (e.currentTarget.style.boxShadow = 'inset 0 0 0 1px var(--color-accent)')}
            onBlur={(e) => (e.currentTarget.style.boxShadow = 'inset 0 0 0 1px var(--color-border)')}
          />
          <p className="text-sm text-[var(--color-muted)]">
            Capture soil samples, monitor canopy health, and harvest actionable guidance with every exchange.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 relative z-10">
          <label className="flex flex-col text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
            Model
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium shadow-sm focus:outline-none focus:border-[var(--color-accent)]"
            >
              <option value="Agrinet">Agrinet</option>
              <option value="Agrinet-2">Agrinet-2</option>
              <option value="Agrinet-3">Agrinet-3</option>
            </select>
          </label>
          <button
            type="button"
            className="farm-button"
            onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
            title="Toggle sidebar"
          >
            ☰ Fields
          </button>
          <div className="relative">
            <button
              type="button"
              className="farm-button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title="Conversation options"
            >
              ⋮ Options
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-sm shadow-lg">
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-[var(--color-accent-soft)]"
                  onClick={remove}
                >
                  Delete conversation
                  <span aria-hidden="true">🧹</span>
                </button>
              </div>
            )}
          </div>
          <ProfileMenu className="ml-1" />
        </div>
      </div>
      <FarmProgress />
    </header>
  );
}
