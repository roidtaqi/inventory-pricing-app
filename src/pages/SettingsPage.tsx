import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Database, Download, Save } from 'lucide-react';
import { db } from '../db/db';

export default function SettingsPage() {
  const appSettings = useLiveQuery(() => db.appSettings.toArray());
  const defaultRule = useLiveQuery(() => db.marginRules.where('ruleType').equals('STORE_DEFAULT').first());

  const settings = useMemo(() => new Map((appSettings ?? []).map(setting => [setting.key, setting.value])), [appSettings]);

  const [appNameInput, setAppNameInput] = useState<string | null>(null);
  const [defaultPpnRateInput, setDefaultPpnRateInput] = useState<string | null>(null);
  const [defaultMarginInput, setDefaultMarginInput] = useState<string | null>(null);
  const [currencyFormatInput, setCurrencyFormatInput] = useState<string | null>(null);

  const appName = appNameInput ?? settings.get('appName') ?? 'Kalkulator Tekad Mandiri';
  const defaultPpnRate = defaultPpnRateInput ?? settings.get('defaultPpnRate') ?? '11';
  const defaultMargin = defaultMarginInput ?? defaultRule?.marginPercent.toString() ?? '15';
  const currencyFormat = currencyFormatInput ?? settings.get('currencyFormat') ?? 'IDR';

  const handleSave = async () => {
    const parsedPpnRate = Number(defaultPpnRate);
    const parsedMargin = Number(defaultMargin);

    if (!appName.trim()) {
      alert('Nama aplikasi wajib diisi');
      return;
    }
    if (!Number.isFinite(parsedPpnRate) || parsedPpnRate < 0) {
      alert('Default PPN tidak boleh negatif');
      return;
    }
    if (!Number.isFinite(parsedMargin) || parsedMargin <= 0 || parsedMargin >= 100) {
      alert('Default margin harus lebih dari 0 dan kurang dari 100%');
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
      alert('Settings tersimpan');
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan settings');
    }
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
        <Link to="/more" aria-label="Kembali" className="rounded-full p-2 -ml-2 text-textMain hover:bg-gray-100">
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
