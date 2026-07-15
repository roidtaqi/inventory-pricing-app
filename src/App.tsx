import { Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Calculator, CheckSquare, History, Home, Package } from 'lucide-react';
import clsx from 'clsx';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { seedDatabase } from './db/seed';
import { db } from './db/db';

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
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
import { ApprovalNotificationWatcher } from './components/ApprovalNotificationWatcher';
import { authService, type InventorySessionUser } from './services/AuthService';

function ProtectedRoute({ user, children }: { user: InventorySessionUser | null; children: ReactNode }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function useSimpleBackBehavior(homePath = '/') {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPathRef = useRef(location.pathname);
  const skipDuplicateHomeRef = useRef(false);

  useEffect(() => {
    currentPathRef.current = location.pathname;
    if (location.pathname !== homePath) {
      skipDuplicateHomeRef.current = false;
    }
  }, [homePath, location.pathname]);

  useEffect(() => {
    const isHomePath = (path: string) => path === homePath;
    const shouldIgnorePath = (path: string) => path === '/login';

    const handlePopState = () => {
      window.setTimeout(() => {
        const path = window.location.pathname;
        if (shouldIgnorePath(path)) return;

        if (!isHomePath(path)) {
          skipDuplicateHomeRef.current = true;
          navigate(homePath, { replace: true });
          return;
        }

        if (skipDuplicateHomeRef.current) {
          skipDuplicateHomeRef.current = false;
          window.setTimeout(() => window.history.back(), 0);
        }
      }, 0);
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as Element | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (shouldIgnorePath(url.pathname)) return;

      const targetPath = `${url.pathname}${url.search}${url.hash}`;
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (targetPath === currentPath) return;

      event.preventDefault();
      const shouldReplace = !isHomePath(currentPathRef.current) && !isHomePath(url.pathname);
      navigate(targetPath, { replace: shouldReplace });
    };

    window.addEventListener('popstate', handlePopState);
    document.addEventListener('click', handleDocumentClick, true);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [homePath, navigate]);
}

function App() {
  const location = useLocation();
  const [isReady, setIsReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<InventorySessionUser | null>(() => authService.getCurrentUser());

  useSimpleBackBehavior('/');

  useEffect(() => {
    seedDatabase()
      .then(async () => {
        await realtimeSyncService.autoStart();
        await realtimeSyncService.pullPosAuthSnapshot().catch(error => {
          console.warn('POS auth sync skipped', error);
        });
        await authService.refreshCurrentUser();
        const refreshedUser = authService.getCurrentUser();
        setCurrentUser(refreshedUser);
        setIsReady(true);
        if (refreshedUser && !authService.canApprove(refreshedUser)) {
          void db.priceCalculations
            .where('status')
            .equals('WAITING_APPROVAL')
            .count()
            .then((pendingCount) => {
              if (pendingCount > 0) {
                window.dispatchEvent(new CustomEvent('inventory-catalog-changed', {
                  detail: { entity: 'price_calculation', action: 'recover_pending_approval_sync' }
                }));
              }
            });
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const updateUser = () => setCurrentUser(authService.getCurrentUser());
    window.addEventListener('inventory-auth-changed', updateUser);
    window.addEventListener('storage', updateUser);
    return () => {
      window.removeEventListener('inventory-auth-changed', updateUser);
      window.removeEventListener('storage', updateUser);
    };
  }, []);

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/products', label: 'Produk', icon: Package },
    { path: '/calculator', label: 'Hitung', icon: Calculator },
    { path: '/approval', label: 'Approval', icon: CheckSquare },
    { path: '/history', label: 'Riwayat', icon: History },
  ];

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center text-sm font-medium text-textMuted">
        Menyiapkan aplikasi...
      </div>
    );
  }

  const isLoginPage = location.pathname === '/login';

  return (
    <div className="flex flex-col h-screen bg-background text-textMain">
      {currentUser && <ApprovalNotificationWatcher />}
      <main className={clsx('flex-1 overflow-y-auto', currentUser && !isLoginPage ? 'pb-20' : '')}>
        <Routes>
          <Route path="/login" element={currentUser ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route path="/" element={<ProtectedRoute user={currentUser}><HomePage /></ProtectedRoute>} />
          <Route path="/calculator" element={<ProtectedRoute user={currentUser}><CalculatorPage /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute user={currentUser}><ProductsPage /></ProtectedRoute>} />
          <Route path="/products/new" element={<ProtectedRoute user={currentUser}><ProductFormPage /></ProtectedRoute>} />
          <Route path="/products/:id" element={<ProtectedRoute user={currentUser}><ProductFormPage /></ProtectedRoute>} />
          <Route path="/margin" element={<ProtectedRoute user={currentUser}><MarginPage /></ProtectedRoute>} />
          <Route path="/margin/new" element={<ProtectedRoute user={currentUser}><MarginRuleFormPage /></ProtectedRoute>} />
          <Route path="/margin/:id" element={<ProtectedRoute user={currentUser}><MarginRuleFormPage /></ProtectedRoute>} />
          <Route path="/approval" element={<ProtectedRoute user={currentUser}><ApprovalPage /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute user={currentUser}><HistoryPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute user={currentUser}><SettingsPage /></ProtectedRoute>} />
          <Route path="/master-data" element={<ProtectedRoute user={currentUser}><MasterDataPage /></ProtectedRoute>} />
          <Route path="/more" element={<ProtectedRoute user={currentUser}><MorePage /></ProtectedRoute>} />
          <Route path="/import-csv" element={<ProtectedRoute user={currentUser}><ImportCsvPage /></ProtectedRoute>} />
          <Route path="/realtime-sync" element={<ProtectedRoute user={currentUser}><RealtimeSyncPage /></ProtectedRoute>} />
        </Routes>
      </main>

      {currentUser && !isLoginPage && <nav className="fixed bottom-0 z-50 flex w-full items-center justify-around border-t border-border bg-surface px-2 py-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.path === '/'
            ? location.pathname === '/'
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
      </nav>}
    </div>
  );
}

export default App;
