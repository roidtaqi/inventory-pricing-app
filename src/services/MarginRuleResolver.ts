export interface MarginRule {
  id: string;
  ruleType: 'STORE_DEFAULT' | 'CATEGORY' | 'BRAND' | 'SUPPLIER' | 'PRODUCT';
  referenceId?: string; // e.g. category_id, product_id
  marginPercent: number;
  priority: number;
  effectiveFrom?: string;
  effectiveUntil?: string;
  isActive: boolean;
}

export interface ProductContext {
  productId: string;
  categoryId?: string;
  brandId?: string;
  supplierId?: string;
  atDate?: string | Date;
}

export class MarginRuleResolver {
  /**
   * Priorities:
   * 1. Product
   * 2. Brand
   * 3. Supplier
   * 4. Category
   * 5. Default
   */
  static resolveMargin(rules: MarginRule[], context: ProductContext): MarginRule | null {
    const activeRules = rules.filter(r => r.isActive && MarginRuleResolver.isRuleEffective(r, context.atDate));
    
    // 1. Product
    const productRule = MarginRuleResolver.findBestRule(activeRules, r => r.ruleType === 'PRODUCT' && r.referenceId === context.productId);
    if (productRule) return productRule;
    
    // 2. Brand
    if (context.brandId) {
        const brandRule = MarginRuleResolver.findBestRule(activeRules, r => r.ruleType === 'BRAND' && r.referenceId === context.brandId);
        if (brandRule) return brandRule;
    }
    
    // 3. Supplier
    if (context.supplierId) {
        const suppRule = MarginRuleResolver.findBestRule(activeRules, r => r.ruleType === 'SUPPLIER' && r.referenceId === context.supplierId);
        if (suppRule) return suppRule;
    }
    
    // 4. Category
    if (context.categoryId) {
        const catRule = MarginRuleResolver.findBestRule(activeRules, r => r.ruleType === 'CATEGORY' && r.referenceId === context.categoryId);
        if (catRule) return catRule;
    }
    
    // 5. Default
    const defaultRule = MarginRuleResolver.findBestRule(activeRules, r => r.ruleType === 'STORE_DEFAULT');
    if (defaultRule) return defaultRule;
    
    return null;
  }

  private static findBestRule(rules: MarginRule[], predicate: (rule: MarginRule) => boolean): MarginRule | undefined {
    return rules
      .filter(predicate)
      .sort((a, b) => MarginRuleResolver.dateValue(b.effectiveFrom) - MarginRuleResolver.dateValue(a.effectiveFrom))[0];
  }

  private static isRuleEffective(rule: MarginRule, atDate?: string | Date): boolean {
    const current = MarginRuleResolver.startOfDay(atDate ?? new Date());
    if (rule.effectiveFrom && current < MarginRuleResolver.startOfDay(rule.effectiveFrom)) {
      return false;
    }
    if (rule.effectiveUntil && current > MarginRuleResolver.startOfDay(rule.effectiveUntil)) {
      return false;
    }
    return true;
  }

  private static dateValue(value?: string): number {
    return value ? MarginRuleResolver.startOfDay(value) : 0;
  }

  private static startOfDay(value: string | Date): number {
    if (value instanceof Date) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
    }
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1).getTime();
  }
}
