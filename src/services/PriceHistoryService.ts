import type { PriceCalculation, PriceHistory, Product, ProductUnit } from '../db/db';

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

  private static toDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
