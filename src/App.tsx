import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Calculator, Box, Percent, CheckSquare, MoreHorizontal } from 'lucide-react';
import clsx from 'clsx';
import { useEffect } from 'react';
import { seedDatabase } from './db/seed';

import CalculatorPage from './pages/CalculatorPage';
import ProductsPage from './pages/ProductsPage';
import ProductFormPage from './pages/ProductFormPage';
import MarginPage from './pages/MarginPage';
import MarginRuleFormPage from './pages/MarginRuleFormPage';
import ApprovalPage from './pages/ApprovalPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import MasterDataPage from './pages/MasterDataPage';
import MorePage from './pages/MorePage';
import ImportCsvPage from './pages/ImportCsvPage';
import RealtimeSyncPage from './pages/RealtimeSyncPage';
import { realtimeSyncService } from './services/RealtimeSyncService';

function App() {
  const location = useLocation();

  useEffect(() => {
    seedDatabase()
      .then(() => realtimeSyncService.autoStart())
      .catch(console.error);
  }, []);

  const navItems = [
    { path: '/', label: 'Kalkulator', icon: Calculator },
    { path: '/products', label: 'Produk', icon: Box },
    { path: '/margin', label: 'Margin', icon: Percent },
    { path: '/approval', label: 'Approval', icon: CheckSquare },
    { path: '/more', label: 'Lainnya', icon: MoreHorizontal },
  ];

  return (
    <div className="flex flex-col h-screen bg-background text-textMain">
      <main className="flex-1 overflow-y-auto pb-20">
        <Routes>
          <Route path="/" element={<CalculatorPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/new" element={<ProductFormPage />} />
          <Route path="/products/:id" element={<ProductFormPage />} />
          <Route path="/margin" element={<MarginPage />} />
          <Route path="/margin/new" element={<MarginRuleFormPage />} />
          <Route path="/margin/:id" element={<MarginRuleFormPage />} />
          <Route path="/approval" element={<ApprovalPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/master-data" element={<MasterDataPage />} />
          <Route path="/more" element={<MorePage />} />
          <Route path="/import-csv" element={<ImportCsvPage />} />
          <Route path="/realtime-sync" element={<RealtimeSyncPage />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 z-50 flex w-full items-center justify-around border-t border-border bg-surface px-2 py-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isMoreItem = ['/more', '/history', '/settings', '/master-data', '/import-csv', '/realtime-sync'].includes(location.pathname);
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : item.path === '/more'
              ? isMoreItem
              : location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-label={item.label}
              title={item.label}
              className={clsx(
                "relative flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md transition-colors",
                isActive ? "text-primary" : "text-textMuted hover:text-primary/70"
              )}
            >
              <Icon className="h-5 w-5" />
              {isActive && (
                <span className="max-w-[72px] truncate text-[10px] font-semibold">{item.label}</span>
              )}
              {isActive && (
                <span className="absolute bottom-0 h-0.5 w-5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default App;
