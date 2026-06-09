import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Calculator, Box, Percent, CheckSquare, History, Settings } from 'lucide-react';
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

function App() {
  const location = useLocation();

  useEffect(() => {
    seedDatabase().catch(console.error);
  }, []);

  const navItems = [
    { path: '/', label: 'Kalkulator', icon: Calculator },
    { path: '/products', label: 'Produk', icon: Box },
    { path: '/margin', label: 'Margin', icon: Percent },
    { path: '/approval', label: 'Approval', icon: CheckSquare },
    { path: '/history', label: 'Riwayat', icon: History },
    { path: '/settings', label: 'Settings', icon: Settings },
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
        </Routes>
      </main>

      <nav className="fixed bottom-0 w-full bg-surface border-t border-border flex justify-around p-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                "flex min-w-0 flex-1 flex-col items-center justify-center h-12 transition-colors",
                isActive ? "text-primary" : "text-textMuted hover:text-primary/70"
              )}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="max-w-full truncate text-[9px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default App;
