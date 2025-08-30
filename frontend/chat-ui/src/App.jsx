import React, { useEffect } from 'react';
import { StoreProvider, useStore } from './store';
import ChatWindow from './components/ChatWindow.jsx';
import InputBox from './components/InputBox.jsx';
import Sidebar from './components/Sidebar.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import TopBar from './components/TopBar.jsx';

function AppInner() {
  const { state, dispatch } = useStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  useEffect(() => {
    const events = new EventSource('/events');
    const handleMessage = (e) => {
      const data = JSON.parse(e.data);
      dispatch({ type: 'ADD_MESSAGE', message: data });
    };
    events.addEventListener('message', handleMessage);
    return () => {
      events.removeEventListener('message', handleMessage);
      events.close();
    };
  }, [dispatch]);

  return (
    <div className="flex h-full">
      {state.sidebarOpen && <Sidebar />}
      <div className="flex flex-col flex-1">
        <TopBar />
        <ChatWindow />
        <InputBox />
      </div>
      <SettingsModal />
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
