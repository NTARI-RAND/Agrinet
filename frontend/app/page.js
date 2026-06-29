'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import ScrollReveal, { ScrollRevealGrid, ScrollRevealItem } from '@/components/motion/ScrollReveal';
import AnimatedStat from '@/components/motion/AnimatedStat';
import ListingCard, { ListingCardSkeleton } from '@/components/listings/ListingCard';
import ListingDetail from '@/components/listings/ListingDetail';
import { useI18n } from '@/lib/i18n';

const DEMO = [
  { id: 'd1', title: 'Soja Safra 2025 — Tipo 1', category: 'graos', city: 'Rondonópolis', state: 'MT', price: 145.50, unit: 'saca', quantity_available: 500, description: 'Excelente qualidade, teor de proteína acima de 36%.' },
  { id: 'd2', title: 'Milho Granado Premium', category: 'graos', city: 'Sorriso', state: 'MT', price: 78.00, unit: 'saca', quantity_available: 1200, description: 'Produção própria, armazenado em silo metálico.' },
  { id: 'd3', title: 'Laranja Pera Rio — Safra Nova', category: 'frutas', city: 'Limeira', state: 'SP', price: 2.80, unit: 'kg', quantity_available: 8000, description: 'Colhida esta semana, alta brix.' },
  { id: 'd4', title: 'Nelore Boi Gordo', category: 'gado', city: 'Araçatuba', state: 'SP', price: 320.00, unit: 'cabeça', quantity_available: 45, description: 'Lote selecionado, peso médio 18@.' },
  { id: 'd5', title: 'Café Arábica Especial', category: 'graos', city: 'Varginha', state: 'MG', price: 980.00, unit: 'saca', quantity_available: 30, description: 'Nota 85 pontos SCA, cereja descascado.' },
  { id: 'd6', title: 'Tomate Italiano Hidropônica', category: 'frutas', city: 'Cajamar', state: 'SP', price: 3.20, unit: 'kg', quantity_available: 2500, description: 'Produção hidropônica, colheita diária.' },
];

const STEPS = [
  { n: '01', icon: '🌾', title: 'Escolha o produto', desc: 'Busque entre centenas de produtores por categoria, região e preço.' },
  { n: '02', icon: '💬', title: 'Negocie diretamente', desc: 'Converse com o produtor pelo chat integrado antes de fechar negócio.' },
  { n: '03', icon: '🔒', title: 'Pague com segurança', desc: 'O valor fica em escrow. Ninguém recebe antes da confirmação.' },
  { n: '04', icon: '✅', title: 'Confirme e avalie', desc: 'Recebeu? Confirme e o produtor recebe na hora. Simples assim.' },
];

const CATS = [
  { slug: '', label: 'Tudo', emoji: '✨' },
  { slug: 'graos', label: 'Grãos & Cereais', emoji: '🌾' },
  { slug: 'frutas', label: 'Frutas & Hortaliças', emoji: '🍎' },
  { slug: 'gado', label: 'Pecuária', emoji: '🐄' },
  { slug: 'maquinas', label: 'Máquinas', emoji: '🚜' },
  { slug: 'outros', label: 'Insumos', emoji: '📦' },
];

