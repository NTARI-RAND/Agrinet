'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { getUser, clearAuth, isAdmin } from '@/lib/auth';
import { formatCurrency, formatDate, histLabel, CAT_EMOJI, catLabel } from '@/lib/format';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import ListingCard from '@/components/listings/ListingCard';
import NewListingModal from '@/components/listings/NewListingModal';
import { Modal, ModalHeader } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useI18n } from '@/lib/i18n';

const HIST_ICON = {
  deposit:  { icon: '↓', cls: 'bg-moss-light text-moss' },
  purchase: { icon: '↑', cls: 'bg-rust/10 text-rust' },
  sale:     { icon: '↑', cls: 'bg-moss-light text-moss' },
  refund:   { icon: '↩', cls: 'bg-wheat/10 text-wheat' },
};

const TX_ICON = {
  pending:   '⏳', paid: '✅', completed: '✅',
  cancelled: '✗',  disputed: '⚠️', refunded: '↩',
};

function PerfilInner() {
  const router = useRouter();
  const params = useSearchParams();
  const toast  = useToast();
  const { t }  = useI18n();

  const [user, setUser]           = useState(null);
  const [tab, setTab]             = useState(params.get('tab') || 'wallet');
  const [wallet, setWallet]       = useState(null);
  const [history, setHistory]     = useState([]);
  const [txs, setTxs]             = useState(null);
  const [myListings, setMyListings] = useState(null);
  const [newListing, setNewListing] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depAmt, setDepAmt]       = useState('');
  const [txDetail, setTxDetail]   = useState(null);
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push('/'); return; }
    setUser(u);
    loadWallet();
  }, []);

  useEffect(() => {
    if (!user) return;
    if (tab === 'wallet')     loadWallet();
    if (tab === 'transacoes') loadTxs();
    if (tab === 'anuncios')   loadMyListings();
  }, [tab, user]);

  async function loadWallet() {
    try {
      const [w, h] = await Promise.all([
        api('/wallet').catch(() => ({ balance: 0 })),
        api('/wallet/history').catch(() => []),
      ]);
      setWallet(w);
      setHistory(h.history || h || []);
    } catch {}
  }

  async function loadTxs() {
    setTxs(null);
    try {
      const data = await api('/transactions');
      setTxs(data.transactions || data || []);
    } catch { setTxs([]); }
  }

  async function loadMyListings() {
    setMyListings(null);
    try {
      const data = await api('/listings');
      const u = getUser();
      setMyListings((data.listings || data || []).filter(l => l.user_id === u?.id));
    } catch { setMyListings([]); }
  }

  async function doDeposit() {
    const amt = parseFloat(depAmt);
    if (!amt || amt <= 0) return toast(t('Informe um valor'), 'error');
    setLoading(true);
    try {
      await api('/payments/pix/create', 'POST', { amount: amt });
      toast(t('PaymentIntent criado! Verifique o e-mail.'));
      setDepositOpen(false);
      setDepAmt('');
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  async function payTx(id)     { try { await api('/transactions/'+id+'/pay','POST');     toast(t('Pagamento iniciado!'));  loadTxs(); } catch(e){ toast(e.message,'error'); } }
  async function releaseTx(id) { try { await api('/transactions/'+id+'/release','POST'); toast(t('Escrow liberado!'));     loadTxs(); loadWallet(); } catch(e){ toast(e.message,'error'); } }
  async function disputeTx(id) {
    const reason = prompt(t('Motivo da disputa:'));
    if (!reason) return;
    try { await api('/transactions/'+id+'/dispute','POST',{ reason }); toast(t('Disputa aberta'),'info'); loadTxs(); }
    catch(e){ toast(e.message,'error'); }
  }
  async function showTxDetail(id) {
    try { const d = await api('/transactions/'+id); setTxDetail(d.transaction || d); }
    catch(e){ toast(e.message,'error'); }
  }

  if (!user) return null;

  const initials = (user.email || 'U').substring(0, 2).toUpperCase();
  const bal  = wallet?.balance || 0;
  let inc = 0, out = 0, sales = 0;
  history.forEach(h => {
    const a = Number(h.amount);
    if (h.type === 'deposit')  inc   += a;
    if (h.type === 'purchase') out   += Math.abs(a);
    if (h.type === 'sale')     sales += a;
  });

  const TABS = [
    { key: 'wallet',     label: 'Wallet',         icon: '💰' },
    { key: 'transacoes', label: 'Transações',      icon: '⇄' },
    { key: 'anuncios',   label: 'Meus anúncios',   icon: '🌾' },
  ];

  return (
    <div className="min-h-screen bg-cream">
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'clamp(20px,3vw,40px) var(--page-pad)' }}>

        {/* ── PROFILE HEADER ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 }}
          className="card-agro p-6 mb-6 flex items-center gap-5 flex-wrap">
          <Avatar className="w-16 h-16 flex-shrink-0">
            <AvatarFallback className="bg-moss-light text-moss text-2xl font-serif font-black">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-2xl font-black text-soil leading-tight">
              {(user.email || '').split('@')[0]}
            </h1>
            <p className="text-sm text-text3 mt-0.5">{user.email}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Badge variant="green">{user.trust_level || 'new'}</Badge>
              {isAdmin(user) && <Badge variant="wheat">{t('Admin')}</Badge>}
              <Badge variant="gray">Rep: {user.reputation_score ?? 0}</Badge>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm self-start" onClick={() => { clearAuth(); router.push('/'); }}>
            {t('Sair')}
          </button>
        </motion.div>

        {/* ── TABS ── */}
        <div className="flex border-b-2 border-[var(--border-c)] mb-6 gap-1">
          {TABS.map(tabItem => (
            <button key={tabItem.key} className={`profile-tab ${tab === tabItem.key ? 'active' : ''}`} onClick={() => setTab(tabItem.key)}>
              <span className="hidden sm:inline">{tabItem.icon} </span>{t(tabItem.label)}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: .25 }}>

            {/* ══ WALLET TAB ══ */}
            {tab === 'wallet' && (
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {/* Balance card */}
                  <div className="wallet-card rounded-2xl p-6 flex flex-col">
                    <div className="text-xs font-semibold uppercase tracking-widest text-white/70 mb-1">{t('Saldo disponível')}</div>
                    <div className="font-serif text-4xl font-black text-white mt-1">{formatCurrency(bal)}</div>
                    <div className="mt-auto pt-6">
                      <button
                        onClick={() => setDepositOpen(true)}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white border border-white/30 bg-white/10 hover:bg-white/20 transition-colors">
                        + {t('Depositar')}
                      </button>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="card-agro p-6 flex flex-col gap-3">
                    <div className="text-xs font-semibold uppercase tracking-widest text-text3 mb-1">{t('Resumo')}</div>
                    {[
                      ['Total depositado',    formatCurrency(inc),   'text-moss'],
                      ['Total gasto',         formatCurrency(out),   'text-rust'],
                      ['Recebido em vendas',  formatCurrency(sales), 'text-moss'],
                    ].map(([label, val, cls]) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-sm text-text3">{t(label)}</span>
                        <span className={`text-sm font-semibold ${cls}`}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* History */}
                <div className="card-agro p-5">
                  <div className="text-xs font-semibold uppercase tracking-widest text-text3 mb-4">{t('Histórico de movimentações')}</div>
                  {history.length === 0 ? (
                    <div className="flex flex-col items-center py-10 gap-2">
                      <span className="text-3xl">💸</span>
                      <p className="text-sm text-text3">{t('Nenhuma movimentação')}</p>
                    </div>
                  ) : history.slice(0, 20).map((h, i) => {
                    const ic = HIST_ICON[h.type] || { icon: '•', cls: 'bg-cream2 text-text2' };
                    const pos = Number(h.amount) > 0;
                    return (
                      <div key={i} className="history-item">
                        <div className={`history-icon ${ic.cls}`}>{ic.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-soil">{t(histLabel(h.type))}</div>
                          <div className="text-xs text-text3 mt-0.5">{h.note || ''} · {formatDate(h.created_at)}</div>
                        </div>
                        <div className={`text-sm font-semibold ${pos ? 'text-moss' : 'text-rust'}`}>
                          {pos ? '+' : ''}{formatCurrency(Math.abs(Number(h.amount)))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ══ TRANSACTIONS TAB ══ */}
            {tab === 'transacoes' && (
              <div className="flex flex-col gap-3">
                {txs === null
                  ? Array(3).fill(0).map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)
                  : txs.length === 0
                    ? <div className="flex flex-col items-center py-20 gap-2">
                        <span className="text-4xl">⇄</span>
                        <p className="text-sm text-text3">{t('Nenhuma transação ainda')}</p>
                      </div>
                    : txs.map((tx, i) => {
                        const isBuyer = tx.buyer_id === user.id;
                        return (
                          <motion.div
                            key={tx.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * .04 }}
                            className="tx-item">
                            <div className="tx-icon">{TX_ICON[tx.status] || '•'}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[15px] font-semibold text-soil leading-tight">{tx.listing_title || t('Produto')}</div>
                              <div className="text-xs text-text3 mt-1">{isBuyer ? t('Compra') : t('Venda')} · {formatDate(tx.created_at)}</div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <StatusBadge status={tx.status} />
                              <div className="font-serif text-xl font-black text-soil">{formatCurrency(tx.amount)}</div>
                              <div className="flex gap-1.5 flex-wrap justify-end">
                                {tx.status === 'pending'  && isBuyer  && <button className="btn btn-primary btn-sm"  onClick={() => payTx(tx.id)}>{t('Pagar')}</button>}
                                {tx.status === 'paid'     && !isBuyer && <button className="btn btn-ghost btn-sm"    onClick={() => releaseTx(tx.id)}>{t('Liberar')}</button>}
                                {tx.status === 'paid'     && isBuyer  && <button className="btn btn-danger btn-sm"   onClick={() => disputeTx(tx.id)}>{t('Disputar')}</button>}
                                <button className="btn btn-ghost btn-sm" onClick={() => showTxDetail(tx.id)}>{t('Ver')}</button>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })
                }
              </div>
            )}

            {/* ══ LISTINGS TAB ══ */}
            {tab === 'anuncios' && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <span className="text-sm text-text3">{t('Seus anúncios publicados')}</span>
                  <button className="btn btn-primary btn-sm" onClick={() => setNewListing(true)}>+ {t('Novo anúncio')}</button>
                </div>
                <div className="listing-grid">
                  {myListings === null
                    ? Array(4).fill(0).map((_, i) => <div key={i} className="skeleton h-52 rounded-xl" />)
                    : myListings.length === 0
                      ? <div className="col-span-full flex flex-col items-center py-20 gap-2">
                          <span className="text-5xl">🌾</span>
                          <p className="text-sm text-text3">{t('Nenhum anúncio publicado')}</p>
                          <button className="btn btn-primary btn-sm" onClick={() => setNewListing(true)}>{t('Criar primeiro anúncio')}</button>
                        </div>
                      : myListings.map(l => <ListingCard key={l.id} listing={l} />)
                  }
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── DEPOSIT MODAL ── */}
      {depositOpen && (
        <Modal onClose={() => setDepositOpen(false)} maxWidth="400px">
          <ModalHeader title={t('Depositar na wallet')} onClose={() => setDepositOpen(false)} />
          <div className="form-group">
            <label className="form-label">{t('Valor (R$)')}</label>
            <input type="number" placeholder="0,00" step="0.01" min="1"
              className="form-input" value={depAmt} onChange={e => setDepAmt(e.target.value)} />
          </div>
          <div className="bg-cream2 border border-[var(--border-c)] rounded-lg p-3 text-sm text-text3 mb-4 leading-relaxed">
            {t('Pagamento processado com segurança via Stripe. Saldo creditado instantaneamente.')}
          </div>
          <button className="btn btn-primary w-full" onClick={doDeposit} disabled={loading}>
            {loading ? t('Processando...') : t('Confirmar depósito')}
          </button>
        </Modal>
      )}

      {/* ── TX DETAIL MODAL ── */}
      {txDetail && (
        <Modal onClose={() => setTxDetail(null)}>
          <ModalHeader title={t('Detalhes da transação')} onClose={() => setTxDetail(null)} />
          <div className="flex gap-2 mb-4 flex-wrap">
            <StatusBadge status={txDetail.status} />
            {txDetail.escrow_locked && <Badge variant="wheat">{t('Escrow ativo')}</Badge>}
          </div>
          <div className="flex flex-col gap-3">
            {[
              ['Produto',        txDetail.listing_title || '—'],
              ['Quantidade',     txDetail.quantity || '—'],
              ['Preço unitário', formatCurrency(txDetail.unit_price)],
            ].map(([l, v]) => (
              <div key={l} className="flex items-center justify-between">
                <span className="text-sm text-text3">{t(l)}</span>
                <span className="text-sm font-semibold text-soil">{v}</span>
              </div>
            ))}
            <div className="border-t border-[var(--border-c)] my-1" />
            <div className="flex items-center justify-between">
              <span className="font-semibold text-soil">{t('Total')}</span>
              <span className="font-serif text-2xl font-black text-moss">{formatCurrency(txDetail.amount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text3">{t('Criada em')}</span>
              <span className="text-sm text-text3">{formatDate(txDetail.created_at)}</span>
            </div>
          </div>
        </Modal>
      )}

      {newListing && <NewListingModal onClose={() => setNewListing(false)} onCreated={loadMyListings} />}
    </div>
  );
}

export default function Perfil() {
  return <Suspense><PerfilInner /></Suspense>;
}
