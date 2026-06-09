export class RoundingService {
  /**
   * Aturan pembulatan ke ribuan terdekat.
   * Jika sisa harga >= Rp500, round up ke ribuan berikutnya.
   * Jika sisa harga < Rp500, round down ke ribuan bawah.
   */
  static roundToNearestThousand(price: number): number {
    const remainder = price % 1000;
    const base = price - remainder;
    if (remainder >= 500) {
      return base + 1000;
    } else {
      return base;
    }
  }
}
