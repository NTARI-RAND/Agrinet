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
import { stream } from '../api';
import ThinkingTicker from './ThinkingTicker.jsx';

export default function ChatWindow() {
  const { state, dispatch } = useStore();
  const bottomRef = useRef();
  const containerRef = useRef();
  const rafRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

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
  }, []);

  useEffect(() => {
    dispatch({ type: 'SET_AI_THINKING', value: false });
  }, [state.currentConversation, dispatch]);

  useEffect(() => {
    if (!state.currentConversation) return;
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
