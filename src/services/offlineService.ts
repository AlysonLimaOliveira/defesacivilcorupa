import { db, collection, addDoc, serverTimestamp } from '../firebase';
import { notifyAdmins } from './notificationService';

const OFFLINE_QUEUE_KEY = 'offline_incidents_queue';
const SYNC_STATUS_KEY = 'offline_sync_status';

export interface OfflineIncident {
  id: string;
  data: any;
  timestamp: number;
  status: 'pending' | 'syncing' | 'synced' | 'error';
  retryCount: number;
  lastError?: string;
  serverDocId?: string;
}

type SyncCallback = (status: {
  type: 'start' | 'progress' | 'complete' | 'error';
  total: number;
  synced: number;
  failed: number;
  currentId?: string;
  error?: string;
}) => void;

let syncInProgress = false;
let syncCallbacks: Set<SyncCallback> = new Set();

export const onSyncStatusChange = (callback: SyncCallback) => {
  syncCallbacks.add(callback);
  return () => syncCallbacks.delete(callback);
};

const notifySyncStatus = (status: Parameters<SyncCallback>[0]) => {
  syncCallbacks.forEach(cb => cb(status));
};

export const saveIncidentOffline = (data: any) => {
  const queue = getOfflineQueue();
  const newIncident: OfflineIncident = {
    id: crypto.randomUUID(),
    data,
    timestamp: Date.now(),
    status: 'pending',
    retryCount: 0,
  };
  queue.push(newIncident);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  console.log('[Offline] Incidente salvo offline:', newIncident.id);
  return newIncident;
};

export const getOfflineQueue = (): OfflineIncident[] => {
  try {
    const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    console.error('[Offline] Erro ao recuperar fila');
    return [];
  }
};

export const getIncidentOfflineStatus = (id: string): OfflineIncident | undefined => {
  return getOfflineQueue().find(incident => incident.id === id);
};

export const clearOfflineQueue = () => {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
  localStorage.removeItem(SYNC_STATUS_KEY);
};

export const getOfflinePendingCount = (): number => {
  return getOfflineQueue().filter(i => i.status !== 'synced').length;
};

const updateOfflineQueueStatus = (id: string, updates: Partial<OfflineIncident>) => {
  const queue = getOfflineQueue();
  const index = queue.findIndex(i => i.id === id);
  if (index !== -1) {
    queue[index] = { ...queue[index], ...updates };
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  }
};

export const removeOfflineIncident = (id: string) => {
  const queue = getOfflineQueue().filter(i => i.id !== id);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
};

export const syncOfflineIncidents = async (forceSync = false) => {
  if (syncInProgress && !forceSync) {
    console.log('[Offline] Sincronização já em progresso');
    return;
  }

  const queue = getOfflineQueue();
  const pendingIncidents = queue.filter(i => i.status === 'pending' || i.status === 'error');
  
  if (pendingIncidents.length === 0) {
    console.log('[Offline] Nenhum incidente para sincronizar');
    return;
  }

  syncInProgress = true;
  let synced = 0;
  let failed = 0;

  console.log(`[Offline] Iniciando sincronização de ${pendingIncidents.length} incidente(s)`);
  
  notifySyncStatus({
    type: 'start',
    total: pendingIncidents.length,
    synced: 0,
    failed: 0,
  });

  for (const incident of pendingIncidents) {
    try {
      updateOfflineQueueStatus(incident.id, { status: 'syncing', retryCount: incident.retryCount + 1 });
      
      notifySyncStatus({
        type: 'progress',
        total: pendingIncidents.length,
        synced,
        failed,
        currentId: incident.id,
      });

      const docRef = await addDoc(collection(db, 'incidents'), {
        ...incident.data,
        createdAt: serverTimestamp(),
        isOfflineSync: true,
        originalOfflineTimestamp: incident.timestamp,
      });

      try {
        await notifyAdmins(
          'Ocorrência Sincronizada (Offline)',
          `${incident.data.category}: ${incident.data.type} em ${incident.data.city}`,
          docRef.id
        );
      } catch (notifyError) {
        console.warn('[Offline] Erro ao notificar admins:', notifyError);
      }

      updateOfflineQueueStatus(incident.id, { 
        status: 'synced',
        serverDocId: docRef.id,
      });
      
      synced++;
      console.log(`[Offline] ✓ Ocorrência ${incident.id} sincronizada com sucesso (${synced}/${pendingIncidents.length})`);
    } catch (error) {
      failed++;
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error(`[Offline] ✗ Erro ao sincronizar ${incident.id}:`, error);
      
      updateOfflineQueueStatus(incident.id, { 
        status: 'error',
        lastError: errorMessage,
      });

      notifySyncStatus({
        type: 'error',
        total: pendingIncidents.length,
        synced,
        failed,
        currentId: incident.id,
        error: errorMessage,
      });
    }
  }

  syncInProgress = false;

  notifySyncStatus({
    type: 'complete',
    total: pendingIncidents.length,
    synced,
    failed,
  });

  console.log(`[Offline] Sincronização concluída: ${synced} sucesso, ${failed} erro(s)`);
};

// Initialize listeners
if (typeof window !== 'undefined') {
  // Sincronizar quando conectar à internet
  window.addEventListener('online', () => {
    console.log('[Offline] Conexão internet restaurada - iniciando sincronização');
    setTimeout(() => syncOfflineIncidents(true), 1000);
  });

  // Sincronizar periodicamente quando online
  setInterval(() => {
    if (navigator.onLine && !syncInProgress) {
      const queue = getOfflineQueue();
      if (queue.some(i => i.status === 'pending' || i.status === 'error')) {
        syncOfflineIncidents();
      }
    }
  }, 30000); // A cada 30 segundos

  // Sincronizar na carga se online
  if (navigator.onLine) {
    setTimeout(() => syncOfflineIncidents(), 1000);
  }
}

export default { saveIncidentOffline, getOfflineQueue, syncOfflineIncidents, getOfflinePendingCount };
