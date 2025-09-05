import React, { useEffect, useRef } from 'react';
import { useStore } from '../store';
import MessageBubble from './MessageBubble.jsx';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export default function ChatWindow() {
  const { state, dispatch } = useStore();
  const bottomRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  useEffect(() => {
    if (!state.currentConversation) return;
    const base = API_BASE_URL || window.location.origin;
    const baseUrl = base.endsWith('/') ? base : `${base}/`;
    const url = new URL(`stream/${state.currentConversation.id}`, baseUrl);
    const apiKey = import.meta.env.VITE_API_KEY;
    if (apiKey) {
      url.searchParams.set('api_key', apiKey);
    }
    const events = new EventSource(url.toString());

    const handleToken = (e) => {
      try {
        const data = JSON.parse(e.data);
        dispatch({ type: 'APPEND_MESSAGE_CONTENT', id: data.id, content: data.token });
      } catch (err) {
        console.error(err);
      }
    };

    const handleMessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        dispatch({ type: 'UPSERT_MESSAGE', message: data.message });
      } catch (err) {
        console.error(err);
      }
    };

    events.addEventListener('token', handleToken);
    events.addEventListener('message', handleMessage);

    return () => {
      events.removeEventListener('token', handleToken);
      events.removeEventListener('message', handleMessage);
      events.close();
    };
  }, [state.currentConversation, dispatch]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      {state.messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
