/*
 * SSE endpoint:
 *   GET /stream/{conversationId}
 * Events:
 *   token   -> { "id": string, "token": string }
 *   message -> { "message": { id, role, content } }
 *
 * Streaming fetch carries the current backend account bearer in a header.
 * Errors while parsing events are logged to the console.
 */
import React, { useEffect, useRef } from 'react';
import { useStore } from '../store';
import MessageBubble from './MessageBubble.jsx';
import { accountClient, stream } from '../api';
import ThinkingTicker from './ThinkingTicker.jsx';

export default function ChatWindow() {
  const { state, dispatch } = useStore();
  const bottomRef = useRef();
  const containerRef = useRef();
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  useParallax(containerRef);

  useEffect(() => {
    dispatch({ type: 'SET_AI_THINKING', value: false });
  }, [state.currentConversation, dispatch]);

  useEffect(() => {
    if (!accountClient.getToken() || !state.currentConversation) return;
    const events = stream(`/stream/${state.currentConversation.id}`);

    const handleToken = (e) => {
      try {
        const data = JSON.parse(e.data);
        dispatch({ type: 'APPEND_MESSAGE_CONTENT', id: data.id, content: data.token });
        dispatch({ type: 'SET_AI_THINKING', value: true });
      } catch (err) {
        console.error(err);
      }
    };

    const handleMessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        dispatch({ type: 'UPSERT_MESSAGE', message: data.message });
        dispatch({ type: 'SET_AI_THINKING', value: false });
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
      dispatch({ type: 'SET_AI_THINKING', value: false });
    };
  }, [state.currentConversation, dispatch]);

  if (!accountClient.getToken()) {
    return <div className="chat-stream" role="status">Sign in to use chat.</div>;
  }

  return (
    <div className="chat-stream" data-parallax="true" ref={containerRef}>
      {state.messages.map((m, index) => (
        <MessageBubble key={m.id} message={m} index={index} />
      ))}
      <ThinkingTicker active={state.aiThinking} />
      <div ref={bottomRef} />
    </div>
  );
}

function useParallax(containerRef) {
  const rafRef = useRef();
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const updateParallax = () => {
      const max = el.scrollHeight - el.clientHeight;
      const depth = max > 0 ? el.scrollTop / max : 0;
      el.style.setProperty('--scroll-depth', `${Math.min(Math.max(depth, 0), 1) * 100}`);
      rafRef.current = null;
    };

    const handleScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(updateParallax);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    updateParallax();

    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [containerRef]);
}
