'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { getUser, getToken } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useI18n } from '@/lib/i18n';

function Bubble({ msg, isOwn }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: .95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
      {!isOwn && (
        <Avatar className="w-7 h-7 mr-2 mt-1 flex-shrink-0">
          <AvatarFallback className="bg-moss-light text-moss text-xs font-bold">
            {(msg.sender_name || 'U').substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
      <div className="max-w-[72%] flex flex-col gap-1">
        <div className={isOwn ? 'bubble-sent' : 'bubble-received'}>
          {msg.message || msg.content}
        </div>
        <div className={`text-[10px] text-text3 ${isOwn ? 'text-right' : 'text-left'}`}>
          {formatDate(msg.created_at)}
          {isOwn && msg.read_at && <span className="ml-1 text-moss">✓✓</span>}
        </div>
      </div>
    </motion.div>
  );
}

export default function ChatRoom() {
  const router    = useRouter();
  const { id }    = useParams();
  const [user, setUser]         = useState(null);
  const [msgs, setMsgs]         = useState(null);
  const [conv, setConv]         = useState(null);
  const [input, setInput]       = useState('');
  const [sending, setSending]   = useState(false);
  const [typing, setTyping]     = useState(false);
  const bottomRef               = useRef(null);
  const inputRef                = useRef(null);
  const pollRef                 = useRef(null);
  const socketRef               = useRef(null);
  const { t }                   = useI18n();

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push('/'); return; }
    setUser(u);
    loadMessages();
    // Socket.IO connection attempt
    trySocket(u);
    // Poll as fallback
    pollRef.current = setInterval(loadMessages, 5000);
    return () => {
      clearInterval(pollRef.current);
      socketRef.current?.disconnect?.();
    };
  }, [id]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  function trySocket(u) {
    try {
      // Dynamic import so SSR doesn't break
      import('socket.io-client').then(({ io }) => {
        const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || '';
        const socket = io(apiBase, { auth: { token: getToken() }, transports: ['websocket'] });
        socketRef.current = socket;
        socket.emit('join_conversation', { conversation_id: id });
        socket.on('new_message', (msg) => {
          setMsgs(prev => prev ? [...prev, msg] : [msg]);
        });
        socket.on('typing', ({ user_id }) => {
          if (user_id !== u.id) {
            setTyping(true);
            setTimeout(() => setTyping(false), 3000);
          }
        });
      }).catch(() => {});
    } catch {}
  }

  async function loadMessages() {
    try {
      const data = await api(`/messages/${id}`);
      const msgs = data.messages || data || [];
      setMsgs(msgs);
      setConv(data.conversation || data.conv || null);
    } catch {
      setMsgs([]);
    }
  }

  async function send(e) {
    e?.preventDefault();
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);

    // Optimistic message
    const optimistic = {
      id: 'opt-' + Date.now(),
      message: text,
      sender_id: user?.id,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setMsgs(prev => [...(prev || []), optimistic]);

    try {
      await api(`/messages/${id}`, 'POST', { message: text });
      // Real message will come via socket or next poll
    } catch {
      // Remove optimistic on error
      setMsgs(prev => prev?.filter(m => m.id !== optimistic.id) || []);
      setInput(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function emitTyping() {
    socketRef.current?.emit('typing', { conversation_id: id });
  }

  const otherName = conv
    ? (user?.id === conv.buyer_id ? conv.seller_name : conv.buyer_name) || t('Usuário')
    : '…';

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] md:h-[calc(100vh-64px)] bg-cream">

      {/* ── HEADER ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-c)] bg-cream2/80 backdrop-blur-sm sticky top-0 z-10">
        <button onClick={() => router.push('/chat')} className="p-1.5 rounded-lg hover:bg-cream3 transition-colors text-text2">
          ←
        </button>
        <Avatar className="w-9 h-9">
          <AvatarFallback className="bg-moss-light text-moss text-sm font-bold">
            {otherName.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-soil truncate">{otherName}</div>
          {conv?.listing_title && (
            <div className="text-xs text-text3 truncate">🌾 {conv.listing_title}</div>
          )}
        </div>
        {conv?.listing_id && (
          <button
            onClick={() => router.push('/marketplace')}
            className="btn btn-ghost btn-sm text-xs hidden sm:flex">
            {t('Ver anúncio')}
          </button>
        )}
      </div>

      {/* ── MESSAGES ── */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-4">
        {msgs === null ? (
          <div className="flex flex-col gap-3 pt-4">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <div className={`skeleton h-10 rounded-2xl ${i % 2 === 0 ? 'w-48' : 'w-36'}`} />
              </div>
            ))}
          </div>
        ) : msgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
            <span className="text-5xl">👋</span>
            <p className="font-semibold text-soil">{t('Nenhuma mensagem ainda')}</p>
            <p className="text-sm text-text3">{t('Diga olá e comece a negociar!')}</p>
          </div>
        ) : (
          msgs.map((msg) => (
            <Bubble
              key={msg.id}
              msg={msg}
              isOwn={msg.sender_id === user?.id}
            />
          ))
        )}

        {/* Typing indicator */}
        <AnimatePresence>
          {typing && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex justify-start mb-2">
              <div className="bubble-received flex items-center gap-1 px-4 py-2.5">
                <span className="w-1.5 h-1.5 bg-text3 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-text3 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-text3 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* ── INPUT ── */}
      <form
        onSubmit={send}
        className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border-c)] bg-cream2/80 backdrop-blur-sm">
        <input
          ref={inputRef}
          type="text"
          placeholder={t('Escrever mensagem...')}
          value={input}
          onChange={e => { setInput(e.target.value); emitTyping(); }}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          className="form-input flex-1 py-2.5"
          autoComplete="off"
        />
        <motion.button
          whileTap={{ scale: .92 }}
          type="submit"
          disabled={!input.trim() || sending}
          className="btn btn-primary h-10 w-10 flex items-center justify-center p-0 rounded-full flex-shrink-0 disabled:opacity-40">
          {sending ? '…' : '↑'}
        </motion.button>
      </form>
    </div>
  );
}
