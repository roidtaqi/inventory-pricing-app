import { db } from '../db/db';
import { authService } from './AuthService';

type ConnectionStatus = 'DISABLED' | 'CONNECTING' | 'CONNECTED' | 'OFFLINE' | 'ERROR';

interface RealtimeConfig {
  enabled: boolean;
  url: string;
  apiToken?: string;
}

interface SalePayload {
  transaction_id: string;
  cashier_id: string;
  outlet_id: string;
  created_at: string;
  total: number;
  paid: number;
  change: number;
}

const DEFAULT_URL = import.meta.env.VITE_SYNC_URL || 'wss://pos-server.up.railway.app';
const DEFAULT_API_TOKEN = import.meta.env.VITE_SYNC_API_TOKEN || 'kastur-sync-2026-Roid-Nawir-8xAq72Lm';
const listeners = new Set<(status: ConnectionStatus) => void>();

let socket: WebSocket | null = null;
let status: ConnectionStatus = 'DISABLED';
let reconnectTimer: number | undefined;
let manualClose = false;
let publishingCatalog = false;
const DEVICE_SETTING_KEYS = new Set([
  'realtimeEnabled',
  'realtimeUrl',
  'realtimeApiToken',
  'currentUserRole',
  'currentUserName',
  'browserNotificationsEnabled',
]);

function emit(nextStatus: ConnectionStatus) {
  status = nextStatus;
  listeners.forEach(listener => listener(status));
}

function send(message: unknown) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
    return true;
  }
  return false;
}

function parseMessage(event: MessageEvent) {
  try {
    return JSON.parse(event.data as string);
  } catch {
    return null;
  }
}

async function logSync(direction: 'IN' | 'OUT', eventType: string, statusValue: 'SUCCESS' | 'FAILED', message: string) {
  await db.realtimeSyncLogs.add({
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    direction,
    eventType,
    status: statusValue,
    message,
    createdAt: Date.now()
  });
}

async function buildCatalogSnapshot() {
  return {
    exportedAt: new Date().toISOString(),
    categories: await db.categories.toArray(),
    brands: await db.brands.toArray(),
    suppliers: await db.suppliers.toArray(),
    products: await db.products.toArray(),
    productUnits: await db.productUnits.toArray(),
    marginRules: await db.marginRules.toArray(),
    priceCalculations: await db.priceCalculations.toArray(),
    priceHistories: await db.priceHistories.toArray(),
    productUnitCostHistories: await db.productUnitCostHistories.toArray(),
    csvImportBatches: await db.csvImportBatches.toArray(),
    csvImportRows: await db.csvImportRows.toArray(),
    posSales: await db.posSales.toArray(),
    realtimeSyncLogs: await db.realtimeSyncLogs.toArray(),
    appSettings: (await db.appSettings.toArray()).filter(setting => !DEVICE_SETTING_KEYS.has(setting.key))
  };
}

type CatalogSnapshot = Awaited<ReturnType<typeof buildCatalogSnapshot>>;
type CloudState = {
  ok: boolean;
  latest_catalog: boolean;
  sales_events: number;
  stock_events?: number;
  storage?: string;
};

function toHttpUrl(url: string) {
  const trimmed = (url || DEFAULT_URL).trim().replace(/\/$/, '');
  if (trimmed.startsWith('wss://')) return `https://${trimmed.slice(6)}`;
  if (trimmed.startsWith('ws://')) return `http://${trimmed.slice(5)}`;
  return trimmed;
}

function buildAuthHeaders(apiToken?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (apiToken) headers['x-sync-token'] = apiToken;
  return headers;
}

