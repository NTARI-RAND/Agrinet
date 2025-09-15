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
        className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-lg shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
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
          className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-gray-200 bg-white p-2 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={toggleTheme}
          >
            <span>Theme</span>
            <span className="text-xs text-gray-500 dark:text-gray-300">{state.theme === 'light' ? 'Light' : 'Dark'}</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={toggleMemory}
          >
            <span>Memory</span>
            <span className="text-xs text-gray-500 dark:text-gray-300">{state.memory ? 'On' : 'Off'}</span>
          </button>
          <hr className="my-1 border-gray-200 dark:border-gray-700" />
          <button
            type="button"
            className="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Custom instructions
          </button>
          <button
            type="button"
            className="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Account
          </button>
        </div>
      )}
    </div>
  );
}
