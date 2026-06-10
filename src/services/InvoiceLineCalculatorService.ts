import { TaxCalculatorService, type PpnMode, type TaxCalculationResult } from './TaxCalculatorService';

export interface InvoiceLineInput {
  cartonQuantity: number;
  looseQuantity: number;
  piecesPerCarton: number;
  cartonCost: number;
  discountPercent: number;
  ppnMode: PpnMode;
  ppnRate: number;
  sellingPrice?: number;
}

export interface InvoiceLineResult {
  cartonEquivalentQuantity: number;
  totalPieces: number;
  grossTotal: number;
  discountAmount: number;
  discountedTotal: number;
  taxResult: TaxCalculationResult;
  unitCost: number;
  sellingPrice?: number;
  profitPerUnit?: number;
  actualMargin?: number;
  totalSellingPrice?: number;
  totalProfit?: number;
}

export class InvoiceLineCalculatorService {
  static calculate(input: InvoiceLineInput): InvoiceLineResult {
    if (!Number.isFinite(input.cartonCost) || input.cartonCost <= 0) {
      throw new Error('Harga karton harus lebih dari 0.');
    }
    if (!Number.isFinite(input.piecesPerCarton) || input.piecesPerCarton <= 0) {
      throw new Error('Isi per karton harus lebih dari 0.');
    }
    if (!Number.isFinite(input.cartonQuantity) || input.cartonQuantity < 0) {
      throw new Error('Jumlah karton tidak boleh negatif.');
    }
    if (!Number.isFinite(input.looseQuantity) || input.looseQuantity < 0) {
      throw new Error('Jumlah pcs tidak boleh negatif.');
    }
    if (!Number.isFinite(input.discountPercent) || input.discountPercent < 0 || input.discountPercent >= 100) {
      throw new Error('Diskon harus di antara 0 dan kurang dari 100%.');
    }

    const totalPieces = input.cartonQuantity * input.piecesPerCarton + input.looseQuantity;
    if (totalPieces <= 0) {
      throw new Error('Isi jumlah karton atau pcs terlebih dahulu.');
    }

    const cartonEquivalentQuantity = totalPieces / input.piecesPerCarton;
    const grossTotal = cartonEquivalentQuantity * input.cartonCost;
    const discountAmount = grossTotal * (input.discountPercent / 100);
    const discountedTotal = grossTotal - discountAmount;
    const taxResult = TaxCalculatorService.calculate(discountedTotal, input.ppnMode, input.ppnRate);
    const unitCost = InvoiceLineCalculatorService.toMoney(taxResult.finalCost / totalPieces);

    const sellingPrice = input.sellingPrice && input.sellingPrice > 0
      ? input.sellingPrice
      : undefined;
    const profitPerUnit = sellingPrice === undefined ? undefined : sellingPrice - unitCost;
    const actualMargin = sellingPrice === undefined || sellingPrice <= 0 || profitPerUnit === undefined
      ? undefined
      : (profitPerUnit / sellingPrice) * 100;

    return {
      cartonEquivalentQuantity,
      totalPieces,
      grossTotal: InvoiceLineCalculatorService.toMoney(grossTotal),
      discountAmount: InvoiceLineCalculatorService.toMoney(discountAmount),
      discountedTotal: InvoiceLineCalculatorService.toMoney(discountedTotal),
      taxResult,
      unitCost,
      sellingPrice,
      profitPerUnit,
      actualMargin,
      totalSellingPrice: sellingPrice === undefined ? undefined : InvoiceLineCalculatorService.toMoney(sellingPrice * totalPieces),
      totalProfit: profitPerUnit === undefined ? undefined : InvoiceLineCalculatorService.toMoney(profitPerUnit * totalPieces),
    };
  }

  private static toMoney(value: number): number {
    return Math.round(value);
  }
}