async function importCatalogSnapshot(snapshot: Partial<CatalogSnapshot>) {
  const appSettings = (snapshot.appSettings || []).filter(setting => !DEVICE_SETTING_KEYS.has(setting.key));

  await db.transaction(
    'rw',
    [
      db.categories,
      db.brands,
      db.suppliers,
      db.products,
      db.productUnits,
      db.marginRules,
      db.priceCalculations,
      db.priceHistories,
      db.productUnitCostHistories,
      db.csvImportBatches,
      db.csvImportRows,
      db.posSales,
      db.realtimeSyncLogs,
      db.appSettings,
    ],
    async () => {
      await Promise.all([
        db.categories.clear(),
        db.brands.clear(),
        db.suppliers.clear(),
        db.products.clear(),
        db.productUnits.clear(),
        db.marginRules.clear(),
        db.priceCalculations.clear(),
        db.priceHistories.clear(),
        db.productUnitCostHistories.clear(),
        db.csvImportBatches.clear(),
        db.csvImportRows.clear(),
        db.posSales.clear(),
        db.realtimeSyncLogs.clear(),
      ]);

      const existingSettings = await db.appSettings.toArray();
      const syncedSettingKeys = existingSettings
        .filter(setting => !DEVICE_SETTING_KEYS.has(setting.key))
        .map(setting => setting.key);
      if (syncedSettingKeys.length) await db.appSettings.bulkDelete(syncedSettingKeys);

      if (snapshot.categories?.length) await db.categories.bulkPut(snapshot.categories);
      if (snapshot.brands?.length) await db.brands.bulkPut(snapshot.brands);
      if (snapshot.suppliers?.length) await db.suppliers.bulkPut(snapshot.suppliers);
      if (snapshot.products?.length) await db.products.bulkPut(snapshot.products);
      if (snapshot.productUnits?.length) await db.productUnits.bulkPut(snapshot.productUnits);
      if (snapshot.marginRules?.length) await db.marginRules.bulkPut(snapshot.marginRules);
      if (snapshot.priceCalculations?.length) await db.priceCalculations.bulkPut(snapshot.priceCalculations);
      if (snapshot.priceHistories?.length) await db.priceHistories.bulkPut(snapshot.priceHistories);
      if (snapshot.productUnitCostHistories?.length) await db.productUnitCostHistories.bulkPut(snapshot.productUnitCostHistories);
      if (snapshot.csvImportBatches?.length) await db.csvImportBatches.bulkPut(snapshot.csvImportBatches);
      if (snapshot.csvImportRows?.length) await db.csvImportRows.bulkPut(snapshot.csvImportRows);
      if (snapshot.posSales?.length) await db.posSales.bulkPut(snapshot.posSales);
      if (snapshot.realtimeSyncLogs?.length) await db.realtimeSyncLogs.bulkPut(snapshot.realtimeSyncLogs);
      if (appSettings.length) await db.appSettings.bulkPut(appSettings);
    }
  );

  return {
    products: snapshot.products?.length || 0,
    productUnits: snapshot.productUnits?.length || 0,
    priceCalculations: snapshot.priceCalculations?.length || 0,
    posSales: snapshot.posSales?.length || 0,
  };
}

async function importSaleEvent(message: { event_id?: string; payload?: SalePayload }) {
  const payload = message.payload;
  if (!payload?.transaction_id) return;

  const existing = await db.posSales.where('transactionId').equals(payload.transaction_id).first();
  if (existing) return;

  await db.posSales.add({
    id: message.event_id || payload.transaction_id,
    transactionId: payload.transaction_id,
    cashierId: payload.cashier_id,
    outletId: payload.outlet_id,
    createdAt: payload.created_at,
    total: payload.total,
    paid: payload.paid,
    change: payload.change,
    payload: JSON.stringify(payload),
    receivedAt: Date.now()
  });

  await logSync('IN', 'sale.created', 'SUCCESS', `Sales POS diterima: ${payload.transaction_id}`);
}

async function importServerState(message: { pending_sales?: Array<{ event_id?: string; payload?: SalePayload }> }) {
  for (const sale of message.pending_sales || []) {
    await importSaleEvent(sale);
  }
}

function scheduleReconnect() {
  if (manualClose) return;
  window.clearTimeout(reconnectTimer);
  reconnectTimer = window.setTimeout(() => {
    void realtimeSyncService.connect();
  }, 3000);
}

