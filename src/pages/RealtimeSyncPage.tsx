import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, RefreshCw, Send, Wifi } from 'lucide-react';
import { db } from '../db/db';
import { realtimeSyncService } from '../services/RealtimeSyncService';
import { formatCurrency } from '../utils/format';

export default function RealtimeSyncPage() {
  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState('ws://localhost:8787');
  const [apiToken, setApiToken] = useState('');
  const [status, setStatus] = useState(realtimeSyncService.getStatus());
  const [message, setMessage] = useState('');
  const posSales = useLiveQuery(() => db.posSales.orderBy('receivedAt').reverse().limit(20).toArray()) || [];
  const logs = useLiveQuery(() => db.realtimeSyncLogs.orderBy('createdAt').reverse().limit(20).toArray()) || [];

  useEffect(() => {
    let mounted = true;
    realtimeSyncService.getConfig().then(config => {
      if (!mounted) return;
      setEnabled(config.enabled);
      setUrl(config.url);
      setApiToken(config.apiToken || '');
    });

    const unsubscribe = realtimeSyncService.subscribe(setStatus);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const saveAndConnect = async () => {
    await realtimeSyncService.saveConfig({ enabled, url, apiToken });
    if (enabled) {
      await realtimeSyncService.connect(url);
      setMessage('Realtime sync tersimpan dan koneksi dimulai.');
    } else {
      realtimeSyncService.disconnect();
      setMessage('Realtime sync dinonaktifkan.');
    }
  };

  const publishCatalog = async () => {
    const result = await realtimeSyncService.publishCatalogSnapshot();
    setMessage(result.success ? `Catalog terkirim: ${result.count} produk.` : result.message || 'Gagal mengirim catalog.');
  };

  const uploadCloudSnapshot = async () => {
    try {
      await realtimeSyncService.saveConfig({ enabled, url, apiToken });
      const result = await realtimeSyncService.pushCloudSnapshot(url, apiToken);
      setMessage(`Cloud tersimpan: ${result.count} produk. Buka HP lalu ambil data dari cloud.`);
    } catch (error) {
      console.error(error);
      setMessage('Gagal upload data ke cloud. Periksa URL sync server dan token.');
    }
  };

  const pullCloudSnapshot = async () => {
    try {
      await realtimeSyncService.saveConfig({ enabled, url, apiToken });
      const result = await realtimeSyncService.pullCloudSnapshot(url, apiToken);
      setMessage(result.success
        ? `Cloud diterima: ${result.products} produk dan ${result.productUnits} satuan.`
        : result.message || 'Cloud belum memiliki data.');
    } catch (error) {
      console.error(error);
      setMessage('Gagal mengambil data cloud. Periksa URL sync server dan token.');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface p-4">
        <Link to="/" aria-label="Kembali" className="rounded-full p-2 -ml-2 text-textMain hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-textMain">Real-time Sync</h1>
      </div>

      <div className="mx-auto max-w-md space-y-4 p-4">
        <div className="card space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-textMain">Sync Server</h2>
              <p className="mt-1 text-sm text-textMuted">Publish harga aktif ke POS dan terima transaksi POS secara real-time.</p>
            </div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-primary">{status}</span>
          </div>

          <input
            className="input"
            value={url}
            onChange={event => setUrl(event.target.value)}
            placeholder="wss://pos-server.up.railway.app"
          />

          <input
            className="input"
            value={apiToken}
            onChange={event => setApiToken(event.target.value)}
            placeholder="API token opsional"
            type="password"
          />

          <label className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 text-sm font-semibold text-textMain">
            <input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} className="h-5 w-5" />
            Aktifkan real-time sync
          </label>

          <button onClick={saveAndConnect} className="btn-primary flex w-full items-center justify-center gap-2">
            <Wifi className="h-4 w-4" />
            Simpan & Connect
          </button>

          <button onClick={publishCatalog} className="btn-secondary flex w-full items-center justify-center gap-2">
            <Send className="h-4 w-4" />
            Publish Catalog Sekarang
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={uploadCloudSnapshot} className="btn-secondary flex w-full items-center justify-center gap-2 text-sm">
              Upload Cloud
            </button>
            <button onClick={pullCloudSnapshot} className="btn-secondary flex w-full items-center justify-center gap-2 text-sm">
              Ambil Cloud
            </button>
          </div>

          {message && <div className="rounded-lg bg-indigo-50 p-3 text-sm font-semibold text-primary">{message}</div>}
        </div>

        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" />
            <h2 className="font-bold text-textMain">Sales POS Diterima</h2>
          </div>
          {posSales.length === 0 ? (
            <p className="rounded-lg bg-gray-50 p-4 text-center text-sm text-textMuted">Belum ada transaksi POS masuk.</p>
          ) : (
            <div className="space-y-2">
              {posSales.map(sale => (
                <div key={sale.id} className="rounded-lg border border-border p-3">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-textMain">{sale.transactionId}</p>
                      <p className="text-xs text-textMuted">{sale.outletId} · {sale.cashierId}</p>
                    </div>
                    <p className="font-bold text-primary">{formatCurrency(sale.total)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card space-y-3">
          <h2 className="font-bold text-textMain">Log</h2>
          {logs.length === 0 ? (
            <p className="rounded-lg bg-gray-50 p-4 text-center text-sm text-textMuted">Belum ada log realtime.</p>
          ) : (
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="rounded-lg bg-gray-50 p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-bold text-textMain">{log.eventType}</span>
                    <span className={log.status === 'SUCCESS' ? 'text-green-700' : 'text-red-700'}>{log.status}</span>
                  </div>
                  <p className="mt-1 text-textMuted">{log.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
