'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { getUser, clearAuth, isAdmin } from '@/lib/auth';
import { useNotifications } from '@/lib/notifications';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useI18n } from '@/lib/i18n';

const NAV_LINKS = [
  { href: '/',            label: 'Início',      icon: '🌾' },
  { href: '/marketplace', label: 'Marketplace', icon: '🛒' },
  { href: '/chat',        label: 'Chat',         icon: '💬' },
  { href: '/perfil',      label: 'Perfil',       icon: '👤', auth: true },
];

const ADMIN_LINK = { href: '/admin', label: 'Admin', icon: '⚙️', auth: true };

function NotifBadge({ count }) {
  if (!count) return null;
  return (
    <span className="absolute -top-1 -right-1 bg-rust text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none z-10">
      {count > 9 ? '9+' : count}
    </span>
  );
}

/* ── DESKTOP NAV ── */
export function DesktopNav({ onOpenAuth }) {
  const [user, setUser] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { unread, markRead } = useNotifications();
  const { t } = useI18n();

  useEffect(() => {
    const sync = () => setUser(getUser());
    sync();
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    window.addEventListener('auth-change', sync);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('auth-change', sync);
    };
  }, [pathname]);

  function logout() { clearAuth(); setUser(null); router.push('/'); }

  const links = [...NAV_LINKS, ...(user && isAdmin(user) ? [ADMIN_LINK] : [])].filter(l => !l.auth || user);

  return (
    <nav className={`hidden md:flex sticky top-0 z-50 items-center justify-between gap-6 transition-all duration-300 ${scrolled ? 'glass shadow-agro border-b border-[var(--border-c)]' : 'bg-cream/80 backdrop-blur-sm'}`}
      style={{ padding: '0 var(--page-pad)', height: 'clamp(52px,6vh,64px)' }}>

      <Link href="/" className="font-serif text-xl font-black text-moss no-underline tracking-tight shrink-0 select-none">
        Agrinet
      </Link>

      <div className="flex items-center gap-1">
        {links.map(l => (
          <Link key={l.href} href={l.href}
            className={`nav-link ${pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href)) ? 'active' : ''}`}>
            {t(l.label)}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <LanguageSwitcher />
        {!user ? (
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => onOpenAuth?.('login')}>{t('Entrar')}</button>
            <button className="btn btn-primary btn-sm" onClick={() => onOpenAuth?.('register')}>{t('Cadastrar')}</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button className="relative p-2 rounded-full hover:bg-cream2 transition-colors" onClick={() => { markRead(); router.push('/perfil'); }}>
              <span className="text-lg">🔔</span>
              <NotifBadge count={unread} />
            </button>
            <button
              onClick={() => router.push('/perfil')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-sm hover:bg-cream2 transition-colors cursor-pointer">
              <Avatar className="w-7 h-7">
                <AvatarFallback className="bg-moss-light text-moss text-xs font-bold">
                  {(user.email || 'U').substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-text2">{(user.email || '').split('@')[0]}</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

/* ── MOBILE TOP BAR ── */
export function MobileTopBar({ onOpenAuth }) {
  const [user, setUser] = useState(null);
  const pathname = usePathname();
  const router = useRouter();
  const { unread } = useNotifications();
  const { t } = useI18n();

  useEffect(() => {
    const sync = () => setUser(getUser());
    sync();
    window.addEventListener('auth-change', sync);
    return () => window.removeEventListener('auth-change', sync);
  }, [pathname]);

  const links = [...NAV_LINKS, ...(user && isAdmin(user) ? [ADMIN_LINK] : [])].filter(l => !l.auth || user);

  return (
    <header className="md:hidden sticky top-0 z-50 glass border-b border-[var(--border-c)] flex items-center justify-between px-4 h-14">
      <Link href="/" className="font-serif text-lg font-black text-moss no-underline">Agrinet</Link>

      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        {user && (
          <button className="relative p-2" onClick={() => router.push('/perfil')}>
            <span className="text-xl">🔔</span>
            <NotifBadge count={unread} />
          </button>
        )}

        <Sheet>
          <SheetTrigger asChild>
            <button className="p-2 rounded-sm hover:bg-cream2 transition-colors">
              <div className="flex flex-col gap-1.5 w-5">
                <span className="block h-0.5 bg-soil rounded-full" />
                <span className="block h-0.5 bg-soil rounded-full w-3.5" />
                <span className="block h-0.5 bg-soil rounded-full" />
              </div>
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 bg-cream border-l border-[var(--border-c)] p-0">
            <div className="p-6 border-b border-[var(--border-c)]">
              <div className="font-serif text-xl font-black text-moss mb-1">Agrinet</div>
              {user ? (
                <div className="flex items-center gap-2 mt-3">
                  <Avatar className="w-9 h-9">
                    <AvatarFallback className="bg-moss-light text-moss text-sm font-bold">
                      {(user.email || 'U').substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-semibold text-soil">{(user.email || '').split('@')[0]}</div>
                    <div className="text-xs text-text3">{user.trust_level || 'new'}</div>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 mt-3">
                  <button className="btn btn-ghost btn-sm flex-1" onClick={() => onOpenAuth?.('login')}>{t('Entrar')}</button>
                  <button className="btn btn-primary btn-sm flex-1" onClick={() => onOpenAuth?.('register')}>{t('Cadastrar')}</button>
                </div>
              )}
            </div>
            <nav className="p-3 flex flex-col gap-1">
              {links.map(l => (
                <Link key={l.href} href={l.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-sm text-sm font-medium no-underline transition-colors ${pathname === l.href ? 'bg-moss-light text-moss' : 'text-text2 hover:bg-cream2'}`}>
                  <span className="text-lg">{l.icon}</span>{t(l.label)}
                </Link>
              ))}
            </nav>
            {user && (
              <div className="p-3 border-t border-[var(--border-c)] mx-3 mt-auto">
                <button className="btn btn-ghost btn-sm w-full" onClick={() => { clearAuth(); setUser(null); router.push('/'); }}>
                  {t('Sair da conta')}
                </button>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

/* ── BOTTOM TAB BAR (mobile) ── */
export function BottomTabBar() {
  const [user, setUser] = useState(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const sync = () => setUser(getUser());
    sync();
    window.addEventListener('auth-change', sync);
    return () => window.removeEventListener('auth-change', sync);
  }, [pathname]);

  const { t } = useI18n();

  const tabs = [
    { href: '/',            label: 'Início',  icon: '🌾' },
    { href: '/marketplace', label: 'Mercado', icon: '🛒' },
    { href: '/chat',        label: 'Chat',    icon: '💬' },
    { href: '/perfil',      label: 'Perfil',  icon: '👤' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t border-[var(--border-c)] flex items-center justify-around safe-area-pb">
      {tabs.map(tab => {
        const active = pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href));
        return (
          <button key={tab.href} onClick={() => router.push(tab.href)}
            className={`bottom-tab ${active ? 'active' : ''}`}>
            <motion.span
              className="text-2xl"
              animate={active ? { scale: 1.15 } : { scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
              {tab.icon}
            </motion.span>
            <span className={`text-[10px] font-medium ${active ? 'text-moss' : 'text-text3'}`}>{t(tab.label)}</span>
            {active && (
              <motion.div layoutId="tab-indicator"
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-moss rounded-full"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
