import { db, type PriceCalculation } from '../db/db';
import { PriceHistoryService } from './PriceHistoryService';

export class ApprovalService {
  static resolveApprovedStatus(effectiveDate: string | undefined, now: Date = new Date()): 'ACTIVE' | 'SCHEDULED' {
    if (!effectiveDate) {
      return 'ACTIVE';
    }

    return ApprovalService.startOfDay(effectiveDate) <= ApprovalService.startOfDay(now)
      ? 'ACTIVE'
      : 'SCHEDULED';
  }

  static canSubmitForApproval(calculation: Pick<PriceCalculation, 'effectiveDate' | 'recommendedPrice'>): string | null {
    if (!calculation.effectiveDate) {
      return 'Tanggal berlaku wajib diisi saat mengajukan approval.';
    }
    if (!calculation.recommendedPrice || calculation.recommendedPrice <= 0) {
      return 'Harga rekomendasi wajib dihitung sebelum approval.';
    }
    return null;
  }

  static async approveCalculation(
    calculationId: string,
    approvedBy = 'Owner Lokal',
    now: Date = new Date(),
  ): Promise<'ACTIVE' | 'SCHEDULED'> {
    const approvedAt = now.getTime();
    let resolvedStatus: 'ACTIVE' | 'SCHEDULED' = 'ACTIVE';

    await db.transaction('rw', db.priceCalculations, db.productUnits, db.priceHistories, db.products, async () => {
      const calculation = await db.priceCalculations.get(calculationId);
      if (!calculation) {
        throw new Error('Kalkulasi harga tidak ditemukan.');
      }
      if (calculation.status !== 'WAITING_APPROVAL') {
        throw new Error('Hanya kalkulasi WAITING_APPROVAL yang bisa disetujui.');
      }

      resolvedStatus = ApprovalService.resolveApprovedStatus(calculation.effectiveDate, now);

      if (resolvedStatus === 'SCHEDULED') {
        await db.priceCalculations.update(calculationId, {
          status: 'SCHEDULED',
          approvedBy,
          approvedAt,
          updatedAt: approvedAt,
        });
        return;
      }

      await ApprovalService.activateCalculation(calculation, approvedBy, approvedAt);
    });

    return resolvedStatus;
  }

  static async rejectCalculation(
    calculationId: string,
    rejectedBy = 'Owner Lokal',
    rejectionReason?: string,
  ): Promise<void> {
    const rejectedAt = Date.now();
    await db.priceCalculations.update(calculationId, {
      status: 'REJECTED',
      rejectedBy,
      rejectedAt,
      rejectionReason,
      updatedAt: rejectedAt,
    });
  }

  static async activateDueScheduledPrices(now: Date = new Date()): Promise<number> {
    const scheduled = await db.priceCalculations.where('status').equals('SCHEDULED').toArray();
    let activated = 0;

    for (const calculation of scheduled) {
      if (ApprovalService.resolveApprovedStatus(calculation.effectiveDate, now) !== 'ACTIVE') {
        continue;
      }

      await db.transaction('rw', db.priceCalculations, db.productUnits, db.priceHistories, db.products, async () => {
        const latest = await db.priceCalculations.get(calculation.id!);
        if (!latest || latest.status !== 'SCHEDULED') {
          return;
        }
        await ApprovalService.activateCalculation(
          latest,
          latest.approvedBy ?? 'Owner Lokal',
          latest.approvedAt ?? now.getTime(),
        );
        activated += 1;
      });
    }

    return activated;
  }

  private static async activateCalculation(
    calculation: PriceCalculation,
    approvedBy: string,
    approvedAt: number,
  ): Promise<void> {
    const unit = await db.productUnits.get(calculation.productUnitId);
    if (!unit) {
      throw new Error('Satuan produk tidak ditemukan.');
    }

    const product = await db.products.get(calculation.productId);
    const previousHistories = await db.priceHistories
      .where('productUnitId')
      .equals(calculation.productUnitId)
      .toArray();
    const previousHistory = PriceHistoryService.getLatestHistory(previousHistories);

    await db.priceHistories.add(
      PriceHistoryService.buildFromApprovedCalculation(
        calculation,
        unit,
        product,
        previousHistory,
        approvedBy,
        approvedAt,
      ),
    );

    await db.productUnits.update(calculation.productUnitId, {
      manualCost: calculation.finalCost,
      activeSellingPrice: calculation.roundedPrice,
    });

    await db.priceCalculations.update(calculation.id!, {
      status: 'ACTIVE',
      approvedBy,
      approvedAt,
      updatedAt: approvedAt,
    });
  }

  private static startOfDay(value: string | Date): number {
    if (value instanceof Date) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
    }

    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1).getTime();
  }
}
