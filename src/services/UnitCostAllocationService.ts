import type { TaxCalculationResult } from './TaxCalculatorService';

export interface UnitCostAllocationResult {
  targetUnitQuantity: number;
  taxResult: TaxCalculationResult;
}

export class UnitCostAllocationService {
  static calculateTargetUnitQuantity(
    receivedQuantity: number,
    receivedUnitConversion: number,
    targetUnitConversion: number,
  ): number {
    if (!Number.isFinite(receivedQuantity) || receivedQuantity <= 0) {
      throw new Error('Jumlah barang datang harus lebih dari 0.');
    }
    if (!Number.isFinite(receivedUnitConversion) || receivedUnitConversion <= 0) {
      throw new Error('Konversi satuan datang tidak valid.');
    }
    if (!Number.isFinite(targetUnitConversion) || targetUnitConversion <= 0) {
      throw new Error('Konversi satuan jual tidak valid.');
    }

    return (receivedQuantity * receivedUnitConversion) / targetUnitConversion;
  }

  static allocateTaxResultToTargetUnit(
    taxResult: TaxCalculationResult,
    receivedQuantity: number,
    receivedUnitConversion: number,
    targetUnitConversion: number,
  ): UnitCostAllocationResult {
    const targetUnitQuantity = UnitCostAllocationService.calculateTargetUnitQuantity(
      receivedQuantity,
      receivedUnitConversion,
      targetUnitConversion,
    );

    return {
      targetUnitQuantity,
      taxResult: {
        inputCost: UnitCostAllocationService.toMoney(taxResult.inputCost / targetUnitQuantity),
        ppnMode: taxResult.ppnMode,
        ppnRate: taxResult.ppnRate,
        baseCost: UnitCostAllocationService.toMoney(taxResult.baseCost / targetUnitQuantity),
        ppnAmount: UnitCostAllocationService.toMoney(taxResult.ppnAmount / targetUnitQuantity),
        finalCost: UnitCostAllocationService.toMoney(taxResult.finalCost / targetUnitQuantity),
      },
    };
  }

  private static toMoney(value: number): number {
    return Math.round(value);
  }
}
