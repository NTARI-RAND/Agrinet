import React, { useEffect } from 'react';
import { StoreProvider, useStore } from './store';
import ChatWindow from './components/ChatWindow.jsx';
import InputBox from './components/InputBox.jsx';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import TestApi from './components/TestApi.jsx';

function AppInner() {
  const { state } = useStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  return (
    <div className="flex h-full">
      {state.sidebarOpen && <Sidebar />}
      <div className="flex flex-col flex-1">
        <TopBar />
        <div className="p-4">
          <TestApi />
        </div>
        <ChatWindow />
        <InputBox />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppInner />
    </StoreProvider>
  );
}
