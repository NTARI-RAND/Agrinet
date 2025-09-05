import React from 'react';
import { useStore } from '../store';
import { API_BASE_URL } from '../api';

export default function MessageActions({ message }) {
  const { state } = useStore();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content ?? message.message ?? '');
    } catch (e) {
      console.error(e);
    }
  };

  const regenerate = async () => {
    if (!state.currentConversation) return;
    try {
      await fetch(`${API_BASE_URL}/messages/${state.currentConversation.id}/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_API_KEY,
        },
        body: JSON.stringify({ messageId: message.id }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const feedback = async (value) => {
    try {
      await fetch(`${API_BASE_URL}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_API_KEY,
        },
        body: JSON.stringify({ messageId: message.id, value }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="absolute top-0 right-0 m-1 space-x-1 hidden group-hover:flex">
      <button onClick={copy} title="Copy">📋</button>
      <button onClick={regenerate} title="Regenerate">⟳</button>
      <button onClick={() => feedback('like')} title="Like">👍</button>
      <button onClick={() => feedback('dislike')} title="Dislike">👎</button>
    </div>
  );
}
