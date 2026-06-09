import { describe, it, expect } from 'vitest';
import { MarginRuleResolver } from '../MarginRuleResolver';
import type { MarginRule } from '../MarginRuleResolver';

describe('MarginRuleResolver', () => {
  const rules: MarginRule[] = [
    { id: '1', ruleType: 'STORE_DEFAULT', marginPercent: 10, priority: 5, isActive: true },
    { id: '2', ruleType: 'CATEGORY', referenceId: 'cat1', marginPercent: 15, priority: 4, isActive: true },
    { id: '3', ruleType: 'CATEGORY', referenceId: 'cat2', marginPercent: 20, priority: 4, isActive: false },
    { id: '4', ruleType: 'BRAND', referenceId: 'brand1', marginPercent: 25, priority: 3, isActive: true },
    { id: '5', ruleType: 'SUPPLIER', referenceId: 'sup1', marginPercent: 30, priority: 2, isActive: true },
    { id: '6', ruleType: 'PRODUCT', referenceId: 'prod1', marginPercent: 35, priority: 1, isActive: true },
  ];

  it('should resolve product margin over anything else', () => {
    const result = MarginRuleResolver.resolveMargin(rules, {
      productId: 'prod1',
      brandId: 'brand1',
      supplierId: 'sup1',
      categoryId: 'cat1'
    });
    expect(result?.marginPercent).toBe(35);
  });

  it('should resolve brand margin if no product margin', () => {
    const result = MarginRuleResolver.resolveMargin(rules, {
      productId: 'prod_other',
      brandId: 'brand1',
      categoryId: 'cat1'
    });
    expect(result?.marginPercent).toBe(25);
  });

  it('should resolve supplier margin if no product or brand margin', () => {
    const result = MarginRuleResolver.resolveMargin(rules, {
      productId: 'prod_other',
      supplierId: 'sup1',
      categoryId: 'cat1'
    });
    expect(result?.marginPercent).toBe(30);
  });

  it('should resolve category margin if no product brand or supplier margin', () => {
    const result = MarginRuleResolver.resolveMargin(rules, {
      productId: 'prod_other',
      categoryId: 'cat1'
    });
    expect(result?.marginPercent).toBe(15);
  });

  it('should fallback to store default if no matching context', () => {
    const result = MarginRuleResolver.resolveMargin(rules, {
      productId: 'prod_unknown'
    });
    expect(result?.marginPercent).toBe(10);
  });

  it('should ignore inactive rules', () => {
    const result = MarginRuleResolver.resolveMargin(rules, {
      productId: 'prod_unknown',
      categoryId: 'cat2' // inactive
    });
    // Fallback to store default because cat2 is inactive
    expect(result?.marginPercent).toBe(10);
  });

  it('should ignore rules outside their effective date', () => {
    const result = MarginRuleResolver.resolveMargin([
      ...rules,
      {
        id: '7',
        ruleType: 'PRODUCT',
        referenceId: 'prod_future',
        marginPercent: 45,
        priority: 1,
        effectiveFrom: '2026-02-01',
        effectiveUntil: '2026-02-28',
        isActive: true
      }
    ], {
      productId: 'prod_future',
      atDate: '2026-03-01'
    });

    expect(result?.marginPercent).toBe(10);
  });
});
