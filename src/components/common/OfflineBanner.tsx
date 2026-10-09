import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useOfflineSync } from '../../context/OfflineSyncContext';

export const OfflineBanner: React.FC = () => {
  const { isOnline, pendingCount, syncInProgress, forceSync } = useOfflineSync();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="sticky top-14 z-20 px-4 py-2 bg-amber-500/90 text-white backdrop-blur-md text-xs font-semibold flex items-center justify-between shadow-sm animate-fade-in">
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4 flex-shrink-0" />
        <span>
          {!isOnline
            ? 'Modo sin conexión en el súper. Los cambios se guardan localmente.'
            : `${pendingCount} cambio(s) guardados localmente.`}
        </span>
      </div>

      {isOnline && pendingCount > 0 && (
        <button
          onClick={() => forceSync()}
          disabled={syncInProgress}
          className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg text-[11px] transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${syncInProgress ? 'animate-spin' : ''}`} />
          <span>Sincronizar</span>
        </button>
      )}
    </div>
  );
};
