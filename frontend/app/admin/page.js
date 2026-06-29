'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { getUser, isAdmin } from '@/lib/auth';
import { formatCurrency, formatDate } from '@/lib/format';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import AnimatedStat from '@/components/motion/AnimatedStat';
import { useI18n } from '@/lib/i18n';

const STAT_CONFIG = [
  { key: 'users_total',        fallback: 'totalUsers',  label: 'Usuários',         icon: '👥', cls: 'from-moss/10 to-moss-light border-moss/20' },
  { key: 'listings_active',    fallback: null,          label: 'Anúncios ativos',   icon: '🌾', cls: 'from-wheat/10 to-amber-50 border-wheat/20' },
  { key: 'transactions_today', fallback: null,          label: 'Transações hoje',   icon: '⇄',  cls: 'from-sky-50 to-blue-50 border-sky-200' },
  { key: 'disputes_open',      fallback: null,          label: 'Disputas abertas',  icon: '⚠️', cls: 'from-rust/10 to-orange-50 border-rust/20' },
];

const ADMIN_TABS = [
  { key: 'users',    label: 'Usuários',      icon: '👥', endpoint: '/admin/users' },
  { key: 'listings', label: 'Anúncios',      icon: '🌾', endpoint: '/admin/listings' },
  { key: 'disputes', label: 'Disputas',      icon: '⚠️', endpoint: '/admin/disputes' },
  { key: 'fraud',    label: 'Fila de fraude',icon: '🚨', endpoint: '/admin/fraud-queue' },
  { key: 'payments', label: 'Pagamentos',    icon: '💳', endpoint: '/admin/payments' },
];

