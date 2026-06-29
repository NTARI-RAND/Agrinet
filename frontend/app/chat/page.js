'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useI18n } from '@/lib/i18n';

function ConversationItem({ conv, user, onClick }) {
  const { t } = useI18n();
  const other = conv.buyer_id === user?.id ? conv.seller_name : conv.buyer_name;
  const otherInitials = (other || 'U').substring(0, 2).toUpperCase();
  const last = conv.last_message;
  const unread = conv.unread_count || 0;

  return (
    <motion.div
      whileHover={{ x: 4 }}
      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer rounded-xl transition-colors ${unread ? 'bg-moss-light/60' : 'hover:bg-cream2'}`}>
      <div className="relative flex-shrink-0">
        <Avatar className="w-11 h-11">
          <AvatarFallback className="bg-moss-light text-moss text-sm font-bold">
            {otherInitials}
          </AvatarFallback>
        </Avatar>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rust text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm truncate ${unread ? 'font-semibold text-soil' : 'font-medium text-soil'}`}>{other || t('Usuário')}</span>
          {conv.last_message_at && (
            <span className="text-[10px] text-text3 flex-shrink-0">{formatDate(conv.last_message_at)}</span>
          )}
        </div>
        <div className="text-xs text-text3 truncate mt-0.5">{conv.listing_title && <span className="text-moss font-medium">🌾 {conv.listing_title} · </span>}{last || t('Nenhuma mensagem')}</div>
      </div>
    </motion.div>
  );
}

export default function ChatList() {
  const router = useRouter();
  const [user, setUser]       = useState(null);
  const [convs, setConvs]     = useState(null);
  const [search, setSearch]   = useState('');
  const { t } = useI18n();

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push('/'); return; }
    setUser(u);
    loadConvs();
  }, []);

  async function loadConvs() {
    try {
      const data = await api('/messages/conversations');
      setConvs(data.conversations || data || []);
    } catch {
      // demo state
      setConvs([]);
    }
  }

  const filtered = convs?.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.buyer_name || '').toLowerCase().includes(q) ||
           (c.seller_name || '').toLowerCase().includes(q) ||
           (c.listing_title || '').toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* HEADER */}
      <div className="border-b border-[var(--border-c)] bg-cream2/80 backdrop-blur-sm sticky top-0 z-10"
        style={{ padding: 'clamp(16px,2.5vw,28px) var(--page-pad) 12px' }}>
        <motion.h1
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="font-serif text-2xl font-black text-soil mb-3">
          {t('Mensagens')}
        </motion.h1>
        <div className="relative max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text3 text-sm">🔍</span>
          <input
            type="text"
            placeholder={t('Buscar conversa...')}
            className="form-input pl-9 w-full"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* LIST */}
      <div className="flex-1 overflow-y-auto" style={{ maxWidth: 680, width: '100%', margin: '0 auto', padding: '8px var(--page-pad) 20px' }}>
        {convs === null ? (
          <div className="flex flex-col gap-2 pt-4">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="skeleton w-11 h-11 rounded-full flex-shrink-0" />
                <div className="flex-1 flex flex-col gap-2">
                  <div className="skeleton h-3.5 w-1/3 rounded" />
                  <div className="skeleton h-3 w-2/3 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered?.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center py-24 gap-4">
            <span className="text-6xl">💬</span>
            <div className="text-center">
              <p className="font-semibold text-soil mb-1">{t('Nenhuma conversa')}</p>
              <p className="text-sm text-text3">{t('Inicie uma negociação pelo marketplace para começar a trocar mensagens.')}</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => router.push('/marketplace')}>
              {t('Explorar marketplace')}
            </button>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-0.5 pt-2">
            <AnimatePresence>
              {filtered.map((conv, i) => (
                <motion.div
                  key={conv.id || conv.transaction_id || i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * .04 }}>
                  <ConversationItem
                    conv={conv}
                    user={user}
                    onClick={() => router.push(`/chat/${conv.id || conv.transaction_id}`)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
