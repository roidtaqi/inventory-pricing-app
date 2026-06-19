import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, CloudDownload, CloudUpload, Database, Eye, EyeOff, RefreshCw, Send, Wifi } from 'lucide-react';
import { db } from '../db/db';
import { realtimeSyncService } from '../services/RealtimeSyncService';
import { formatCurrency } from '../utils/format';

type CloudState = Awaited<ReturnType<typeof realtimeSyncService.getCloudState>>;

export default function RealtimeSyncPage() {
  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState('ws://localhost:8787');
  const [apiToken, setApiToken] = useState('');
  const [showApiToken, setShowApiToken] = useState(false);
  const [status, setStatus] = useState(realtimeSyncService.getStatus());
  const [message, setMessage] = useState('');
  const [cloudState, setCloudState] = useState<CloudState | null>(null);
  const [isCheckingCloud, setIsCheckingCloud] = useState(false);
  const [isUploadingCloud, setIsUploadingCloud] = useState(false);
  const [isPullingCloud, setIsPullingCloud] = useState(false);
  const localProducts = useLiveQuery(() => db.products.count()) ?? 0;
  const localUnits = useLiveQuery(() => db.productUnits.count()) ?? 0;
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

  const refreshCloudState = async (showResultMessage = true) => {
    setIsCheckingCloud(true);
    try {
      await realtimeSyncService.saveConfig({ enabled, url, apiToken });
      const state = await realtimeSyncService.getCloudState(url, apiToken);
      setCloudState(state);
      if (showResultMessage) {
        setMessage(state.latest_catalog
          ? 'Cloud sudah berisi snapshot Inventory. Device lain bisa klik Ambil Cloud.'
          : 'Cloud belum berisi data Inventory. Upload Cloud dari device yang datanya paling lengkap.');
      }
      return state;
    } catch (error) {
      console.error(error);
      if (showResultMessage) {
        setMessage('Gagal mengecek cloud. Periksa URL sync server dan token.');
      }
      return null;
    } finally {
      setIsCheckingCloud(false);
    }
  };

  const saveAndConnect = async () => {
    await realtimeSyncService.saveConfig({ enabled, url, apiToken });
    if (enabled) {
      await realtimeSyncService.connect(url);
      realtimeSyncService.startAutoCloudPull();
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
    setIsUploadingCloud(true);
    try {
      await realtimeSyncService.saveConfig({ enabled, url, apiToken });
      const result = await realtimeSyncService.pushCloudSnapshot(url, apiToken);
      await refreshCloudState(false);
      setMessage(`Cloud tersimpan: ${result.count} produk. Buka HP lalu ambil data dari cloud.`);
    } catch (error) {
      console.error(error);
      setMessage('Gagal upload data ke cloud. Periksa URL sync server dan token.');
    } finally {
      setIsUploadingCloud(false);
    }
  };

  const pullCloudSnapshot = async () => {
    setIsPullingCloud(true);
    try {
      await realtimeSyncService.saveConfig({ enabled, url, apiToken });
      const result = await realtimeSyncService.pullCloudSnapshot(url, apiToken);
      await refreshCloudState(false);
      setMessage(result.success
        ? `Cloud diterima: ${result.products} produk dan ${result.productUnits} satuan. Katalog lokal sekarang disamakan dengan cloud.`
        : result.message || 'Cloud belum memiliki data.');
    } catch (error) {
      console.error(error);
      setMessage('Gagal mengambil data cloud. Periksa URL sync server dan token.');
    } finally {
      setIsPullingCloud(false);
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
        <div className="card space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-textMain">Sync Server</h2>
              <p className="mt-1 text-sm text-textMuted">Samakan data Inventory antar device dan kirim catalog ke POS.</p>
            </div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-primary">{status}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-3 text-sm">
            <div>
              <p className="text-textMuted">Data lokal</p>
              <p className="font-bold text-textMain">{localProducts} produk</p>
            </div>
            <div>
              <p className="text-textMuted">Satuan</p>
              <p className="font-bold text-textMain">{localUnits}</p>
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-textMain">URL Sync Server</span>
            <input
              className="input"
              value={url}
              onChange={event => setUrl(event.target.value)}
              placeholder="wss://pos-server.up.railway.app"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-textMain">Token API Sync</span>
            <div className="flex rounded-lg border border-border bg-white focus-within:ring-2 focus-within:ring-primary/30">
              <input
                className="min-w-0 flex-1 rounded-l-lg bg-transparent px-3 py-2 outline-none"
                value={apiToken}
                onChange={event => setApiToken(event.target.value)}
                placeholder="Isi sama seperti SYNC_API_TOKEN di Railway"
                type={showApiToken ? 'text' : 'password'}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowApiToken(current => !current)}
                className="flex w-11 items-center justify-center rounded-r-lg text-textMuted hover:bg-gray-50 hover:text-textMain"
                aria-label={showApiToken ? 'Sembunyikan token API' : 'Tampilkan token API'}
              >
                {showApiToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <div className={`rounded-lg border p-3 text-sm ${
            cloudState?.latest_catalog
              ? 'border-green-100 bg-green-50 text-green-800'
              : 'border-amber-100 bg-amber-50 text-amber-800'
          }`}>
            <div className="flex items-start gap-2">
              <Database className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-bold">
                  {cloudState
                    ? cloudState.latest_catalog ? 'Cloud sudah berisi data' : 'Cloud masih kosong'
                    : 'Status cloud belum dicek'}
                </p>
                <p className="mt-1">
                  {cloudState
                    ? `Storage: ${cloudState.storage || '-'} · Sales event: ${cloudState.sales_events}`
                    : 'Klik Cek Cloud setelah URL dan token diisi.'}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => void refreshCloudState()}
            disabled={isCheckingCloud}
            className="btn-secondary flex w-full items-center justify-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isCheckingCloud ? 'animate-spin' : ''}`} />
            {isCheckingCloud ? 'Mengecek...' : 'Cek Cloud'}
          </button>

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

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              onClick={uploadCloudSnapshot}
              disabled={isUploadingCloud}
              className="btn-secondary flex w-full items-center justify-center gap-2 text-sm"
            >
              <CloudUpload className="h-4 w-4" />
              {isUploadingCloud ? 'Upload...' : 'Upload Cloud'}
            </button>
            <button
              onClick={pullCloudSnapshot}
              disabled={isPullingCloud}
              className="btn-secondary flex w-full items-center justify-center gap-2 text-sm"
            >
              <CloudDownload className="h-4 w-4" />
              {isPullingCloud ? 'Mengambil...' : 'Ambil Cloud'}
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
