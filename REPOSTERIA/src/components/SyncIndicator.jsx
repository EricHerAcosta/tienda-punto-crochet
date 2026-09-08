import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { syncManager } from '../utils/syncManager';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/dbLocal';

export default function SyncIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  // Consultar ítems pendientes en IndexedDB
  const pendingCount = useLiveQuery(
    () => db.sync_queue.where('status').equals('pending').count(),
    [],
    0
  );

  useEffect(() => {
    const unsubscribe = syncManager.subscribe((state) => {
      setIsOnline(state.isOnline);
      setIsSyncing(state.isSyncing);
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleManualSync = () => {
    if (isOnline && !isSyncing) {
      syncManager.processQueue();
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-white/40 backdrop-blur-md border border-white/60 shadow-sm">
      {isOnline ? (
        <span className="flex items-center gap-1.5 text-emerald-700">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <Wifi className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Online</span>
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-amber-800">
          <WifiOff className="w-3.5 h-3.5 text-amber-600" />
          <span>Offline</span>
        </span>
      )}

      <div className="h-3 w-px bg-stone-300 mx-0.5"></div>

      {pendingCount > 0 ? (
        <button
          onClick={handleManualSync}
          disabled={!isOnline || isSyncing}
          className="flex items-center gap-1 text-amber-700 hover:text-amber-900 transition-colors disabled:opacity-50"
          title="Clic para sincronizar cambios pendientes"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-600' : ''}`} />
          <span>{pendingCount} pend.</span>
        </button>
      ) : (
        <span className="flex items-center gap-1 text-stone-600">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span className="hidden sm:inline">Al día</span>
        </span>
      )}
    </div>
  );
}
