import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Bell, Database, Download, LogOut, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { db } from '../db/db';
import { useAppAlert } from '../components/AppAlertContext';
import { NotificationService } from '../services/NotificationService';
import { authService } from '../services/AuthService';
import { realtimeSyncService } from '../services/RealtimeSyncService';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { showAlert } = useAppAlert();
  const appSettings = useLiveQuery(() => db.appSettings.toArray());
  const defaultRule = useLiveQuery(() => db.marginRules.where('ruleType').equals('STORE_DEFAULT').first());
  const currentUser = authService.getCurrentUser();
  const currentUserId = currentUser?.id;
  const authUser = useLiveQuery(() => currentUserId ? db.authUsers.get(currentUserId) : undefined, [currentUserId]);
  const authUsersCount = useLiveQuery(() => db.authUsers.count(), []) ?? 0;
  const authRolesCount = useLiveQuery(() => db.authRoles.count(), []) ?? 0;

  const settings = useMemo(() => new Map((appSettings ?? []).map(setting => [setting.key, setting.value])), [appSettings]);

  const [appNameInput, setAppNameInput] = useState<string | null>(null);
  const [defaultPpnRateInput, setDefaultPpnRateInput] = useState<string | null>(null);
  const [defaultMarginInput, setDefaultMarginInput] = useState<string | null>(null);
  const [currencyFormatInput, setCurrencyFormatInput] = useState<string | null>(null);
  const [isSyncingUsers, setIsSyncingUsers] = useState(false);

  const appName = appNameInput ?? settings.get('appName') ?? 'Kalkulator Tekad Mandiri';
  const defaultPpnRate = defaultPpnRateInput ?? settings.get('defaultPpnRate') ?? '11';
  const defaultMargin = defaultMarginInput ?? defaultRule?.marginPercent.toString() ?? '15';
  const currencyFormat = currencyFormatInput ?? settings.get('currencyFormat') ?? 'IDR';
  const notificationPermission = NotificationService.getPermission();
  const notificationEnabled = settings.get(NotificationService.ENABLED_SETTING_KEY) === 'true' && notificationPermission === 'granted';
  const notificationLabel = notificationPermission === 'unsupported'
    ? 'Tidak didukung browser'
    : notificationEnabled
      ? 'Aktif'
      : notificationPermission === 'denied'
        ? 'Diblokir browser'
        : 'Belum aktif';

  const handleSave = async () => {
    const parsedPpnRate = Number(defaultPpnRate);
    const parsedMargin = Number(defaultMargin);

    if (!appName.trim()) {
      showAlert({ tone: 'warning', title: 'Periksa Settings', message: 'Nama aplikasi wajib diisi.' });
      return;
    }
    if (!Number.isFinite(parsedPpnRate) || parsedPpnRate < 0) {
      showAlert({ tone: 'warning', title: 'Periksa Settings', message: 'Default PPN tidak boleh negatif.' });
      return;
    }
    if (!Number.isFinite(parsedMargin) || parsedMargin <= 0 || parsedMargin >= 100) {
      showAlert({ tone: 'warning', title: 'Periksa Settings', message: 'Default margin harus lebih dari 0 dan kurang dari 100%.' });
      return;
    }

    try {
      await db.transaction('rw', db.appSettings, db.marginRules, async () => {
        await db.appSettings.bulkPut([
          { key: 'appName', value: appName.trim() },
          { key: 'defaultPpnRate', value: parsedPpnRate.toString() },
          { key: 'currencyFormat', value: currencyFormat },
          { key: 'roundingMode', value: 'NEAREST_THOUSAND_500_THRESHOLD' },
        ]);

        await db.marginRules.put({
          id: defaultRule?.id ?? 'rule-default',
          ruleType: 'STORE_DEFAULT',
          marginPercent: parsedMargin,
          priority: 5,
          isActive: true,
          effectiveFrom: defaultRule?.effectiveFrom,
          effectiveUntil: defaultRule?.effectiveUntil,
        });
      });
      showAlert({ tone: 'success', title: 'Settings Tersimpan', message: 'Pengaturan aplikasi berhasil disimpan.' });
    } catch (error) {
      console.error(error);
      showAlert({ tone: 'error', title: 'Gagal Menyimpan', message: 'Settings belum berhasil disimpan. Coba ulangi lagi.' });
    }
  };

  const handleToggleNotifications = async () => {
    if (notificationEnabled) {
      await NotificationService.setEnabled(false);
      showAlert({ tone: 'info', title: 'Notifikasi Dimatikan', message: 'Notifikasi approval tidak akan tampil di device ini.' });
      return;
    }

    const permission = await NotificationService.requestPermission();
    if (permission === 'granted') {
      showAlert({ tone: 'success', title: 'Notifikasi Aktif', message: 'Device ini akan menampilkan notifikasi approval saat aplikasi terbuka.' });
      return;
    }
    if (permission === 'denied') {
      showAlert({ tone: 'warning', title: 'Izin Diblokir', message: 'Buka pengaturan browser untuk mengizinkan notifikasi aplikasi ini.' });
      return;
    }
    showAlert({ tone: 'warning', title: 'Tidak Didukung', message: 'Browser ini belum mendukung notifikasi aplikasi.' });
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

  const handleLogout = () => {
    authService.logout();
    navigate('/login', { replace: true });
  };

  const handleExport = async () => {
    const data = {
      exportedAt: new Date().toISOString(),
      categories: await db.categories.toArray(),
      brands: await db.brands.toArray(),
      suppliers: await db.suppliers.toArray(),
      products: await db.products.toArray(),
      productUnits: await db.productUnits.toArray(),
      marginRules: await db.marginRules.toArray(),
      priceCalculations: await db.priceCalculations.toArray(),
      priceHistories: await db.priceHistories.toArray(),
      appSettings: await db.appSettings.toArray(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory-pricing-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface p-4">
        <Link to="/" aria-label="Kembali" className="rounded-full p-2 -ml-2 text-textMain hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-textMain">Settings</h1>
      </div>

      <div className="mx-auto max-w-md space-y-4 p-4">
        <div className="card space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Nama Aplikasi</label>
            <input className="input" value={appName} onChange={e => setAppNameInput(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium mb-1">Default PPN (%)</label>
              <input type="number" className="input" value={defaultPpnRate} onChange={e => setDefaultPpnRateInput(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Default Margin (%)</label>
              <input type="number" className="input" value={defaultMargin} onChange={e => setDefaultMarginInput(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Format Mata Uang</label>
            <select className="input" value={currencyFormat} onChange={e => setCurrencyFormatInput(e.target.value)}>
              <option value="IDR">Rupiah (IDR)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Rounding Mode</label>
            <input className="input bg-gray-50 text-textMuted" value="Ribuan terdekat" readOnly />
          </div>
        </div>

        <div className="card space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-textMain">{authUser?.name ?? currentUser?.name ?? 'User POS'}</h2>
              <p className="mt-0.5 text-sm leading-5 text-textMuted">{authUser?.role ?? currentUser?.role ?? '-'} · {authUser?.position_title ?? currentUser?.position_title ?? 'Profil POS'}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs font-bold uppercase text-textMuted">Email</div>
              <div className="mt-1 truncate font-medium text-textMain">{authUser?.email ?? currentUser?.email ?? '-'}</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs font-bold uppercase text-textMuted">Nomor HP</div>
              <div className="mt-1 truncate font-medium text-textMain">{authUser?.phone ?? currentUser?.phone ?? '-'}</div>
            </div>
          </div>
          {authUser?.profile_note && (
            <div className="rounded-lg bg-gray-50 p-3 text-sm leading-6 text-textMuted">
              {authUser.profile_note}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={handleSyncUsers} disabled={isSyncingUsers} className="btn-secondary flex items-center justify-center gap-2 py-2 text-sm">
              <RefreshCw className={`h-4 w-4 ${isSyncingUsers ? 'animate-spin' : ''}`} />
              {isSyncingUsers ? 'Sinkron...' : 'User POS'}
            </button>
            <button type="button" onClick={handleLogout} className="btn-secondary flex items-center justify-center gap-2 py-2 text-sm">
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          </div>
          <div className="text-xs text-textMuted">
            {authUsersCount} user · {authRolesCount} role tersimpan dari POS.
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-gray-50 p-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-bold text-textMain">
                <Bell className="h-4 w-4 text-primary" />
                Notifikasi Approval
              </div>
              <div className="mt-0.5 text-xs text-textMuted">{notificationLabel}</div>
            </div>
            <button type="button" onClick={handleToggleNotifications} className="btn-secondary shrink-0 px-3 py-2 text-sm">
              {notificationEnabled ? 'Matikan' : 'Aktifkan'}
            </button>
          </div>
        </div>

        <button onClick={handleSave} className="btn-primary flex w-full items-center justify-center gap-2 py-3">
          <Save className="h-4 w-4" />
          Simpan Settings
        </button>

        <Link to="/master-data" className="btn-secondary flex w-full items-center justify-center gap-2 py-3">
          <Database className="h-4 w-4" />
          Master Data
        </Link>

        <div className="card space-y-3">
          <div>
            <h2 className="font-bold text-textMain">Backup Data</h2>
          </div>
          <button onClick={handleExport} className="btn-secondary flex w-full items-center justify-center gap-2">
            <Download className="h-4 w-4" />
            Export JSON
          </button>
        </div>
      </div>
    </div>
  );
}
