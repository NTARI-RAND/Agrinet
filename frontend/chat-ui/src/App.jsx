import React, { useEffect, useRef, useState } from 'react';
import { Amplify } from 'aws-amplify';
import awsExports from '../../aws-exports';
// Configure Amplify with backend settings
Amplify.configure(awsExports);

import { StoreProvider, useStore } from './store';
import ChatWindow from './components/ChatWindow.jsx';
import InputBox from './components/InputBox.jsx';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import TestApi from './components/TestApi.jsx';

function AppInner() {
  const { state } = useStore();
  const diagnosticsRef = useRef(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  useEffect(() => {
    if (showDiagnostics) return undefined;
    const node = diagnosticsRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setShowDiagnostics(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShowDiagnostics(true);
            observer.disconnect();
          }
        });
      },
      { root: null, threshold: 0.35 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [showDiagnostics]);

  return (
    <div className="app-shell">
      {state.sidebarOpen && <Sidebar />}
      <div className="farm-pane flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <div className="p-6" ref={diagnosticsRef}>
          {showDiagnostics ? (
            <TestApi />
          ) : (
            <div className="skeleton-field" style={{ height: '120px' }} aria-hidden="true" />
          )}
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
