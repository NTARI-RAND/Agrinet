'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import ListingCard, { ListingCardSkeleton } from '@/components/listings/ListingCard';
import ListingDetail from '@/components/listings/ListingDetail';
import NewListingModal from '@/components/listings/NewListingModal';
import { useI18n } from '@/lib/i18n';

const CATEGORIES = [
  { value: '',          label: 'Todos',      emoji: '🌿' },
  { value: 'graos',    label: 'Grãos',      emoji: '🌾' },
  { value: 'frutas',   label: 'Frutas',     emoji: '🍊' },
  { value: 'gado',     label: 'Pecuária',   emoji: '🐄' },
  { value: 'maquinas', label: 'Máquinas',   emoji: '🚜' },
  { value: 'outros',   label: 'Outros',     emoji: '📦' },
];

const STATES = ['SP','MG','PR','RS','GO','MT','MS','BA','SC','PE','CE','RO','PA'];

const DEMO = [
  { id: 'd1', title: 'Soja Safra 2025 — Tipo 1',        category: 'graos',    city: 'Rondonópolis', state: 'MT', price: 145.50, unit: 'saca',  quantity_available: 500  },
  { id: 'd2', title: 'Milho Granado Premium',            category: 'graos',    city: 'Sorriso',      state: 'MT', price: 78.00,  unit: 'saca',  quantity_available: 1200 },
  { id: 'd3', title: 'Laranja Pera Rio',                 category: 'frutas',   city: 'Limeira',      state: 'SP', price: 2.80,   unit: 'kg',    quantity_available: 8000 },
  { id: 'd4', title: 'Nelore Boi Gordo',                 category: 'gado',     city: 'Araçatuba',    state: 'SP', price: 320.00, unit: 'cabeça',quantity_available: 45   },
  { id: 'd5', title: 'Café Arábica Especial',            category: 'graos',    city: 'Varginha',     state: 'MG', price: 980.00, unit: 'saca',  quantity_available: 30   },
  { id: 'd6', title: 'Tomate Italiano Hidropônica',      category: 'frutas',   city: 'Cajamar',      state: 'SP', price: 3.20,   unit: 'kg',    quantity_available: 2500 },
  { id: 'd7', title: 'Trator New Holland T7.240',        category: 'maquinas', city: 'Cascavel',     state: 'PR', price: 480000, unit: 'un.',   quantity_available: 1    },
  { id: 'd8', title: 'Feijão Carioca Safra Nova',        category: 'graos',    city: 'Uberaba',      state: 'MG', price: 220.00, unit: 'saca',  quantity_available: 150  },
];

