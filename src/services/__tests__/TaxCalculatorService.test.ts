import { describe, it, expect } from 'vitest';
import { TaxCalculatorService, PpnMode } from '../TaxCalculatorService';

describe('TaxCalculatorService', () => {
  it('should calculate NO_PPN correctly', () => {
    const result = TaxCalculatorService.calculate(10000, PpnMode.NO_PPN, 11);
    expect(result.inputCost).toBe(10000);
    expect(result.baseCost).toBe(10000);
    expect(result.ppnAmount).toBe(0);
    expect(result.finalCost).toBe(10000);
  });

  it('should calculate PPN_EXCLUDED correctly', () => {
    const result = TaxCalculatorService.calculate(10000, PpnMode.PPN_EXCLUDED, 11);
    expect(result.inputCost).toBe(10000);
    expect(result.baseCost).toBe(10000);
    expect(result.ppnAmount).toBe(1100);
    expect(result.finalCost).toBe(11100);
  });

  it('should calculate PPN_INCLUDED correctly', () => {
    // 11.100 included 11% PPN -> base 10.000, ppn 1.100
    const result = TaxCalculatorService.calculate(11100, PpnMode.PPN_INCLUDED, 11);
    expect(result.inputCost).toBe(11100);
    expect(result.baseCost).toBe(10000);
    expect(result.ppnAmount).toBeCloseTo(1100);
    expect(result.finalCost).toBe(11100);
  });

  it('should reject negative PPN rate', () => {
    expect(() => TaxCalculatorService.calculate(10000, PpnMode.PPN_EXCLUDED, -1)).toThrowError();
  });
});
