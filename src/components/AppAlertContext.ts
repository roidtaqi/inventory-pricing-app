import { createContext, useContext } from 'react';

export type AlertTone = 'success' | 'error' | 'warning' | 'info';

export type AlertInput = {
  title?: string;
  message: string;
  tone?: AlertTone;
};

export type AlertItem = Required<AlertInput> & {
  id: number;
};

export type AppAlertContextValue = {
  showAlert: (input: string | AlertInput) => void;
};

export const AppAlertContext = createContext<AppAlertContextValue | null>(null);

export function useAppAlert() {
  const context = useContext(AppAlertContext);
  if (!context) {
    throw new Error('useAppAlert must be used inside AppAlertProvider.');
  }
  return context;
}