function MarketplaceInner() {
  const params = useSearchParams();
  const [listings, setListings] = useState(null);
  const [selected, setSelected]   = useState(null);
  const [newListing, setNewListing] = useState(false);
  const [cat, setCat]   = useState(params.get('cat') || '');
  const [search, setSearch] = useState('');
  const [stateF, setStateF] = useState('');
  const [minP, setMinP] = useState('');
  const [maxP, setMaxP] = useState('');
  const [sort, setSort] = useState('recent');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { t } = useI18n();

  async function load() {
    setListings(null);
    let qs = '?status=active&limit=40';
    if (cat)    qs += '&category=' + cat;
    if (stateF) qs += '&state=' + stateF;
    if (minP)   qs += '&minPrice=' + minP;
    if (maxP)   qs += '&maxPrice=' + maxP;
    try {
      const data = await api('/listings' + qs);
      let items = data.listings || data || [];
      if (search) items = items.filter(l =>
        l.title.toLowerCase().includes(search.toLowerCase()) ||
        l.city?.toLowerCase().includes(search.toLowerCase())
      );
      setListings(items);
    } catch {
      setListings(DEMO.filter(l => !cat || l.category === cat));
    }
  }

  useEffect(() => { load(); }, [cat, stateF, sort]);

  function openNew() {
    if (!getToken()) return alert(t('Faça login para anunciar'));
    setNewListing(true);
  }

  const filtered = listings?.filter(l =>
    !search ||
    l.title.toLowerCase().includes(search.toLowerCase()) ||
    l.city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-cream">
      {/* ── HERO HEADER ── */}
      <div className="bg-cream2 border-b border-[var(--border-c)]" style={{ padding: 'clamp(24px,4vw,48px) var(--page-pad) clamp(20px,3vw,36px)' }}>
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 }}>
          <h1 className="font-serif text-3xl md:text-4xl font-black text-soil mb-1">{t('Marketplace')}</h1>
          <p className="text-sm text-text3">{t('Produtos agrícolas de produtores de todo o Brasil')}</p>
        </motion.div>

        {/* SEARCH BAR */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4, delay: .1 }}
          className="flex gap-2 mt-5 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-[480px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text3 text-sm">🔍</span>
            <input
              type="text"
              placeholder={t('Buscar produto ou cidade...')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && load()}
              className="form-input pl-9 w-full"
            />
          </div>
          <button className="btn btn-primary" onClick={load}>{t('Buscar')}</button>
          <button className="btn btn-outline" onClick={openNew}>+ {t('Anunciar')}</button>
          <button
            className="btn btn-ghost md:hidden"
            onClick={() => setFiltersOpen(v => !v)}>
            ⚙ {t('Filtros')}
          </button>
        </motion.div>

        {/* CATEGORY PILLS */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .4, delay: .2 }}
          className="flex gap-2 mt-4 flex-wrap">
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setCat(c.value)}
              className={`cat-pill ${cat === c.value ? 'active' : ''}`}>
              <span>{c.emoji}</span> {t(c.label)}
            </button>
          ))}
        </motion.div>
      </div>

      {/* ── BODY ── */}
      <div style={{ padding: 'clamp(20px,3vw,40px) var(--page-pad)', display: 'grid', gridTemplateColumns: 'clamp(200px,22vw,260px) 1fr', gap: 'clamp(16px,2.5vw,32px)', alignItems: 'start' }}
        className="max-md:grid-cols-1">

        {/* ── SIDEBAR FILTERS (desktop always visible, mobile toggle) ── */}
        <AnimatePresence>
          <motion.aside
            key="sidebar"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: .35 }}
            className={`card-agro p-5 sticky top-20 max-md:static ${filtersOpen ? 'block' : 'max-md:hidden'}`}>

            <div className="text-xs font-semibold uppercase tracking-widest text-text3 mb-3">{t('Estado')}</div>
            <select className="form-input text-sm mb-5 w-full" value={stateF} onChange={e => { setStateF(e.target.value); }}>
              <option value="">{t('Todos')}</option>
              {STATES.map(s => <option key={s}>{s}</option>)}
            </select>

            <div className="text-xs font-semibold uppercase tracking-widest text-text3 mb-3">{t('Preço (R$)')}</div>
            <div className="flex gap-2 items-center mb-1">
              <input type="number" placeholder={t('Mín')} value={minP} onChange={e => setMinP(e.target.value)}
                className="form-input text-sm flex-1" />
              <span className="text-text3 text-sm">—</span>
              <input type="number" placeholder={t('Máx')} value={maxP} onChange={e => setMaxP(e.target.value)}
                className="form-input text-sm flex-1" />
            </div>
            <button className="btn btn-ghost btn-sm w-full mt-2" onClick={load}>{t('Aplicar filtros')}</button>

            <div className="divider my-4" />

            <div className="text-xs font-semibold uppercase tracking-widest text-text3 mb-3">{t('Ordenar por')}</div>
            {[['recent','Mais recentes'],['price_asc','Menor preço'],['price_desc','Maior preço']].map(([v,l]) => (
              <label key={v} className={`filter-option ${sort === v ? 'active' : ''}`}>
                <input type="radio" className="sr-only" checked={sort === v} onChange={() => setSort(v)} />
                <span className={`w-3 h-3 rounded-full border-2 flex-shrink-0 transition-colors ${sort === v ? 'bg-moss border-moss' : 'border-[var(--border-c2)]'}`} />
                {t(l)}
              </label>
            ))}
          </motion.aside>
        </AnimatePresence>

        {/* ── LISTING GRID ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-text3">
              {listings === null
                ? t('Buscando...')
                : `${filtered?.length || 0} ${(filtered?.length || 0) !== 1 ? t('produtos encontrados') : t('produto encontrado')}`}
            </span>
          </div>

          <AnimatePresence mode="wait">
            {listings === null ? (
              <div key="skeletons" className="listing-grid">
                {Array(8).fill(0).map((_, i) => <ListingCardSkeleton key={i} />)}
              </div>
            ) : filtered?.length ? (
              <div key="grid" className="listing-grid">
                {filtered.map((l, i) => (
                  <motion.div
                    key={l.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: .3, delay: i * .04 }}>
                    <ListingCard listing={l} onClick={setSelected} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center py-20 gap-3">
                <span className="text-5xl">🌾</span>
                <p className="text-text3 text-sm">{t('Nenhum produto encontrado')}</p>
                <button className="btn btn-ghost btn-sm" onClick={() => { setCat(''); setSearch(''); setStateF(''); load(); }}>{t('Limpar filtros')}</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {selected   && <ListingDetail listing={selected} onClose={() => setSelected(null)} />}
      {newListing && <NewListingModal onClose={() => setNewListing(false)} onCreated={load} />}
    </div>
  );
}

export default function Marketplace() {
  return <Suspense><MarketplaceInner /></Suspense>;
}
