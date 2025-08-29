import React, { useState } from 'react';
import { useStore } from '../store.js';

export default function SettingsModal() {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);

  const toggleTheme = () => dispatch({ type: 'SET_THEME', theme: state.theme === 'light' ? 'dark' : 'light' });

  return (
    <div>
      <button className="p-2" onClick={() => setOpen(true)}>
        ⚙️
      </button>
      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-gray-800 p-4 rounded" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg mb-2">Settings</h2>
            <button className="p-2 border rounded" onClick={toggleTheme}>
              Toggle Theme
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
