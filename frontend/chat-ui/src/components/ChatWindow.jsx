/*
 * SSE endpoint:
 *   GET /stream/{conversationId}
 * Events:
 *   token   -> { "id": string, "token": string }
 *   message -> { "message": { id, role, content } }
 *
 * Assumes server-side auth (no 'x-api-key' header sent).
 * Errors while parsing events are logged to the console.
 */
import React, { useEffect, useRef } from 'react';
import { useStore } from '../store';
import MessageBubble from './MessageBubble.jsx';
import { API_BASE_URL } from '../api';

export default function ChatWindow() {
  const { state, dispatch } = useStore();
  const bottomRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  useEffect(() => {
    if (!state.currentConversation) return;
    const url = new URL(`${API_BASE_URL}/stream/${state.currentConversation.id}`);
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
