'use client';
import { useI18n } from '@/lib/i18n';

const LANGS = [
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'pt', flag: '🇧🇷', label: 'Português' },
];

/**
 * Flag toggle to switch UI language. Compact pill with two flags; the active
 * language is highlighted. Used in the desktop nav and mobile top bar.
 */
export default function LanguageSwitcher({ className = '' }) {
  const { lang, setLang } = useI18n();

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-full border border-[var(--border-c)] bg-cream2/60 p-0.5 ${className}`}
      role="group"
      aria-label="Language">
      {LANGS.map(({ code, flag, label }) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            aria-label={label}
            aria-pressed={active}
            title={label}
            className={`flex items-center justify-center w-7 h-7 rounded-full text-base leading-none transition-all ${
              active ? 'bg-white shadow-sm scale-105' : 'opacity-55 hover:opacity-100'
            }`}>
            <span aria-hidden="true">{flag}</span>
          </button>
        );
      })}
    </div>
  );
}
