'use client';
import { motion } from 'framer-motion';
import { catLabel, CAT_EMOJI, formatCurrency } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

const CAT_BG = {
  graos:    'from-amber-50 to-yellow-100',
  frutas:   'from-orange-50 to-amber-100',
  gado:     'from-green-50 to-emerald-100',
  maquinas: 'from-slate-50 to-gray-100',
  outros:   'from-cream to-cream2',
};

export default function ListingCard({ listing, onClick }) {
  const { t } = useI18n();
  const l = listing;
  const bg = CAT_BG[l.category] || CAT_BG.outros;

  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(44,31,14,.12)' }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="listing-card cursor-pointer"
      onClick={() => onClick?.(l)}>

      {/* IMAGE / EMOJI AREA */}
      <div className={`listing-img bg-gradient-to-br ${bg} relative`}>
        {l.images?.[0]
          ? <img src={l.images[0]} alt={l.title} className="w-full h-full object-cover" />
          : <span className="text-5xl select-none">{CAT_EMOJI[l.category] || '📦'}</span>
        }
        <div className="absolute top-2.5 left-2.5">
          <span className="badge-agro badge-green text-[10px]">{t(catLabel(l.category))}</span>
        </div>
        {l.quantity_available <= 10 && (
          <div className="absolute top-2.5 right-2.5">
            <span className="badge-agro badge-rust text-[10px]">{t('Últimas unidades')}</span>
          </div>
        )}
      </div>

      {/* BODY */}
      <div className="listing-body">
        <div className="listing-title line-clamp-2">{l.title}</div>
        <div className="listing-loc">
          <span className="text-xs">📍</span> {l.city}, {l.state}
        </div>
        <div className="flex items-baseline gap-1 mt-auto pt-2">
          <span className="listing-price">{formatCurrency(l.price)}</span>
          <span className="listing-unit">/{l.unit}</span>
        </div>
        <div className="listing-qty">
          {Number(l.quantity_available).toLocaleString('pt-BR')} {t('disponível')}
        </div>
      </div>
    </motion.div>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden border border-[var(--border-c)]">
      <div className="skeleton h-36" />
      <div className="p-4 flex flex-col gap-2.5">
        <div className="skeleton h-3.5 w-4/5 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton h-5 w-2/5 rounded mt-1" />
      </div>
    </div>
  );
}
