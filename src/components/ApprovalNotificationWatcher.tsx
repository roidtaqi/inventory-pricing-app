import { useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type PriceCalculation } from '../db/db';
import { NotificationService } from '../services/NotificationService';
import { SessionService } from '../services/SessionService';

const STORAGE_KEY = 'inventory-approval-notification-state-v1';
const APPROVED_STATUSES = new Set<PriceCalculation['status']>(['ACTIVE', 'APPROVED', 'SCHEDULED']);

type StoredApprovalState = Record<string, PriceCalculation['status']>;

function readStoredState(): StoredApprovalState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as StoredApprovalState : null;
  } catch {
    return null;
  }
}

function writeStoredState(state: StoredApprovalState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Notification memory is helpful, but it should never block the app.
  }
}

function buildState(calculations: PriceCalculation[]): StoredApprovalState {
  return calculations.reduce<StoredApprovalState>((acc, calculation) => {
    if (calculation.id) {
      acc[calculation.id] = calculation.status;
    }
    return acc;
  }, {});
}

export function ApprovalNotificationWatcher() {
  const appSettings = useLiveQuery(() => db.appSettings.toArray());
  const calculations = useLiveQuery(() => db.priceCalculations.toArray());
  const products = useLiveQuery(() => db.products.toArray());
  const units = useLiveQuery(() => db.productUnits.toArray());

  const session = useMemo(() => SessionService.fromSettings(appSettings), [appSettings]);
  const productById = useMemo(() => new Map((products ?? []).map(product => [product.id, product])), [products]);
  const unitById = useMemo(() => new Map((units ?? []).map(unit => [unit.id, unit])), [units]);

  useEffect(() => {
    if (!appSettings || !calculations || !products || !units) {
      return;
    }

    const previousState = readStoredState();
    const currentState = buildState(calculations);

    if (!previousState) {
      writeStoredState(currentState);
      return;
    }

    calculations.forEach(calculation => {
      if (!calculation.id) return;

      const previousStatus = previousState[calculation.id];
      const product = productById.get(calculation.productId);
      const unit = unitById.get(calculation.productUnitId);
      const productName = product?.name ?? 'Produk';
      const unitName = unit?.unitName;

      if (!previousStatus && calculation.status === 'WAITING_APPROVAL' && SessionService.canApprove(session.role)) {
        void NotificationService.notifyApprovalSubmitted({
          productName,
          unitName,
          actorName: calculation.createdBy,
        });
        return;
      }

      if (previousStatus === 'WAITING_APPROVAL' && APPROVED_STATUSES.has(calculation.status)) {
        void NotificationService.notifyApprovalApproved({
          productName,
          unitName,
          actorName: calculation.approvedBy,
          statusLabel: calculation.status === 'SCHEDULED' ? 'Terjadwal' : 'Aktif',
        });
        return;
      }

      if (previousStatus === 'WAITING_APPROVAL' && calculation.status === 'REJECTED') {
        void NotificationService.notifyApprovalRejected({
          productName,
          unitName,
          actorName: calculation.rejectedBy,
          reason: calculation.rejectionReason,
        });
      }
    });

    writeStoredState(currentState);
  }, [appSettings, calculations, products, units, productById, session.role, unitById]);

  return null;
}
