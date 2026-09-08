import { db } from '../services/dbLocal';
import { sheetsService } from '../services/sheetsService';
import { googleAuthService } from '../services/googleAuth';

/**
 * SyncManager: Sincronización Bidireccional Completa
 * - App -> Google Workspace (Push en tiempo real u offline sync queue)
 * - Google Workspace -> App (Pull automático en foco de ventana, reconexión o polling periódico)
 */

let isSyncing = false;
let autoSyncTimer = null;
const listeners = new Set();

const PK_MAP = {
  insumos: 'id_insumo',
  compras: 'id_compra',
  recetas: 'id_receta',
  detalle_recetas: 'id_detalle',
  produccion: 'id_produccion'
};

const TAB_MAP = {
  insumos: 'Insumos',
  compras: 'Compras',
  recetas: 'Recetas',
  detalle_recetas: 'Detalle_Recetas',
  produccion: 'Produccion'
};

export const syncManager = {
  /**
   * Suscribe un listener a cambios en el estado de sincronización
   */
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Notifica a los componentes sobre cambios en el estado de red o cola
   */
  notify() {
    for (const listener of listeners) {
      listener({
        isOnline: navigator.onLine,
        isSyncing
      });
    }
  },

  /**
   * Agrega una operación a la cola local y actualiza la base de datos Dexie de inmediato
   */
  async enqueueMutation(action, table, payload) {
    // 1. Aplicar cambio en la BD IndexedDB local para UX instantánea
    if (action === 'CREATE' || action === 'UPDATE') {
      await db[table].put(payload);
    } else if (action === 'DELETE') {
      const primaryKey = PK_MAP[table];
      await db[table].delete(payload[primaryKey]);
    }

    // 2. Encolar en sync_queue
    await db.sync_queue.add({
      action,
      table,
      payload,
      timestamp: Date.now(),
      status: 'pending'
    });

    this.notify();

    // 3. Si hay conexión y autenticación, intentar sincronizar de inmediato
    if (navigator.onLine && googleAuthService.isLoggedIn()) {
      this.processQueue();
    }
  },

  /**
   * PUSH: Envía todas las mutaciones pendientes en `sync_queue` hacia Google Sheets
   */
  async processQueue() {
    if (isSyncing || !navigator.onLine || !googleAuthService.isLoggedIn()) return;

    isSyncing = true;
    this.notify();

    try {
      const pendingItems = await db.sync_queue.where('status').equals('pending').sortBy('timestamp');
      if (pendingItems.length === 0) {
        isSyncing = false;
        this.notify();
        return;
      }

      console.log(`[SyncManager] Enviando ${pendingItems.length} cambios a Google Sheets...`);
      const spreadsheetId = await sheetsService.getOrCreateSpreadsheet();

      for (const item of pendingItems) {
        try {
          const mapTab = TAB_MAP[item.table];
          const pkField = PK_MAP[item.table];

          if (item.action === 'CREATE' || item.action === 'UPDATE') {
            await sheetsService.upsertRowByPk(spreadsheetId, mapTab, pkField, item.payload);
          } else if (item.action === 'DELETE') {
            const pkValue = item.payload[pkField];
            await sheetsService.deleteRowByPk(spreadsheetId, mapTab, pkField, pkValue);
          }

          // Eliminar de la cola tras confirmación
          await db.sync_queue.delete(item.id);
        } catch (err) {
          console.error(`[SyncManager] Error al sincronizar ítem #${item.id}:`, err);
          await db.sync_queue.update(item.id, { status: 'error', errorMsg: err.message });
        }
      }
    } catch (globalErr) {
      console.error('[SyncManager] Error crítico durante la sincronización:', globalErr);
    } finally {
      isSyncing = false;
      this.notify();
    }
  },

  /**
   * PULL: Descarga los datos de Google Sheets e integra los cambios realizados directamente en las hojas
   */
  async pullFromGoogleWorkspace() {
    if (!navigator.onLine || !googleAuthService.isLoggedIn() || isSyncing) return;

    isSyncing = true;
    this.notify();

    try {
      console.log('[SyncManager] Descargando cambios bidireccionales desde Google Sheets...');
      const spreadsheetId = await sheetsService.getOrCreateSpreadsheet();

      const insumosRemote = await sheetsService.readSheetData(spreadsheetId, 'Insumos');
      const comprasRemote = await sheetsService.readSheetData(spreadsheetId, 'Compras');
      const recetasRemote = await sheetsService.readSheetData(spreadsheetId, 'Recetas');
      const detallesRemote = await sheetsService.readSheetData(spreadsheetId, 'Detalle_Recetas');
      const produccionRemote = await sheetsService.readSheetData(spreadsheetId, 'Produccion');

      const pendingMutations = await db.sync_queue.where('status').equals('pending').toArray();

      const syncTable = async (tableName, pkField, remoteData) => {
        if (!remoteData) return;
        const remotePkSet = new Set(remoteData.map(r => String(r[pkField])));
        const pendingCreatePks = new Set(
          pendingMutations
            .filter(m => m.table === tableName && m.action === 'CREATE')
            .map(m => String(m.payload[pkField]))
        );

        const localItems = await db[tableName].toArray();
        for (const local of localItems) {
          const pkVal = String(local[pkField]);
          if (!remotePkSet.has(pkVal) && !pendingCreatePks.has(pkVal)) {
            await db[tableName].delete(local[pkField]);
          }
        }

        if (remoteData.length > 0) {
          await db[tableName].bulkPut(remoteData);
        }
      };

      await syncTable('insumos', 'id_insumo', insumosRemote);
      await syncTable('compras', 'id_compra', comprasRemote);
      await syncTable('recetas', 'id_receta', recetasRemote);
      await syncTable('detalle_recetas', 'id_detalle', detallesRemote);
      await syncTable('produccion', 'id_produccion', produccionRemote);

      console.log('[SyncManager] Sincronización bidireccional completada con éxito.');
    } catch (e) {
      console.error('[SyncManager] Error al descargar datos de Google Workspace:', e);
    } finally {
      isSyncing = false;
      this.notify();
    }
  },

  /**
   * Inicia la sincronización automática periódica (Polling cada 45 segundos) y en enfoque de ventana
   */
  startAutoSync(intervalMs = 45000) {
    if (autoSyncTimer) clearInterval(autoSyncTimer);

    autoSyncTimer = setInterval(() => {
      if (navigator.onLine && googleAuthService.isLoggedIn()) {
        this.processQueue().then(() => this.pullFromGoogleWorkspace());
      }
    }, intervalMs);
  }
};

// Escuchadores globales de eventos de red y foco de la ventana para auto-sync bidireccional
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Network] Conexión restablecida. Iniciando sincronización bidireccional...');
    syncManager.processQueue().then(() => syncManager.pullFromGoogleWorkspace());
  });

  window.addEventListener('offline', () => {
    console.log('[Network] Conexión perdida. Cambiando a modo Offline-First.');
    syncManager.notify();
  });

  // Al regresar a la pestaña del navegador, sincronizar cambios hechos directamente en Google Sheets o Docs
  window.addEventListener('focus', () => {
    if (navigator.onLine && googleAuthService.isLoggedIn()) {
      syncManager.pullFromGoogleWorkspace();
    }
  });

  // Activar auto-sync periódico
  syncManager.startAutoSync();
}
