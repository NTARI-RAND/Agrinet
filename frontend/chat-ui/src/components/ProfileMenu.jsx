import React, { useEffect, useId, useRef, useState } from 'react';
import { useStore } from '../store';

/**
 * Compact profile/settings menu that can be embedded in any toolbar.
 * Positioned relative to its container, so callers can control placement
 * with layout utilities (e.g. flex gap, margin).
 */
export default function ProfileMenu({ className = '' }) {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;

    const handleClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const toggleTheme = () =>
    dispatch({ type: 'SET_THEME', theme: state.theme === 'light' ? 'dark' : 'light' });
  const toggleMemory = () => dispatch({ type: 'TOGGLE_MEMORY' });

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-lg shadow-sm transition hover:shadow-lg hover:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Profile and settings"
        title="Profile and settings"
      >
        ⚙️
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-20 mt-2 w-60 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm shadow-lg"
        >
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-[var(--color-accent-soft)]"
            onClick={toggleTheme}
          >
            <span>Theme</span>
            <span className="text-xs text-[var(--color-muted)]">{state.theme === 'light' ? 'Light' : 'Dark'}</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-[var(--color-accent-soft)]"
            onClick={toggleMemory}
          >
            <span>Memory</span>
            <span className="text-xs text-[var(--color-muted)]">{state.memory ? 'On' : 'Off'}</span>
          </button>
          <hr className="farm-divider my-2" />
          <button
            type="button"
            className="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-[var(--color-accent-soft)]"
          >
            Custom instructions
          </button>
          <button
            type="button"
            className="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-[var(--color-accent-soft)]"
          >
            Account
          </button>
        </div>
      )}
    </div>
  );
}
