import type { PriceCalculation, PriceHistory, Product, ProductUnit } from '../db/db';

interface ManualPriceChangeInput {
  productId: string;
  productUnitId: string;
  oldCost: number;
  newCost: number;
  oldPrice: number;
  newPrice: number;
  pricingMode?: Product['pricingMode'];
  changeReason: string;
  changedBy?: string;
  createdAt?: number;
}

export class PriceHistoryService {
  static buildFromApprovedCalculation(
    calculation: PriceCalculation,
    unit: ProductUnit,
    product: Product | undefined,
    previousHistory: PriceHistory | undefined,
    approvedBy: string,
    approvedAt: number,
  ): PriceHistory {
    return {
      id: crypto.randomUUID(),
      productId: calculation.productId,
      productUnitId: calculation.productUnitId,
      oldCost: unit.manualCost,
      newCost: calculation.finalCost,
      oldPrice: unit.activeSellingPrice,
      newPrice: calculation.roundedPrice,
      oldMargin: previousHistory?.newMargin ?? 0,
      newMargin: calculation.marginPercent,
      oldPpnMode: previousHistory?.newPpnMode ?? 'NO_PPN',
      newPpnMode: calculation.ppnMode,
      oldPpnAmount: previousHistory?.newPpnAmount ?? 0,
      newPpnAmount: calculation.ppnAmount,
      pricingMode: product?.pricingMode,
      changeReason: calculation.changeReason,
      effectiveDate: calculation.effectiveDate ?? PriceHistoryService.toDateInput(new Date(approvedAt)),
      changedBy: calculation.createdBy,
      approvedBy,
      approvedAt,
      createdAt: Date.now(),
    };
  }

  static getLatestHistory(histories: PriceHistory[]): PriceHistory | undefined {
    return [...histories].sort((a, b) => b.createdAt - a.createdAt)[0];
  }

  static buildFromManualPriceChange(input: ManualPriceChangeInput): PriceHistory {
    const createdAt = input.createdAt ?? Date.now();

    return {
      id: crypto.randomUUID(),
      productId: input.productId,
      productUnitId: input.productUnitId,
      oldCost: input.oldCost,
      newCost: input.newCost,
      oldPrice: input.oldPrice,
      newPrice: input.newPrice,
      oldMargin: PriceHistoryService.calculateMargin(input.oldPrice, input.oldCost),
      newMargin: PriceHistoryService.calculateMargin(input.newPrice, input.newCost),
      oldPpnMode: 'UNKNOWN',
      newPpnMode: 'NO_PPN',
      oldPpnAmount: 0,
      newPpnAmount: 0,
      pricingMode: input.pricingMode,
      changeReason: input.changeReason,
      effectiveDate: PriceHistoryService.toDateInput(new Date(createdAt)),
      changedBy: input.changedBy,
      approvedBy: input.changedBy,
      approvedAt: createdAt,
      createdAt,
    };
  }

  private static calculateMargin(price: number, cost: number): number {
    if (!Number.isFinite(price) || price <= 0) return 0;
    return Number((((price - cost) / price) * 100).toFixed(2));
  }

  private static toDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
