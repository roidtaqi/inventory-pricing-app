import { describe, expect, it } from 'vitest';
import { PpnMode, TaxCalculatorService } from '../TaxCalculatorService';
import { UnitCostAllocationService } from '../UnitCostAllocationService';

describe('UnitCostAllocationService', () => {
  it('allocates one carton cost to per-piece cost', () => {
    const totalTax = TaxCalculatorService.calculate(120000, PpnMode.NO_PPN, 11);
    const result = UnitCostAllocationService.allocateTaxResultToTargetUnit(totalTax, 1, 12, 1);

    expect(result.targetUnitQuantity).toBe(12);
    expect(result.taxResult.finalCost).toBe(10000);
    expect(result.taxResult.inputCost).toBe(10000);
  });

  it('allocates partial received pieces to per-piece cost', () => {
    const totalTax = TaxCalculatorService.calculate(30000, PpnMode.NO_PPN, 11);
    const result = UnitCostAllocationService.allocateTaxResultToTargetUnit(totalTax, 3, 1, 1);

    expect(result.targetUnitQuantity).toBe(3);
    expect(result.taxResult.finalCost).toBe(10000);
  });

  it('allocates PPN excluded total cost after tax', () => {
    const totalTax = TaxCalculatorService.calculate(120000, PpnMode.PPN_EXCLUDED, 11);
    const result = UnitCostAllocationService.allocateTaxResultToTargetUnit(totalTax, 1, 12, 1);

    expect(result.targetUnitQuantity).toBe(12);
    expect(result.taxResult.baseCost).toBe(10000);
    expect(result.taxResult.ppnAmount).toBe(1100);
    expect(result.taxResult.finalCost).toBe(11100);
  });

  it('rejects invalid received quantity', () => {
    const totalTax = TaxCalculatorService.calculate(120000, PpnMode.NO_PPN, 11);

    expect(() => UnitCostAllocationService.allocateTaxResultToTargetUnit(totalTax, 0, 12, 1)).toThrowError();
  });
});
