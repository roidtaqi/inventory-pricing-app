import { describe, it, expect } from 'vitest';
import { PricingCalculatorService } from '../PricingCalculatorService';

describe('PricingCalculatorService', () => {
  it('should calculate price correctly based on margin from selling price', () => {
    // Modal 10.000, margin 20% -> Harga Jual = 10.000 / (1 - 0.20) = 12.500
    const result = PricingCalculatorService.calculatePrice(10000, 20);
    
    expect(result.finalCost).toBe(10000);
    expect(result.marginPercent).toBe(20);
    expect(result.recommendedPrice).toBe(12500);
    // 12.500 should round up to 13.000 based on rounding rule
    expect(result.roundedPrice).toBe(13000);
    expect(result.estimatedProfit).toBe(3000);
    expect(result.actualMargin).toBeCloseTo((3000 / 13000) * 100);
  });

  it('should throw error if margin is 100% or more', () => {
    expect(() => PricingCalculatorService.calculatePrice(10000, 100)).toThrowError();
  });

  it('should throw error if margin is zero or negative', () => {
    expect(() => PricingCalculatorService.calculatePrice(10000, 0)).toThrowError();
    expect(() => PricingCalculatorService.calculatePrice(10000, -1)).toThrowError();
  });

  it('should warn when rounded price is below minimum price', () => {
    const result = PricingCalculatorService.calculatePrice(10000, 20, { minPrice: 14000 });
    expect(result.roundedPrice).toBe(13000);
    expect(result.priceWarning).toBe('BELOW_MINIMUM');
  });

  it('should warn when rounded price is above maximum price', () => {
    const result = PricingCalculatorService.calculatePrice(10000, 20, { maxPrice: 12000 });
    expect(result.roundedPrice).toBe(13000);
    expect(result.priceWarning).toBe('ABOVE_MAXIMUM');
  });

  it('should flag manual pricing mode as simulation only', () => {
    const policy = PricingCalculatorService.getPricingModePolicy('MANUAL_PRICE');
    expect(policy.canUseAutoMargin).toBe(false);
    expect(policy.requiresConfirmation).toBe(false);
  });

  it('should require confirmation for locked pricing mode', () => {
    const policy = PricingCalculatorService.getPricingModePolicy('LOCKED_PRICE');
    expect(policy.canUseAutoMargin).toBe(false);
    expect(policy.requiresConfirmation).toBe(true);
  });
});
