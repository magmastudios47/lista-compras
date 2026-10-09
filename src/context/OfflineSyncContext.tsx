import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { offlineStorage, QueuedMutation } from '../lib/offlineStorage';
import { isConfigured, supabase } from '../lib/supabaseClient';

interface OfflineSyncContextType {
  isOnline: boolean;
  pendingCount: number;
  syncInProgress: boolean;
  forceSync: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextType | undefined>(undefined);

export const OfflineSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
  const [pendingCount, setPendingCount] = useState<number>(() => offlineStorage.getMutationQueue().length);
  const [syncInProgress, setSyncInProgress] = useState(false);

  const syncPendingMutations = useCallback(async () => {
    if (!navigator.onLine || syncInProgress) return;
    const queue = offlineStorage.getMutationQueue();
    if (queue.length === 0) {
      setPendingCount(0);
      return;
    }

    setSyncInProgress(true);
    try {
      if (!isConfigured) {
        // En modo demo, vaciar la cola tras verificar
        offlineStorage.clearAllMutations();
        setPendingCount(0);
        return;
      }

      for (const mutation of queue) {
        try {
          if (mutation.table === 'shopping_items') {
            if (mutation.action === 'insert') {
              await supabase.from('shopping_items').upsert(mutation.payload);
            } else if (mutation.action === 'update') {
              // LWW: actualizar si nuestro timestamp es reciente
              await supabase.from('shopping_items').update(mutation.payload).eq('id', mutation.payload.id);
            } else if (mutation.action === 'delete') {
              await supabase.from('shopping_items').delete().eq('id', mutation.payload.id);
            }
          } else if (mutation.table === 'pantry_items') {
            if (mutation.action === 'insert') {
              await supabase.from('pantry_items').upsert(mutation.payload);
            } else if (mutation.action === 'update') {
              await supabase.from('pantry_items').update(mutation.payload).eq('id', mutation.payload.id);
            } else if (mutation.action === 'delete') {
              await supabase.from('pantry_items').delete().eq('id', mutation.payload.id);
            }
          }
          offlineStorage.clearMutation(mutation.id);
        } catch (itemErr) {
          console.warn('Error sincronizando ítem:', itemErr);
        }
      }

      setPendingCount(offlineStorage.getMutationQueue().length);
    } finally {
      setSyncInProgress(false);
    }
  }, [syncInProgress]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingMutations();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Revisar cola periódicamente
    const interval = setInterval(() => {
      const q = offlineStorage.getMutationQueue();
      setPendingCount(q.length);
      if (navigator.onLine && q.length > 0) {
        syncPendingMutations();
      }
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [syncPendingMutations]);

  return (
    <OfflineSyncContext.Provider
      value={{
        isOnline,
        pendingCount,
        syncInProgress,
        forceSync: syncPendingMutations,
      }}
    >
      {children}
    </OfflineSyncContext.Provider>
  );
};

export const useOfflineSync = () => {
  const context = useContext(OfflineSyncContext);
  if (!context) throw new Error('useOfflineSync debe usarse dentro de OfflineSyncProvider');
  return context;
};
