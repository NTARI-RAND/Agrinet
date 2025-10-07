import React from 'react';
import { useStore } from '../store';

/** @typedef {import('../types').Message} Message */

import { post } from '../api';

/**
 * Action buttons associated with a message.
 * @param {{message: Message, className?: string}} props
 */
export default function MessageActions({ message, className = '' }) {
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
      await post(`/messages/${state.currentConversation.id}/regenerate`, {
        messageId: message.id,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const feedback = async (value) => {
    try {
      await post('/feedback', { messageId: message.id, value });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className={`message-actions absolute top-0 right-0 m-1 hidden space-x-1 group-hover:flex ${className}`}>
      <button className="message-action-button" onClick={copy} title="Copy">
        📋
      </button>
      <button className="message-action-button" onClick={regenerate} title="Regenerate">
        ⟳
      </button>
      <button className="message-action-button" onClick={() => feedback('like')} title="Like">
        👍
      </button>
      <button className="message-action-button" onClick={() => feedback('dislike')} title="Dislike">
        👎
      </button>
    </div>
  );
}
