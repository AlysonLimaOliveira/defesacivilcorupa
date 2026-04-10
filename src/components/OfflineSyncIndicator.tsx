import React, { useState, useEffect } from 'react';
import { getOfflinePendingCount, onSyncStatusChange } from '../services/offlineService';
import { WifiOff, Cloud, CloudDone, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SyncStatus {
  type: 'start' | 'progress' | 'complete' | 'error';
  total: number;
  synced: number;
  failed: number;
  currentId?: string;
  error?: string;
}

export const OfflineSyncIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(getOfflinePendingCount());
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = onSyncStatusChange((status) => {
      setSyncStatus(status);
      if (status.type === 'complete' || status.type === 'start') {
        setPendingCount(status.total - status.synced);
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  if (isOnline && pendingCount === 0) {
    return null;
  }

  if (!isOnline) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-4 right-4 z-40 bg-orange-50 border border-orange-200 rounded-xl p-4 shadow-lg"
      >
        <div className="flex items-center gap-3">
          <WifiOff className="w-5 h-5 text-orange-600 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-orange-900">Modo Offline</h4>
            <p className="text-xs text-orange-700">As ocorrências serão sincronizadas quando conectado</p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (pendingCount > 0) {
    const isSyncing = syncStatus?.type === 'progress';
    const synced = syncStatus?.synced || 0;
    const failed = syncStatus?.failed || 0;

    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
      >
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="fixed top-4 right-4 z-40 bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-lg hover:bg-blue-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            {isSyncing ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity }}>
                <Cloud className="w-5 h-5 text-blue-600" />
              </motion.div>
            ) : failed > 0 ? (
              <AlertCircle className="w-5 h-5 text-red-600" />
            ) : (
              <CloudDone className="w-5 h-5 text-green-600" />
            )}
            <div className="text-left">
              <h4 className="font-semibold text-blue-900">
                {isSyncing ? 'Sincronizando' : 'Sincronização'} ({isSyncing ? synced : pendingCount})
              </h4>
              <p className="text-xs text-blue-700">
                {isSyncing 
                  ? `${synced}/${pendingCount - failed} ocorrências enviadas`
                  : `${pendingCount} ocorrência(s) aguardando envio`
                }
              </p>
            </div>
          </div>
        </button>

        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-24 right-4 z-40 bg-white border border-gray-200 rounded-xl p-4 shadow-2xl min-w-[300px] max-w-[400px]"
            >
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase">Status</p>
                  <p className="text-sm text-gray-900">
                    {isSyncing ? '⏳ Sincronizando...' : '✓ Online'}
                  </p>
                </div>

                {isSyncing && (
                  <>
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase mb-2">Progresso</p>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <motion.div
                          className="bg-blue-600 h-2 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${(synced / (pendingCount - failed)) * 100}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {synced} de {pendingCount - failed} enviadas
                      </p>
                    </div>
                  </>
                )}

                {failed > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                    <p className="text-xs font-semibold text-red-700">
                      ⚠️ {failed} erro(s) na sincronização
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      Será retentada automaticamente
                    </p>
                  </div>
                )}

                <div className="text-xs text-gray-500 pt-2 border-t">
                  As ocorrências serão automaticamente sincronizadas com o servidor assim que possível.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  return null;
};

export default OfflineSyncIndicator;
