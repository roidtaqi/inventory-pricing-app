import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { AppAlertContext, type AlertInput, type AlertItem, type AlertTone } from './AppAlertContext';

const toneConfig: Record<AlertTone, { title: string; iconClass: string; buttonClass: string; Icon: typeof Info }> = {
  success: {
    title: 'Berhasil',
    iconClass: 'bg-emerald-50 text-emerald-600',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-700',
    Icon: CheckCircle2,
  },
  error: {
    title: 'Terjadi Kendala',
    iconClass: 'bg-red-50 text-danger',
    buttonClass: 'bg-danger hover:bg-red-700',
    Icon: XCircle,
  },
  warning: {
    title: 'Periksa Input',
    iconClass: 'bg-amber-50 text-warning',
    buttonClass: 'bg-warning hover:bg-amber-600',
    Icon: AlertTriangle,
  },
  info: {
    title: 'Informasi',
    iconClass: 'bg-indigo-50 text-primary',
    buttonClass: 'bg-primary hover:bg-indigo-700',
    Icon: Info,
  },
};

export function AppAlertProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const activeAlert = alerts[0];

  const showAlert = useCallback((input: string | AlertInput) => {
    const normalizedInput = typeof input === 'string' ? { message: input } : input;
    const tone = normalizedInput.tone ?? 'info';
    setAlerts(currentAlerts => [
      ...currentAlerts,
      {
        id: Date.now() + currentAlerts.length,
        tone,
        title: normalizedInput.title ?? toneConfig[tone].title,
        message: normalizedInput.message,
      },
    ]);
  }, []);

  const closeAlert = () => {
    setAlerts(currentAlerts => currentAlerts.slice(1));
  };

  const value = useMemo(() => ({ showAlert }), [showAlert]);
  const config = activeAlert ? toneConfig[activeAlert.tone] : null;
  const Icon = config?.Icon;

  return (
    <AppAlertContext.Provider value={value}>
      {children}
      {activeAlert && config && Icon && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 px-4 py-6 sm:items-center">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="app-alert-title"
            aria-describedby="app-alert-message"
            className="w-full max-w-sm rounded-lg bg-surface p-4 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${config.iconClass}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="app-alert-title" className="text-base font-bold text-textMain">
                  {activeAlert.title}
                </h2>
                <p id="app-alert-message" className="mt-1 text-sm leading-6 text-textMuted">
                  {activeAlert.message}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={closeAlert}
              className={`mt-4 w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white transition-colors ${config.buttonClass}`}
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </AppAlertContext.Provider>
  );
}
