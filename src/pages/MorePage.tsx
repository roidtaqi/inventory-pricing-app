import { Link } from 'react-router-dom';
import { ChevronRight, Database, FileSpreadsheet, History, RefreshCw, Settings } from 'lucide-react';

const menuItems = [
  {
    to: '/history',
    title: 'Riwayat Harga',
    description: 'Perubahan harga lama dan baru',
    icon: History,
  },
  {
    to: '/master-data',
    title: 'Master Data',
    description: 'Kategori, brand, dan supplier',
    icon: Database,
  },
  {
    to: '/import-csv',
    title: 'Import CSV',
    description: 'Produk, satuan, dan modal',
    icon: FileSpreadsheet,
  },
  {
    to: '/realtime-sync',
    title: 'Real-time Sync',
    description: 'Kirim harga aktif dan terima sales POS',
    icon: RefreshCw,
  },
  {
    to: '/settings',
    title: 'Settings',
    description: 'Role, notifikasi, PPN, dan backup',
    icon: Settings,
  },
];

export default function MorePage() {
  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-primary">Setup & Data</h1>

      <div className="space-y-3">
        {menuItems.map(item => {
          const Icon = item.icon;

          return (
            <Link key={item.to} to={item.to} className="card flex items-center gap-3 transition-colors hover:border-primary">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-textMain">{item.title}</div>
                <div className="mt-0.5 truncate text-sm text-textMuted">{item.description}</div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-textMuted" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
