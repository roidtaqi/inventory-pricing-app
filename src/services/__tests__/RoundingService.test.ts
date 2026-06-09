import { describe, it, expect } from 'vitest';
import { RoundingService } from '../RoundingService';

describe('RoundingService', () => {
  it('should round down if remainder < 500', () => {
    expect(RoundingService.roundToNearestThousand(12300)).toBe(12000);
    expect(RoundingService.roundToNearestThousand(12499)).toBe(12000);
  });

  it('should round up if remainder >= 500', () => {
    expect(RoundingService.roundToNearestThousand(12500)).toBe(13000);
    expect(RoundingService.roundToNearestThousand(12700)).toBe(13000);
    expect(RoundingService.roundToNearestThousand(13500)).toBe(14000);
  });
});
