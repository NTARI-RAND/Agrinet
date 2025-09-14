import React, { useState } from 'react';
import { useStore } from '../store';

export default function ProfileMenu() {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);

  const toggleTheme = () => dispatch({ type: 'SET_THEME', theme: state.theme === 'light' ? 'dark' : 'light' });
  const toggleMemory = () => dispatch({ type: 'TOGGLE_MEMORY' });

  return (
    <div
      className="fixed bottom-2 right-4 z-10"
      className="fixed bottom-2 transition-all"
      style={{ left: state.sidebarOpen ? '15.5rem' : '0.5rem' }}
    >
      <button className="p-2 rounded-full" onClick={() => setOpen((o) => !o)} title="Profile">
        ⚙️
      </button>
      {open && (
        <div className="mt-2 p-2 border rounded bg-white dark:bg-gray-800 shadow space-y-2">
          <button className="block w-full text-left" onClick={toggleTheme}>Toggle Theme</button>
          <button className="block w-full text-left" onClick={toggleMemory}>
            Memory: {state.memory ? 'On' : 'Off'}
          </button>
          <button className="block w-full text-left">Custom instructions</button>
          <button className="block w-full text-left">Account</button>
        </div>
      )}
    </div>
  );
}
