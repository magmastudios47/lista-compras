import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './context/AuthContext';
import { HouseholdProvider } from './context/HouseholdContext';
import { OfflineSyncProvider } from './context/OfflineSyncContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <HouseholdProvider>
        <OfflineSyncProvider>
          <App />
        </OfflineSyncProvider>
      </HouseholdProvider>
    </AuthProvider>
  </React.StrictMode>
);