export default function Landing() {
  const [listings, setListings] = useState(null);
  const [selected, setSelected] = useState(null);
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000') + '/listings?limit=6&status=active')
      .then(r => r.json())
      .then(d => setListings((d.listings || d || []).slice(0, 6)))
      .catch(() => setListings(DEMO));
  }, []);

  return (
    <>
      {/* ══════════════════ HERO ══════════════════ */}
      <section className="relative min-h-[92vh] grid overflow-hidden"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(480px,100%), 1fr))' }}>

        {/* BG decoration */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-5"
            style={{ background: 'radial-gradient(circle, var(--moss3), transparent 70%)' }} />
          <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full opacity-[.03]"
            style={{ background: 'radial-gradient(circle, var(--wheat), transparent 70%)' }} />
        </div>

        {/* LEFT */}
        <div className="flex flex-col justify-center relative z-10"
          style={{ padding: 'var(--space-xl) var(--page-pad)' }}>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: .5, ease: [.22,1,.36,1] }}
            className="flex items-center gap-2 mb-6">
            <div className="flex gap-1">
              {[0,1,2].map(i => (
                <motion.span key={i} className="block w-1.5 h-1.5 rounded-full bg-moss3"
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ duration: 1.2, delay: i * .2, repeat: Infinity }} />
              ))}
            </div>
            <span className="text-xs font-semibold tracking-[.12em] uppercase text-moss">
              {t('Marketplace Agrícola Descentralizado')}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: .6, delay: .1, ease: [.22,1,.36,1] }}
            className="font-serif font-black leading-[1.04] text-soil mb-5"
            style={{ fontSize: 'clamp(38px,5.5vw,72px)', letterSpacing: '-1.5px' }}>
            {t('O campo')}{' '}
            <span className="relative">
              <em className="not-italic text-moss">{t('conectado')}</em>
              <motion.span
                className="absolute -bottom-1 left-0 h-[3px] bg-moss3 rounded-full"
                initial={{ width: 0 }} animate={{ width: '100%' }}
                transition={{ duration: .8, delay: .7, ease: [.22,1,.36,1] }} />
            </span>
            {' '}{t('ao mercado')}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: .5, delay: .25, ease: [.22,1,.36,1] }}
            className="text-text2 leading-relaxed mb-10 font-light max-w-[44ch]"
            style={{ fontSize: 'clamp(15px,1.2vw,18px)' }}>
            {t('Compre e venda commodities agrícolas com segurança. Escrow garantido, pagamento protegido. Da roça ao comprador, sem intermediários.')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: .4, delay: .35 }}
            className="flex gap-3 flex-wrap">
            <button className="btn btn-primary btn-lg" onClick={() => router.push('/marketplace')}>
              {t('Explorar produtos')}
            </button>
            <button className="btn btn-outline btn-lg" onClick={() => router.push('/marketplace')}>
              {t('Vender no Agrinet')}
            </button>
          </motion.div>

          {/* STATS */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: .6, delay: .55 }}
            className="flex flex-wrap gap-8 mt-12 pt-8 border-t border-[var(--border-c)]">
            {[
              { n: 2400000, fmt: 'R$\u00a02,4M', label: 'Negociados no mês' },
              { n: 1240, suffix: '+', label: 'Produtores ativos' },
              { n: 98, suffix: '%', label: 'Transações seguras' },
            ].map((s, i) => (
              <div key={i}>
                <div className="font-serif font-bold text-soil leading-none"
                  style={{ fontSize: 'clamp(24px,2.5vw,30px)' }}>
                  {s.fmt || <AnimatedStat target={s.n} suffix={s.suffix || ''} />}
                </div>
                <div className="text-xs text-text3 mt-1.5 font-medium">{t(s.label)}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* RIGHT — SVG illustration */}
        <div className="relative overflow-hidden min-h-[320px]">
          <motion.div
            className="w-full h-full"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: .8, ease: [.22,1,.36,1] }}>
            <svg viewBox="0 0 600 700" xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full object-cover block">
              <defs>
                <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#daebc0"/>
                  <stop offset="100%" stopColor="#c8dba0"/>
                </linearGradient>
                <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6a9e40"/>
                  <stop offset="100%" stopColor="#3a5c1a"/>
                </linearGradient>
              </defs>
              <rect width="600" height="700" fill="url(#sky)"/>
              <circle cx="480" cy="90" r="65" fill="#f5d060" opacity="0.55"/>
              <ellipse cx="300" cy="520" rx="420" ry="220" fill="url(#ground)"/>
              <ellipse cx="0" cy="570" rx="240" ry="150" fill="#5a8e30"/>
              <ellipse cx="600" cy="550" rx="260" ry="170" fill="#4a7e20"/>
              <rect x="0" y="490" width="600" height="220" fill="#3a5c1a"/>
              {[510,540,570].map((y, i) => (
                <path key={i} d={`M0 ${y} Q150 ${y-20} 300 ${y} Q450 ${y+20} 600 ${y}`}
                  stroke="#4a7e28" strokeWidth="2.5" fill="none" opacity="0.4"/>
              ))}
              {/* Barn */}
              <rect x="95" y="385" width="130" height="105" fill="#c04828" rx="2"/>
              <polygon points="95,385 160,318 225,385" fill="#a03820"/>
              <rect x="138" y="435" width="44" height="55" fill="#6a2810"/>
              <rect x="108" y="398" width="32" height="28" fill="#8b3820" opacity="0.7" rx="2"/>
              <rect x="182" y="398" width="32" height="28" fill="#8b3820" opacity="0.7" rx="2"/>
              {/* Silo */}
              <rect x="385" y="305" width="58" height="185" fill="#d4c490" rx="3"/>
              <ellipse cx="414" cy="305" rx="29" ry="13" fill="#c8b878"/>
              <rect x="396" y="468" width="36" height="22" fill="#a09060"/>
              {/* Tractor */}
              <rect x="252" y="443" width="84" height="42" fill="#c8802a" rx="5"/>
              <rect x="272" y="428" width="48" height="26" fill="#d49040" rx="4"/>
              <circle cx="270" cy="485" r="20" fill="#2c2010"/>
              <circle cx="270" cy="485" r="11" fill="#4a3818"/>
              <circle cx="320" cy="485" r="16" fill="#2c2010"/>
              <circle cx="320" cy="485" r="8.5" fill="#4a3818"/>
              {/* Wheat stalks */}
              {[48,68,88].map((x, i) => (
                <g key={i}>
                  <line x1={x} y1="505" x2={x-2} y2="432" stroke="#c8a828" strokeWidth="2"/>
                  <ellipse cx={x-2} cy="427" rx="5" ry="13" fill="#d4b840"/>
                </g>
              ))}
              {/* Tree */}
              <rect x="462" y="405" width="10" height="82" fill="#6a4010"/>
              <circle cx="467" cy="393" r="30" fill="#3a6e18"/>
              <circle cx="452" cy="408" r="18" fill="#4a7e20" opacity=".7"/>
              {/* Clouds */}
              <ellipse cx="120" cy="95" rx="72" ry="28" fill="white" opacity="0.75"/>
              <ellipse cx="162" cy="80" rx="52" ry="30" fill="white" opacity="0.75"/>
              <ellipse cx="82" cy="102" rx="46" ry="22" fill="white" opacity="0.65"/>
              <ellipse cx="305" cy="58" rx="58" ry="25" fill="white" opacity="0.5"/>
              <ellipse cx="360" cy="48" rx="40" ry="22" fill="white" opacity="0.45"/>
            </svg>
          </motion.div>

          {/* Escrow badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: .5, delay: .7 }}
            className="absolute bottom-6 left-5 right-5 glass border border-[var(--border-c)] rounded-lg2 p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-moss-light flex items-center justify-center text-xl shrink-0">🔒</div>
            <div>
              <div className="text-sm font-semibold text-soil">{t('Pagamento com Escrow')}</div>
              <div className="text-xs text-text3 mt-0.5">{t('Seu dinheiro só é liberado após confirmação da entrega')}</div>
            </div>
            <div className="ml-auto shrink-0 flex flex-col items-end gap-1">
              <span className="badge-agro badge-green">{t('Seguro')}</span>
              <span className="text-[10px] text-text4">Stripe + Escrow</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════ CATEGORY STRIP ══════════════════ */}
      <div className="bg-soil overflow-x-auto scrollbar-hide"
        style={{ padding: 'clamp(10px,1.5vw,14px) var(--page-pad)' }}>
        <div className="flex items-center gap-1 min-w-max">
          {CATS.map(c => (
            <button key={c.slug} className="cat-pill"
              onClick={() => router.push('/marketplace' + (c.slug ? '?cat=' + c.slug : ''))}>
              <span className="text-base">{c.emoji}</span>
              {t(c.label)}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════ FEATURED ══════════════════ */}
      <section style={{ padding: 'var(--space-lg) var(--page-pad)' }}>
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="flex items-end justify-between mb-9 flex-wrap gap-3">
              <div>
                <div className="text-xs font-semibold tracking-[.12em] uppercase text-moss mb-2">{t('Destaques')}</div>
                <div className="font-serif font-bold text-soil" style={{ fontSize: 'clamp(22px,3vw,34px)', letterSpacing: '-.5px' }}>
                  {t('Produtos em destaque')}
                </div>
              </div>
              <button className="btn btn-ghost" onClick={() => router.push('/marketplace')}>
                {t('Ver todos')} →
              </button>
            </div>
          </ScrollReveal>

          <ScrollRevealGrid className="listing-grid" stagger={0.06}>
            {listings === null
              ? Array(6).fill(0).map((_, i) => (
                  <ScrollRevealItem key={i}><ListingCardSkeleton /></ScrollRevealItem>
                ))
              : listings.map(l => (
                  <ScrollRevealItem key={l.id}>
                    <ListingCard listing={l} onClick={setSelected} />
                  </ScrollRevealItem>
                ))
            }
          </ScrollRevealGrid>
        </div>
      </section>

      {/* ══════════════════ HOW IT WORKS ══════════════════ */}
      <section className="bg-cream2" style={{ padding: 'var(--space-lg) var(--page-pad)' }}>
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-xs font-semibold tracking-[.12em] uppercase text-moss mb-2">{t('Como funciona')}</div>
            <div className="font-serif font-bold text-soil mb-12" style={{ fontSize: 'clamp(22px,3vw,34px)', letterSpacing: '-.5px' }}>
              {t('Simples, seguro e transparente')}
            </div>
          </ScrollReveal>

          <ScrollRevealGrid
            className="grid gap-5"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px,100%), 1fr))' }}
            stagger={0.1}>
            {STEPS.map((s, i) => (
              <ScrollRevealItem key={i}>
                <motion.div
                  className="bg-agro-white border border-[var(--border-c)] rounded-xl2 relative"
                  style={{ padding: 'clamp(18px,2.5vw,28px)' }}
                  whileHover={{ y: -5, boxShadow: '0 16px 48px rgba(44,31,14,.14)' }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22 }}>
                  <div className="font-serif font-black text-moss-light leading-none mb-4"
                    style={{ fontSize: 'clamp(36px,4.5vw,52px)' }}>{s.n}</div>
                  <div style={{ fontSize: 'clamp(22px,2.5vw,28px)', marginBottom: 12 }}>{s.icon}</div>
                  <div className="text-base font-semibold text-soil mb-2">{t(s.title)}</div>
                  <div className="text-sm text-text3 leading-relaxed">{t(s.desc)}</div>
                  {i < 3 && (
                    <div className="hidden lg:flex absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-cream2 border border-[var(--border-c)] rounded-full items-center justify-center text-xs text-text3 z-10">
                      →
                    </div>
                  )}
                </motion.div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGrid>
        </div>
      </section>

      {/* ══════════════════ TRUST BAR ══════════════════ */}
      <ScrollReveal>
        <div className="bg-moss" style={{ padding: 'clamp(24px,4vw,40px) var(--page-pad)' }}>
          <div className="max-w-6xl mx-auto grid gap-8"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px,100%), 1fr))' }}>
            {[
              { val: 'R$\u00a02,4M', label: 'Transacionados este mês' },
              { n: 1240, suffix: '+', label: 'Produtores cadastrados' },
              { val: '18 estados', label: 'Cobertura nacional' },
              { n: 98, suffix: '%', label: 'Resolução de disputas' },
            ].map((item, i) => (
              <div key={i} className="text-center md:text-left">
                <div className="font-serif font-bold text-white leading-none"
                  style={{ fontSize: 'clamp(22px,2.5vw,32px)' }}>
                  {item.val ? t(item.val) : <AnimatedStat target={item.n} suffix={item.suffix || ''} />}
                </div>
                <div className="text-xs mt-1.5 font-medium" style={{ color: 'rgba(255,255,255,.65)' }}>{t(item.label)}</div>
              </div>
            ))}
          </div>
        </div>
      </ScrollReveal>

      {/* ══════════════════ CTA ══════════════════ */}
      <ScrollReveal>
        <section className="bg-soil relative overflow-hidden"
          style={{ padding: 'var(--space-xl) var(--page-pad)' }}>
          {/* BG orbs */}
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-5 pointer-events-none"
            style={{ background: 'radial-gradient(circle, var(--moss3), transparent 70%)', transform: 'translate(30%, -30%)' }} />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-[.04] pointer-events-none"
            style={{ background: 'radial-gradient(circle, var(--wheat), transparent 70%)', transform: 'translate(-30%, 30%)' }} />

          <div className="max-w-6xl mx-auto grid gap-10 items-center relative z-10"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px,100%), 1fr))' }}>
            <div>
              <div className="text-xs font-semibold tracking-[.12em] uppercase mb-3"
                style={{ color: 'rgba(255,255,255,.45)' }}>{t('Comece agora')}</div>
              <div className="font-serif font-bold text-cream leading-tight mb-3"
                style={{ fontSize: 'clamp(26px,3.5vw,42px)', letterSpacing: '-.5px' }}>
                {t('Pronto para vender sua produção?')}
              </div>
              <div className="text-cream2 opacity-70" style={{ fontSize: 'clamp(13px,1vw,15px)' }}>
                {t('Crie sua conta grátis e publique seu primeiro anúncio em minutos.')}
              </div>
            </div>
            <div className="flex gap-3 flex-wrap md:justify-end">
              <motion.button className="btn btn-primary btn-lg"
                onClick={() => router.push('/marketplace')}
                whileHover={{ scale: 1.03 }} whileTap={{ scale: .97 }}>
                {t('Criar conta grátis')}
              </motion.button>
              <motion.button className="btn btn-lg"
                style={{ border: '1.5px solid rgba(255,255,255,.25)', color: '#fff', background: 'transparent' }}
                onClick={() => router.push('/marketplace')}
                whileHover={{ background: 'rgba(255,255,255,.08)' }} whileTap={{ scale: .97 }}>
                {t('Ver marketplace')}
              </motion.button>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {selected && <ListingDetail listing={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
