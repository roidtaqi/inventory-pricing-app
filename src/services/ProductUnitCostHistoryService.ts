import type { ProductUnitCostHistory, ProductUnitCostSource } from '../db/db';

export interface BuildCostHistoryInput {
  productId: string;
  productUnitId: string;
  supplierId?: number;
  inputCost: number;
  ppnMode?: ProductUnitCostHistory['ppnMode'];
  ppnRate?: number;
  baseCost?: number;
  ppnAmount?: number;
  finalCost: number;
  previousFinalCost?: number;
  source: ProductUnitCostSource;
  effectiveDate?: string;
  referenceNumber?: string;
  notes?: string;
  createdBy?: string;
  importBatchId?: string;
  createdAt?: number;
}

export class ProductUnitCostHistoryService {
  static build(input: BuildCostHistoryInput): ProductUnitCostHistory {
    const now = input.createdAt ?? Date.now();

    return {
      id: crypto.randomUUID(),
      productId: input.productId,
      productUnitId: input.productUnitId,
      supplierId: input.supplierId,
      inputCost: Math.round(input.inputCost),
      ppnMode: input.ppnMode ?? 'NO_PPN',
      ppnRate: input.ppnRate ?? 0,
      baseCost: Math.round(input.baseCost ?? input.finalCost),
      ppnAmount: Math.round(input.ppnAmount ?? 0),
      finalCost: Math.round(input.finalCost),
      previousFinalCost: input.previousFinalCost === undefined ? undefined : Math.round(input.previousFinalCost),
      source: input.source,
      effectiveDate: input.effectiveDate ?? ProductUnitCostHistoryService.toDateInput(new Date(now)),
      referenceNumber: input.referenceNumber,
      notes: input.notes,
      createdBy: input.createdBy,
      importBatchId: input.importBatchId,
      createdAt: now,
    };
  }

  static toDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
