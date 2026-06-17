import { Link } from 'react-router-dom';
import {
  Calculator,
  CheckSquare,
  Database,
  FileSpreadsheet,
  History,
  Percent,
  Plus,
  RefreshCw,
  Settings,
  SlidersHorizontal,
  Package,
} from 'lucide-react';

const calculatorActions = [
  {
    label: 'Faktur Supplier',
    helper: 'Karton / pcs',
    to: '/calculator?mode=invoice',
    icon: Calculator,
    primary: true,
  },
  {
    label: 'Produk Terdaftar',
    helper: 'Update harga',
    to: '/calculator?mode=product',
    icon: SlidersHorizontal,
  },
];

const mainActions = [
  { label: 'Produk', helper: 'Daftar barang', to: '/products', icon: Package },
  { label: 'Tambah', helper: 'Produk baru', to: '/products/new', icon: Plus },
  { label: 'Margin', helper: 'Aturan harga', to: '/margin', icon: Percent },
  { label: 'Approval', helper: 'Draft harga', to: '/approval', icon: CheckSquare },
  { label: 'Riwayat', helper: 'Harga lama', to: '/history', icon: History },
];

const setupActions = [
  { label: 'Pengaturan', to: '/settings', icon: Settings },
  { label: 'Master', to: '/master-data', icon: Database },
  { label: 'Import', to: '/import-csv', icon: FileSpreadsheet },
  { label: 'Sync', to: '/realtime-sync', icon: RefreshCw },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-textMuted">Beranda</p>
          <h1 className="truncate text-2xl font-bold text-primary">Kalkulator Tekad Mandiri</h1>
        </div>
      </header>

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-bold text-textMain">Hitung Harga</h2>
        <div className="grid grid-cols-2 gap-2">
          {calculatorActions.map(action => {
            const Icon = action.icon;

            return (
              <Link
                key={action.to}
                to={action.to}
                className={
                  action.primary
                    ? 'rounded-lg bg-primary p-3 text-white shadow-sm transition-colors hover:bg-indigo-700'
                    : 'rounded-lg border border-border bg-surface p-3 text-textMain shadow-sm transition-colors hover:border-primary'
                }
              >
                <div className={action.primary ? 'flex h-9 w-9 items-center justify-center rounded-md bg-white/15' : 'flex h-9 w-9 items-center justify-center rounded-md bg-indigo-50 text-primary'}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-3 text-sm font-bold leading-5">{action.label}</div>
                <div className={action.primary ? 'mt-0.5 text-xs text-white/80' : 'mt-0.5 text-xs text-textMuted'}>{action.helper}</div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-bold text-textMain">Menu Utama</h2>
        <div className="grid grid-cols-2 gap-2">
          {mainActions.map(action => {
            const Icon = action.icon;

            return (
              <Link
                key={action.to}
                to={action.to}
                className="flex min-h-[68px] items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-sm transition-colors hover:border-primary"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-textMain">{action.label}</div>
                  <div className="truncate text-xs text-textMuted">{action.helper}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-textMain">Data & Pengaturan</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {setupActions.map(action => {
            const Icon = action.icon;

            return (
              <Link
                key={action.to}
                to={action.to}
                aria-label={action.label}
                title={action.label}
                className="flex h-11 items-center gap-2 rounded-md bg-gray-50 px-3 text-sm font-semibold text-textMain transition-colors hover:bg-indigo-50 hover:text-primary"
              >
                <Icon className="h-5 w-5 shrink-0 text-primary" />
                <span className="truncate">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