export default function Admin() {
  const router = useRouter();
  const toast  = useToast();
  const { t } = useI18n();
  const [stats, setStats] = useState({});
  const [tab, setTab]     = useState('users');
  const [data, setData]   = useState(null);

  useEffect(() => {
    const u = getUser();
    if (!u || !isAdmin(u)) { router.push('/'); return; }
    loadStats();
    loadTab('users');
  }, []);

  async function loadStats() {
    try {
      const s = await api('/admin/stats').catch(() => ({}));
      setStats(s);
    } catch {}
  }

  async function loadTab(t) {
    setTab(t);
    setData(null);
    const ep = ADMIN_TABS.find(x => x.key === t)?.endpoint;
    try {
      const res = await api(ep);
      setData(res.users || res.listings || res.disputes || res.queue || res.payments || res || []);
    } catch(e) {
      setData([]);
      toast(e.message, 'error');
    }
  }

  async function action(path, method, body, label) {
    try {
      await api(path, method, body);
      toast(t(label) + ' ' + t('com sucesso'));
      loadTab(tab);
      loadStats();
    } catch(e) { toast(e.message, 'error'); }
  }

  return (
    <div className="min-h-screen bg-cream">
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: 'clamp(20px,3vw,40px) var(--page-pad)' }}>

        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 }} className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">⚙️</span>
            <h1 className="font-serif text-3xl font-black text-soil">{t('Painel Administrativo')}</h1>
          </div>
          <p className="text-sm text-text3 ml-11">{t('Gestão de usuários, anúncios, disputas e fraudes')}</p>
        </motion.div>

        {/* STAT CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {STAT_CONFIG.map((s, i) => {
            const val = stats[s.key] ?? (s.fallback ? stats[s.fallback] : undefined);
            return (
              <motion.div
                key={s.key}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * .08, duration: .35 }}
                className={`card-agro p-5 bg-gradient-to-br ${s.cls} border`}>
                <div className="text-2xl mb-2">{s.icon}</div>
                <div className="text-xs font-semibold uppercase tracking-widest text-text3 mb-1">{t(s.label)}</div>
                <div className="font-serif text-3xl font-black text-soil">
                  {val != null ? <AnimatedStat target={Number(val) || 0} /> : '—'}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* TABS */}
        <div className="flex gap-1.5 mb-6 flex-wrap border-b border-[var(--border-c)] pb-0">
          {ADMIN_TABS.map(tabItem => (
            <button
              key={tabItem.key}
              onClick={() => loadTab(tabItem.key)}
              className={`admin-tab ${tab === tabItem.key ? 'active' : ''}`}>
              <span className="hidden sm:inline">{tabItem.icon} </span>{t(tabItem.label)}
            </button>
          ))}
        </div>

        {/* TABLE */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: .2 }}
            className="card-agro overflow-hidden">
            {data === null ? (
              <div className="flex flex-col items-center py-16 gap-3">
                <div className="skeleton w-8 h-8 rounded-full" />
                <div className="skeleton h-3 w-32 rounded" />
              </div>
            ) : data.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-2">
                <span className="text-3xl">📭</span>
                <p className="text-sm text-text3">{t('Nenhum item encontrado')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-agro">
                  {tab === 'users' && (
                    <>
                      <thead><tr><th>Email</th><th>Role</th><th>Trust</th><th>{t('Fraude')}</th><th>Status</th><th>{t('Ações')}</th></tr></thead>
                      <tbody>
                        {data.map(u => (
                          <tr key={u.id}>
                            <td className="font-medium">{u.email}</td>
                            <td><Badge variant={u.role === 'admin' ? 'wheat' : 'gray'}>{u.role}</Badge></td>
                            <td>{u.trust_level || '—'}</td>
                            <td>
                              <span className={`text-sm font-semibold ${(u.fraud_score||0) > 50 ? 'text-rust' : 'text-moss'}`}>
                                {u.fraud_score ?? '—'}
                              </span>
                            </td>
                            <td>{u.is_blocked ? <Badge variant="rust">{t('Bloqueado')}</Badge> : <Badge variant="green">{t('Ativo')}</Badge>}</td>
                            <td>
                              {u.is_blocked
                                ? <button className="btn btn-ghost btn-sm" onClick={() => action(`/admin/users/${u.id}/unblock`,'POST',null,'Desbloqueado')}>{t('Desbloquear')}</button>
                                : <button className="btn btn-danger btn-sm" onClick={() => action(`/admin/users/${u.id}/block`,'POST',{duration:60},'Bloqueado')}>{t('Bloquear')}</button>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}
                  {tab === 'listings' && (
                    <>
                      <thead><tr><th>{t('Produto')}</th><th>Cat.</th><th>{t('Preço')}</th><th>Status</th><th>{t('Moderação')}</th><th>{t('Ações')}</th></tr></thead>
                      <tbody>
                        {data.map(l => (
                          <tr key={l.id}>
                            <td className="font-medium max-w-[200px] truncate">{l.title}</td>
                            <td>{l.category}</td>
                            <td className="font-semibold">{formatCurrency(l.price)}</td>
                            <td><StatusBadge status={l.status} /></td>
                            <td><Badge variant={l.moderation_status === 'approved' ? 'green' : 'rust'}>{l.moderation_status || '—'}</Badge></td>
                            <td><button className="btn btn-danger btn-sm" onClick={() => action(`/admin/listings/${l.id}/remove`,'POST',null,'Removido')}>{t('Remover')}</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}
                  {tab === 'disputes' && (
                    <>
                      <thead><tr><th>ID</th><th>{t('Motivo')}</th><th>Status</th><th>{t('Ações')}</th></tr></thead>
                      <tbody>
                        {data.map(d => (
                          <tr key={d.id}>
                            <td className="text-xs text-text3 font-mono">{d.id?.substring(0,8)}…</td>
                            <td>{d.reason}</td>
                            <td><StatusBadge status={d.status} /></td>
                            <td>
                              {d.status === 'open' && (
                                <div className="flex gap-1.5">
                                  <button className="btn btn-primary btn-sm" onClick={() => action(`/admin/disputes/${d.id}/resolve`,'POST',{resolution:'release'},'Liberado')}>{t('Liberar')}</button>
                                  <button className="btn btn-danger btn-sm" onClick={() => action(`/admin/disputes/${d.id}/resolve`,'POST',{resolution:'refund'},'Reembolsado')}>{t('Reembolsar')}</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}
                  {tab === 'fraud' && (
                    <>
                      <thead><tr><th>{t('Usuário')}</th><th>{t('Motivo')}</th><th>Score</th><th>Status</th><th>{t('Ações')}</th></tr></thead>
                      <tbody>
                        {data.map(f => (
                          <tr key={f.id}>
                            <td className="text-xs text-text3 font-mono">{f.user_id?.substring(0,8)}…</td>
                            <td>{f.reason || '—'}</td>
                            <td>
                              <span className={`font-semibold ${(f.fraud_score||0) > 50 ? 'text-rust' : 'text-wheat'}`}>
                                {f.fraud_score ?? '—'}
                              </span>
                            </td>
                            <td><Badge variant="wheat">{f.status}</Badge></td>
                            <td>
                              <div className="flex gap-1.5">
                                <button className="btn btn-ghost btn-sm" onClick={() => action(`/admin/fraud-queue/${f.id}/approve`,'POST',null,'Aprovado')}>{t('Aprovar')}</button>
                                <button className="btn btn-danger btn-sm" onClick={() => action(`/admin/fraud-queue/${f.id}/block`,'POST',null,'Bloqueado')}>{t('Bloquear')}</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}
                  {tab === 'payments' && (
                    <>
                      <thead><tr><th>ID</th><th>{t('Valor')}</th><th>Status</th><th>{t('Data')}</th></tr></thead>
                      <tbody>
                        {data.map(p => (
                          <tr key={p.id}>
                            <td className="text-xs text-text3 font-mono">{p.id?.substring(0,20)}…</td>
                            <td className="font-semibold">{formatCurrency(p.amount)}</td>
                            <td><StatusBadge status={p.status} /></td>
                            <td className="text-xs text-text3">{formatDate(p.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}
                </table>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
