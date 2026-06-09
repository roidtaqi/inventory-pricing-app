export const PpnMode = {
  NO_PPN: 'NO_PPN',
  PPN_INCLUDED: 'PPN_INCLUDED',
  PPN_EXCLUDED: 'PPN_EXCLUDED',
} as const;

export type PpnMode = typeof PpnMode[keyof typeof PpnMode];

export interface TaxCalculationResult {
  inputCost: number;
  ppnMode: PpnMode;
  ppnRate: number;
  baseCost: number;
  ppnAmount: number;
  finalCost: number;
}

export class TaxCalculatorService {
  static calculate(inputCost: number, ppnMode: PpnMode, ppnRate: number): TaxCalculationResult {
    if (!Number.isFinite(inputCost) || inputCost <= 0) {
      throw new Error('Harga modal harus lebih dari 0.');
    }
    if (!Number.isFinite(ppnRate) || ppnRate < 0) {
      throw new Error('Rate PPN tidak boleh negatif.');
    }

    let baseCost = 0;
    let ppnAmount = 0;
    let finalCost = 0;

    switch (ppnMode) {
      case PpnMode.NO_PPN:
        baseCost = inputCost;
        ppnAmount = 0;
        finalCost = inputCost;
        break;
      case PpnMode.PPN_EXCLUDED:
        baseCost = inputCost;
        ppnAmount = inputCost * (ppnRate / 100);
        finalCost = inputCost + ppnAmount;
        break;
      case PpnMode.PPN_INCLUDED:
        baseCost = inputCost / (1 + (ppnRate / 100));
        ppnAmount = inputCost - baseCost;
        finalCost = inputCost;
        break;
    }

    return {
      inputCost: TaxCalculatorService.toMoney(inputCost),
      ppnMode,
      ppnRate,
      baseCost: TaxCalculatorService.toMoney(baseCost),
      ppnAmount: TaxCalculatorService.toMoney(ppnAmount),
      finalCost: TaxCalculatorService.toMoney(finalCost)
    };
  }

  private static toMoney(value: number): number {
    return Math.round(value);
  }
}
