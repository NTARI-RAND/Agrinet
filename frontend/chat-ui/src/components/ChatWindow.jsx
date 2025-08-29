import React, { useEffect, useRef } from 'react';
import { useStore } from '../store.js';
import MessageBubble from './MessageBubble.jsx';

export default function ChatWindow() {
  const { state } = useStore();
  const bottomRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      {state.messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
