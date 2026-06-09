import { RoundingService } from './RoundingService';

export interface PricingResult {
  finalCost: number;
  marginPercent: number;
  recommendedPrice: number;
  roundedPrice: number;
  estimatedProfit: number;
  actualMargin: number;
  priceWarning: PriceBoundsWarning;
}

export type PriceBoundsWarning = 'BELOW_MINIMUM' | 'ABOVE_MAXIMUM' | null;

export interface PriceBounds {
  minPrice?: number;
  maxPrice?: number;
}

export interface PricingModePolicy {
  canUseAutoMargin: boolean;
  requiresConfirmation: boolean;
  message: string;
}

export class PricingCalculatorService {
  /**
   * Harga Jual Rekomendasi = Modal Final / (1 - Margin)
   * Gunakan margin dari harga jual, bukan markup.
   */
  static calculatePrice(finalCost: number, marginPercent: number, bounds: PriceBounds = {}): PricingResult {
    if (!Number.isFinite(finalCost) || finalCost <= 0) {
      throw new Error('Modal final harus lebih dari 0.');
    }
    if (!Number.isFinite(marginPercent) || marginPercent <= 0 || marginPercent >= 100) {
        throw new Error('Margin harus lebih dari 0 dan kurang dari 100%.');
    }
    
    const marginFraction = marginPercent / 100;
    const recommendedPrice = finalCost / (1 - marginFraction);
    
    const roundedPrice = RoundingService.roundToNearestThousand(recommendedPrice);
    const estimatedProfit = roundedPrice - finalCost;
    let actualMargin = 0;
    if (roundedPrice > 0) {
        actualMargin = (estimatedProfit / roundedPrice) * 100;
    }

    return {
      finalCost,
      marginPercent,
      recommendedPrice,
      roundedPrice,
      estimatedProfit,
      actualMargin,
      priceWarning: PricingCalculatorService.evaluatePriceBounds(roundedPrice, bounds),
    };
  }

  static evaluatePriceBounds(price: number, bounds: PriceBounds = {}): PriceBoundsWarning {
    if (bounds.minPrice !== undefined && price < bounds.minPrice) {
      return 'BELOW_MINIMUM';
    }
    if (bounds.maxPrice !== undefined && price > bounds.maxPrice) {
      return 'ABOVE_MAXIMUM';
    }
    return null;
  }

  static getPricingModePolicy(pricingMode: 'AUTO_MARGIN' | 'MANUAL_PRICE' | 'LOCKED_PRICE'): PricingModePolicy {
    if (pricingMode === 'LOCKED_PRICE') {
      return {
        canUseAutoMargin: false,
        requiresConfirmation: true,
        message: 'Harga produk ini dikunci. Draft hanya bisa dibuat setelah konfirmasi khusus.',
      };
    }

    if (pricingMode === 'MANUAL_PRICE') {
      return {
        canUseAutoMargin: false,
        requiresConfirmation: false,
        message: 'Produk memakai harga manual. Rekomendasi ini hanya simulasi untuk bahan approval.',
      };
    }

    return {
      canUseAutoMargin: true,
      requiresConfirmation: false,
      message: 'Produk mengikuti margin otomatis.',
    };
  }
}
