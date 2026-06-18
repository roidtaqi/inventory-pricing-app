import { useMemo, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { LockKeyhole, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { useAppAlert } from '../components/AppAlertContext';
import { authService } from '../services/AuthService';
import { realtimeSyncService } from '../services/RealtimeSyncService';

export default function LoginPage() {
  const navigate = useNavigate();
  const { showAlert } = useAppAlert();
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncingUsers, setIsSyncingUsers] = useState(false);
  const appSettings = useLiveQuery(() => db.appSettings.toArray());

  const appName = useMemo(() => {
    const settings = new Map((appSettings ?? []).map(setting => [setting.key, setting.value]));
    return settings.get('appName') ?? 'Kalkulator Tekad Mandiri';
  }, [appSettings]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!identifier.trim() || !pin.trim()) {
      showAlert({ tone: 'warning', title: 'Login Belum Lengkap', message: 'Isi email/nomor HP dan PIN POS.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await authService.login(identifier, pin);
      if (result.success) {
        navigate('/', { replace: true });
        return;
      }

      showAlert({ tone: 'warning', title: 'Login Gagal', message: result.message ?? 'Data login tidak cocok.' });
      setPin('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncUsers = async () => {
    setIsSyncingUsers(true);
    try {
      const result = await realtimeSyncService.pullPosAuthSnapshot();
      if (result.success) {
        showAlert({ tone: 'success', title: 'User POS Diperbarui', message: `${result.users} user dan ${result.roles} role sudah disamakan.` });
        return;
      }

      showAlert({ tone: 'warning', title: 'Belum Ada Snapshot POS', message: result.message ?? 'Cloud POS belum memiliki data user.' });
    } catch (error) {
      console.error(error);
      showAlert({ tone: 'error', title: 'Gagal Sinkron User', message: 'Belum bisa mengambil user dari POS Cloud. Coba lagi setelah POS melakukan backup semua data.' });
    } finally {
      setIsSyncingUsers(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-6">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-white">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-textMain">{appName}</h1>
          <p className="mt-1 text-sm text-textMuted">Masuk dengan data user POS.</p>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-textMain">Email atau Nomor HP</label>
            <input
              className="input"
              value={identifier}
              onChange={event => setIdentifier(event.target.value)}
              autoComplete="username"
              inputMode="email"
              placeholder="contoh: roid@kastur.local"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-textMain">PIN POS</label>
            <input
              className="input"
              value={pin}
              onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
              autoComplete="current-password"
              inputMode="numeric"
              type="password"
              placeholder="PIN"
            />
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary flex w-full items-center justify-center py-3">
            {isSubmitting ? 'Memeriksa...' : 'Masuk'}
          </button>
        </form>

        <button
          type="button"
          onClick={handleSyncUsers}
          disabled={isSyncingUsers}
          className="btn-secondary mt-3 flex w-full items-center justify-center gap-2 py-3 text-sm"
        >
          <RefreshCw className={`h-4 w-4 ${isSyncingUsers ? 'animate-spin' : ''}`} />
          {isSyncingUsers ? 'Mengambil user...' : 'Perbarui User POS'}
        </button>
      </div>
    </div>
  );
}
