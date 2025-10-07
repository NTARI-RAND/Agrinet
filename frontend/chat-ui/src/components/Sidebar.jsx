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
import React, { useEffect, useState } from 'react';
import { useStore } from '../store';

/**
 * @typedef {import('../types').Conversation} Conversation
 * @typedef {import('../types').Message} Message
 */

import { get, post } from '../api';

/**
 * Sidebar containing conversation list and controls.
 * @returns {JSX.Element}
 */
export default function Sidebar() {
  const { state, dispatch } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await get('/conversations');
        dispatch({ type: 'SET_CONVERSATIONS', conversations: data });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
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

  /**
   * Load a conversation and its messages.
   * @param {Conversation} c
   */
  const openConversation = async (c) => {
    try {
      const msgs = await get(`/messages/${c.id}`);
      dispatch({ type: 'SET_CURRENT_CONVERSATION', conversation: c });
      dispatch({ type: 'SET_MESSAGES', messages: msgs });
    } catch (e) {
      console.error(e);
    }
  };

  /**
   * Toggle the pinned state of a conversation.
   * @param {Conversation} c
   */
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

  /** @type {Conversation[]} */
  const pinned = state.conversations.filter((c) => c.pinned);
  /** @type {Conversation[]} */
  const others = state.conversations.filter((c) => !c.pinned);

  return (
    <aside
      className="farm-pane max-w-full flex flex-col overflow-hidden"
      style={{ width: '320px' }}
    >
      <div className="sidebar-header">
        <h2 className="text-lg font-semibold">Field Notes</h2>
        <p className="text-sm text-[var(--color-muted)]">
          Revisit crop scouting sessions, agronomic planning, and harvest retrospectives.
        </p>
        <button className="farm-button" onClick={newChat}>
          ➕ Sow new chat
        </button>
      </div>
      <div className="sidebar-list" role="list">
        {loading && (
          <div className="skeleton-field" style={{ height: 120 }} aria-hidden="true" />
        )}
        {pinned.length > 0 && !loading && (
          <section aria-label="Pinned conversations" className="space-y-3">
            <h3 className="text-xs uppercase tracking-[0.22em] text-[var(--color-muted)]">Pinned rows</h3>
            {pinned.map((c, index) => (
              <div
                role="listitem"
                key={c.id}
                className="farm-card sidebar-item"
                data-pinned="true"
                style={{ animationDelay: `${index * 80}ms` }}
                onClick={() => openConversation(c)}
              >
                <span className="truncate text-sm font-medium">{c.title}</span>
                <button
                  type="button"
                  className="message-action-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePin(c);
                  }}
                  title="Unpin conversation"
                >
                  📌
                </button>
              </div>
            ))}
          </section>
        )}
        {others.map((c, index) => (
          <div
            role="listitem"
            key={c.id}
            className="farm-card sidebar-item"
            style={{ animationDelay: `${(index + pinned.length) * 60}ms` }}
            onClick={() => openConversation(c)}
          >
            <span className="truncate text-sm font-medium">{c.title}</span>
            <button
              type="button"
              className="message-action-button"
              onClick={(e) => {
                e.stopPropagation();
                togglePin(c);
              }}
              title="Pin conversation"
            >
              📍
            </button>
          </div>
        ))}
        {!loading && pinned.length === 0 && others.length === 0 && (
          <p className="text-sm text-[var(--color-muted)]">
            You have not planted any chats yet. Start a new conversation to cultivate insights.
          </p>
        )}
      </div>
      <div className="sidebar-footer flex items-center justify-between">
        <button className="farm-button" onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}>
          Close barn doors
        </button>
        <span className="text-xs text-[var(--color-muted)]">{state.conversations.length} plots</span>
      </div>
    </aside>
  );
}
