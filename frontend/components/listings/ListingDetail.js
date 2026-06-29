'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Modal, ModalHeader } from '@/components/ui/Modal';
import { catLabel, CAT_EMOJI, formatCurrency, formatDate } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';

const CAT_BG = {
  graos:    'from-amber-50 to-yellow-100',
  frutas:   'from-orange-50 to-amber-100',
  gado:     'from-green-50 to-emerald-100',
  maquinas: 'from-slate-50 to-gray-100',
  outros:   'from-cream to-cream2',
};

export default function ListingDetail({ listing, onClose }) {
  const [qty, setQty]         = useState('');
  const [loading, setLoading] = useState(false);
  const toast  = useToast();
  const router = useRouter();
  const { t } = useI18n();
  const l = listing;

  async function buy() {
    const q = parseFloat(qty);
    if (!q || q <= 0) return toast(t('Informe a quantidade'), 'error');
    setLoading(true);
    try {
      await api('/transactions/from-listing', 'POST', { listingId: l.id, quantity: q });
      toast(t('Compra iniciada! Acesse seu perfil para pagar.'));
      onClose();
      router.push('/perfil?tab=transacoes');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  const bg = CAT_BG[l.category] || CAT_BG.outros;

  return (
    <Modal onClose={onClose} maxWidth="560px">
      <ModalHeader title={l.title} onClose={onClose} />

      {/* IMAGE */}
      <div className={`h-44 rounded-xl mb-5 bg-gradient-to-br ${bg} flex items-center justify-center overflow-hidden`}>
        {l.images?.[0]
          ? <img src={l.images[0]} alt={l.title} className="w-full h-full object-cover" />
          : <span className="text-7xl select-none">{CAT_EMOJI[l.category] || '📦'}</span>
        }
      </div>

      {/* PRICE + AVAILABILITY */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="flex gap-2 mb-2">
            <Badge variant="green">{t(catLabel(l.category))}</Badge>
            <Badge variant="gray">{l.unit}</Badge>
          </div>
          <div className="font-serif text-4xl font-black text-moss leading-none">
            {formatCurrency(l.price)}
          </div>
          <div className="text-sm text-text3 mt-1">{t('por')} {l.unit}</div>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold uppercase tracking-widest text-text3 mb-1">{t('Disponível')}</div>
          <div className="font-serif text-2xl font-bold text-soil">
            {Number(l.quantity_available).toLocaleString('pt-BR')}
          </div>
          <div className="text-xs text-text3">{l.unit}</div>
        </div>
      </div>

      {/* DESCRIPTION */}
      {l.description && (
        <p className="text-sm text-text2 leading-relaxed mb-4">{l.description}</p>
      )}

      {/* LOCATION + DATE */}
      <div className="flex items-center justify-between text-sm text-text3 mb-4">
        <span>📍 {l.city}, {l.state}</span>
        {l.created_at && <span>{formatDate(l.created_at)}</span>}
      </div>

      <div className="border-t border-[var(--border-c)] my-4" />

      {/* BUY FORM */}
      <div className="form-group">
        <label className="form-label">{t('Quantidade')} ({l.unit})</label>
        <input
          type="number"
          className="form-input"
          placeholder={`${t('Ex:')} 10 ${l.unit}`}
          min="1"
          max={l.quantity_available}
          value={qty}
          onChange={e => setQty(e.target.value)}
        />
        {qty && parseFloat(qty) > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-sm font-semibold text-moss">
            {t('Total estimado')}: {formatCurrency(parseFloat(qty) * l.price)}
          </motion.div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          className="btn btn-primary flex-1"
          onClick={buy}
          disabled={loading}>
          {loading ? t('Aguarde...') : `🛒 ${t('Comprar agora')}`}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>{t('Cancelar')}</button>
      </div>
    </Modal>
  );
}
