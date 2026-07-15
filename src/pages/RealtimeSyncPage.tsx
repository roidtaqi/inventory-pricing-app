import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, CheckCircle2, Cloud, Database, RefreshCw, WifiOff } from 'lucide-react';
import { db } from '../db/db';
import { realtimeSyncService } from '../services/RealtimeSyncService';

type CloudState = Awaited<ReturnType<typeof realtimeSyncService.getCloudState>>;

export default function RealtimeSyncPage() {
  const [status, setStatus] = useState(realtimeSyncService.getStatus());
  const [cloudState, setCloudState] = useState<CloudState | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [hasError, setHasError] = useState(false);
  const localProducts = useLiveQuery(() => db.products.count()) ?? 0;
  const localUnits = useLiveQuery(() => db.productUnits.count()) ?? 0;

  useEffect(() => {
    const unsubscribe = realtimeSyncService.subscribe(setStatus);
    void realtimeSyncService.getCloudState().then(setCloudState).catch(() => setCloudState(null));
    return () => {
      unsubscribe();
    };
  }, []);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setHasError(false);
    setResultMessage('');

    try {
      const result = await realtimeSyncService.syncNow();
      const nextCloudState = await realtimeSyncService.getCloudState();
      setCloudState(nextCloudState);
      setResultMessage(
        result.direction === 'uploaded'
          ? `${result.products} produk berhasil disimpan ke cloud.`
          : `${result.products} produk berhasil disamakan dari cloud.`
      );
    } catch (error) {
      console.error(error);
      setHasError(true);
      setResultMessage('Sinkronisasi belum berhasil. Periksa koneksi internet lalu coba kembali.');
    } finally {
      setIsSyncing(false);
    }
  };

  const connected = status === 'CONNECTED';
  const intervalSeconds = Math.round(realtimeSyncService.getAutoPullIntervalMs() / 1000);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface p-4">
        <Link to="/" aria-label="Kembali" className="-ml-2 rounded-full p-2 text-textMain hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-textMain">Sinkronisasi</h1>
      </header>

      <main className="mx-auto max-w-xl p-4">
        <section className="rounded-lg border border-border bg-surface">
          <div className="flex items-start justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${connected ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-textMuted'}`}>
                {connected ? <Cloud className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-textMain">Kastur Cloud</h2>
                <p className="text-sm text-textMuted">{connected ? 'Terhubung dan sinkron otomatis' : status === 'CONNECTING' ? 'Sedang menghubungkan' : 'Menunggu koneksi'}</p>
              </div>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${connected ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-textMuted'}`}>
              {connected ? 'Online' : 'Offline'}
            </span>
          </div>

          <div className="grid grid-cols-3 border-y border-border bg-gray-50">
            <div className="p-3 text-center">
              <p className="text-xs text-textMuted">Produk</p>
              <p className="mt-1 text-lg font-bold text-textMain">{localProducts}</p>
            </div>
            <div className="border-x border-border p-3 text-center">
              <p className="text-xs text-textMuted">Satuan</p>
              <p className="mt-1 text-lg font-bold text-textMain">{localUnits}</p>
            </div>
            <div className="p-3 text-center">
              <p className="text-xs text-textMuted">Cloud</p>
              <p className="mt-1 text-sm font-bold text-textMain">{cloudState?.latest_catalog ? 'Tersedia' : 'Belum ada'}</p>
            </div>
          </div>

          <div className="p-4">
            <button
              type="button"
              onClick={() => void handleSyncNow()}
              disabled={isSyncing}
              className="btn-primary flex min-h-11 w-full items-center justify-center gap-2"
            >
              <RefreshCw className={`h-5 w-5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}
            </button>

            <p className="mt-3 text-center text-xs text-textMuted">Pembaruan otomatis setiap {intervalSeconds} detik</p>

            {resultMessage && (
              <div className={`mt-4 flex items-start gap-2 rounded-lg p-3 text-sm font-semibold ${hasError ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}>
                {hasError ? <WifiOff className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
                <span>{resultMessage}</span>
              </div>
            )}
          </div>
        </section>

        <div className="mt-4 flex items-center gap-2 px-1 text-xs text-textMuted">
          <Database className="h-4 w-4 shrink-0" />
          <span>Data pusat tersimpan di Cloud.</span>
        </div>
      </main>
    </div>
  );
}