export const realtimeSyncService = {
  async getConfig(): Promise<RealtimeConfig> {
    const settings = await db.appSettings.bulkGet(['realtimeEnabled', 'realtimeUrl', 'realtimeApiToken']);
    return {
      enabled: settings[0]?.value === 'true',
      url: settings[1]?.value || DEFAULT_URL,
      apiToken: settings[2]?.value || DEFAULT_API_TOKEN
    };
  },

  async saveConfig(config: RealtimeConfig) {
    await db.appSettings.bulkPut([
      { key: 'realtimeEnabled', value: String(config.enabled) },
      { key: 'realtimeUrl', value: config.url || DEFAULT_URL },
      { key: 'realtimeApiToken', value: config.apiToken || '' }
    ]);
  },

  getStatus() {
    return status;
  },

  subscribe(listener: (status: ConnectionStatus) => void) {
    listeners.add(listener);
    listener(status);
    return () => listeners.delete(listener);
  },

  async autoStart() {
    const config = await this.getConfig();
    if (config.enabled) {
      await this.connect(config.url);
    }
  },

  async connect(customUrl?: string) {
    const config = await this.getConfig();
    const url = customUrl || config.url || DEFAULT_URL;
    manualClose = false;

    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

    emit('CONNECTING');
    socket = new WebSocket(url);

    socket.addEventListener('open', () => {
      emit('CONNECTED');
      send({
        type: 'client.hello',
        app: 'inventory',
        client_name: 'Kalkulator Tekad Mandiri'
      });
    });

    socket.addEventListener('message', event => {
      const message = parseMessage(event);
      if (!message) return;

      if (message.type === 'server.state') void importServerState(message);
      if (message.type === 'sale.created') void importSaleEvent(message);
      if (message.type === 'ack' && message.entity === 'catalog') {
        void logSync('OUT', 'catalog.snapshot', 'SUCCESS', 'Catalog snapshot diterima sync server');
      }
      if (message.type === 'error') {
        void logSync('IN', 'error', 'FAILED', message.message || 'Realtime sync error');
      }
    });

    socket.addEventListener('close', () => {
      socket = null;
      emit(manualClose ? 'DISABLED' : 'OFFLINE');
      scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      emit('ERROR');
    });
  },

  disconnect() {
    manualClose = true;
    window.clearTimeout(reconnectTimer);
    socket?.close();
    socket = null;
    emit('DISABLED');
  },

  async publishCatalogSnapshot() {
    if (publishingCatalog) {
      return { success: false, message: 'Publish catalog sedang berjalan' };
    }

    const catalog = await buildCatalogSnapshot();
    const eventId = `catalog_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    publishingCatalog = true;
    const sent = send({
      type: 'catalog.snapshot',
      event_id: eventId,
      source: 'inventory-pricing-app',
      payload: catalog,
      created_at: new Date().toISOString()
    });

    if (!sent) {
      publishingCatalog = false;
      await logSync('OUT', 'catalog.snapshot', 'FAILED', 'Sync server belum terkoneksi');
      return { success: false, message: 'Sync server belum terkoneksi' };
    }

    await logSync('OUT', 'catalog.snapshot', 'SUCCESS', `Catalog snapshot dikirim: ${catalog.products.length} produk`);
    publishingCatalog = false;
    return { success: true, count: catalog.products.length };
  },

  async pushCloudSnapshot(customUrl?: string, customToken?: string) {
    const config = await this.getConfig();
    const baseUrl = toHttpUrl(customUrl || config.url);
    const apiToken = customToken ?? config.apiToken;
    const catalog = await buildCatalogSnapshot();

    const response = await fetch(`${baseUrl}/api/inventory/snapshot`, {
      method: 'PUT',
      headers: buildAuthHeaders(apiToken),
      body: JSON.stringify({
        source: 'inventory-pricing-app',
        payload: catalog,
        created_at: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`Cloud sync gagal: ${response.status}`);
    }

    await logSync('OUT', 'cloud.snapshot', 'SUCCESS', `Cloud snapshot tersimpan: ${catalog.products.length} produk`);
    return { success: true, count: catalog.products.length };
  },

  async getCloudState(customUrl?: string, customToken?: string): Promise<CloudState> {
    const config = await this.getConfig();
    const baseUrl = toHttpUrl(customUrl || config.url);
    const apiToken = customToken ?? config.apiToken;

    const response = await fetch(`${baseUrl}/api/state`, {
      headers: apiToken ? { 'x-sync-token': apiToken } : undefined
    });

    if (!response.ok) {
      throw new Error(`Cloud state gagal: ${response.status}`);
    }

    return response.json();
  },

  async pullCloudSnapshot(customUrl?: string, customToken?: string) {
    const config = await this.getConfig();
    const baseUrl = toHttpUrl(customUrl || config.url);
    const apiToken = customToken ?? config.apiToken;

    const response = await fetch(`${baseUrl}/api/inventory/snapshot`, {
      headers: apiToken ? { 'x-sync-token': apiToken } : undefined
    });

    if (!response.ok) {
      throw new Error(`Cloud sync gagal: ${response.status}`);
    }

    const data = await response.json();
    if (!data.snapshot) {
      return {
        success: false,
        message: 'Cloud belum memiliki snapshot Inventory.',
        products: 0,
        productUnits: 0,
        priceCalculations: 0,
      };
    }

    const result = await importCatalogSnapshot(data.snapshot);
    await logSync('IN', 'cloud.snapshot', 'SUCCESS', `Cloud snapshot diterima dan katalog lokal disamakan: ${result.products} produk`);
    return { success: true, ...result };
  },

  async pullPosAuthSnapshot(customUrl?: string, customToken?: string) {
    const config = await this.getConfig();
    const baseUrl = toHttpUrl(customUrl || config.url);
    const apiToken = customToken ?? config.apiToken;

    const response = await fetch(`${baseUrl}/api/pos/snapshot`, {
      headers: apiToken ? { 'x-sync-token': apiToken } : undefined
    });

    if (!response.ok) {
      throw new Error(`Cloud POS auth gagal: ${response.status}`);
    }

    const data = await response.json();
    if (!data.snapshot) {
      return {
        success: false,
        message: 'Cloud belum memiliki snapshot POS.',
        users: 0,
        roles: 0,
      };
    }

    const result = await authService.importPosAuthSnapshot(data.snapshot);
    if (result.success) {
      await logSync('IN', 'pos.auth.snapshot', 'SUCCESS', `User POS diterima: ${result.users} user, ${result.roles} role`);
    }
    return result;
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('inventory-catalog-changed', () => {
    if (status === 'CONNECTED') {
      void realtimeSyncService.publishCatalogSnapshot();
    }
  });
}
