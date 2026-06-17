import { db } from '../db/db';

type ConnectionStatus = 'DISABLED' | 'CONNECTING' | 'CONNECTED' | 'OFFLINE' | 'ERROR';

interface RealtimeConfig {
  enabled: boolean;
  url: string;
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

const DEFAULT_URL = 'ws://localhost:8787';
const listeners = new Set<(status: ConnectionStatus) => void>();

let socket: WebSocket | null = null;
let status: ConnectionStatus = 'DISABLED';
let reconnectTimer: number | undefined;
let manualClose = false;
let publishingCatalog = false;

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
    appSettings: await db.appSettings.toArray()
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
    const settings = await db.appSettings.bulkGet(['realtimeEnabled', 'realtimeUrl']);
    return {
      enabled: settings[0]?.value === 'true',
      url: settings[1]?.value || DEFAULT_URL
    };
  },

  async saveConfig(config: RealtimeConfig) {
    await db.appSettings.bulkPut([
      { key: 'realtimeEnabled', value: String(config.enabled) },
      { key: 'realtimeUrl', value: config.url || DEFAULT_URL }
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
        client_name: 'Inventory Pricing App'
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
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('inventory-catalog-changed', () => {
    if (status === 'CONNECTED') {
      void realtimeSyncService.publishCatalogSnapshot();
    }
  });
}
