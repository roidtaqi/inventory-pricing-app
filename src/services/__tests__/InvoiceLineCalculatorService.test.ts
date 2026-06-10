import { describe, expect, it } from 'vitest';
import { InvoiceLineCalculatorService } from '../InvoiceLineCalculatorService';
import { PpnMode } from '../TaxCalculatorService';

describe('InvoiceLineCalculatorService', () => {
  it('calculates loose pieces from invoice carton price', () => {
    const result = InvoiceLineCalculatorService.calculate({
      cartonQuantity: 0,
      looseQuantity: 3,
      piecesPerCarton: 12,
      cartonCost: 244865,
      discountPercent: 2,
      ppnMode: PpnMode.NO_PPN,
      ppnRate: 11,
      sellingPrice: 26500,
    });

    expect(result.totalPieces).toBe(3);
    expect(result.cartonEquivalentQuantity).toBe(0.25);
    expect(result.discountedTotal).toBe(59992);
    expect(result.unitCost).toBe(19997);
    expect(result.profitPerUnit).toBe(6503);
    expect(result.actualMargin).toBeCloseTo((6503 / 26500) * 100);
  });

  it('calculates one full carton', () => {
    const result = InvoiceLineCalculatorService.calculate({
      cartonQuantity: 1,
      looseQuantity: 0,
      piecesPerCarton: 12,
      cartonCost: 134324,
      discountPercent: 2,
      ppnMode: PpnMode.NO_PPN,
      ppnRate: 11,
      sellingPrice: 14500,
    });

    expect(result.totalPieces).toBe(12);
    expect(result.discountedTotal).toBe(131638);
    expect(result.unitCost).toBe(10970);
    expect(result.profitPerUnit).toBe(3530);
  });

  it('can include PPN excluded from invoice line total', () => {
    const result = InvoiceLineCalculatorService.calculate({
      cartonQuantity: 1,
      looseQuantity: 0,
      piecesPerCarton: 12,
      cartonCost: 120000,
      discountPercent: 0,
      ppnMode: PpnMode.PPN_EXCLUDED,
      ppnRate: 11,
    });

    expect(result.taxResult.finalCost).toBe(133200);
    expect(result.unitCost).toBe(11100);
  });

  it('rejects empty quantities', () => {
    expect(() => InvoiceLineCalculatorService.calculate({
      cartonQuantity: 0,
      looseQuantity: 0,
      piecesPerCarton: 12,
      cartonCost: 120000,
      discountPercent: 0,
      ppnMode: PpnMode.NO_PPN,
      ppnRate: 11,
    })).toThrowError();
  });
});
