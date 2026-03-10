/**
 * Tests for bid validation logic extracted from auctionHandler.ts
 * The validation rules:
 *   - importe must be > currentBest
 *   - For non-high categories: minBid = currentBest + (precioBase * 0.01)
 *   - For non-high categories: maxBid = currentBest + (precioBase * 0.20)
 *   - oro/platino skip min/max limits (only need > currentBest)
 */

interface BidValidationResult {
  valid: boolean;
  error?: string;
}

function validateBid(
  importe: number,
  currentBest: number,
  precioBase: number,
  categoria: string,
): BidValidationResult {
  const isHighCategory = categoria === 'oro' || categoria === 'platino';

  if (importe <= currentBest) {
    return { valid: false, error: `La puja debe ser mayor a ${currentBest}` };
  }

  if (!isHighCategory) {
    const minBid = currentBest + precioBase * 0.01;
    const maxBid = currentBest + precioBase * 0.20;

    if (importe < minBid) {
      return { valid: false, error: `Puja minima: ${minBid.toFixed(2)} (ultima + 1% base)` };
    }
    if (importe > maxBid) {
      return { valid: false, error: `Puja maxima: ${maxBid.toFixed(2)} (ultima + 20% base)` };
    }
  }

  return { valid: true };
}

describe('Bid Validation', () => {
  const precioBase = 1000;
  const currentBest = 1000;

  it('should reject a bid equal to current best', () => {
    const result = validateBid(1000, currentBest, precioBase, 'comun');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('mayor a');
  });

  it('should reject a bid lower than current best', () => {
    const result = validateBid(900, currentBest, precioBase, 'comun');
    expect(result.valid).toBe(false);
  });

  it('should reject a bid below minimum (currentBest + 1% of base)', () => {
    // min = 1000 + 10 = 1010, bid of 1005 is too low
    const result = validateBid(1005, currentBest, precioBase, 'comun');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Puja minima');
  });

  it('should accept a bid exactly at minimum', () => {
    const minBid = currentBest + precioBase * 0.01; // 1010
    const result = validateBid(minBid, currentBest, precioBase, 'comun');
    expect(result.valid).toBe(true);
  });

  it('should accept a bid exactly at maximum', () => {
    const maxBid = currentBest + precioBase * 0.20; // 1200
    const result = validateBid(maxBid, currentBest, precioBase, 'comun');
    expect(result.valid).toBe(true);
  });

  it('should reject a bid above maximum (currentBest + 20% of base)', () => {
    // max = 1000 + 200 = 1200, bid of 1250 is too high
    const result = validateBid(1250, currentBest, precioBase, 'comun');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Puja maxima');
  });

  it('should accept a bid between min and max', () => {
    const result = validateBid(1100, currentBest, precioBase, 'comun');
    expect(result.valid).toBe(true);
  });

  it('should skip min/max limits for oro category', () => {
    // 5000 would normally exceed max of 1200, but oro skips limits
    const result = validateBid(5000, currentBest, precioBase, 'oro');
    expect(result.valid).toBe(true);
  });

  it('should skip min/max limits for platino category', () => {
    const result = validateBid(5000, currentBest, precioBase, 'platino');
    expect(result.valid).toBe(true);
  });

  it('should still require bid > currentBest for oro', () => {
    const result = validateBid(999, currentBest, precioBase, 'oro');
    expect(result.valid).toBe(false);
  });

  it('should enforce limits for especial category', () => {
    const result = validateBid(1250, currentBest, precioBase, 'especial');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Puja maxima');
  });

  it('should enforce limits for plata category', () => {
    const result = validateBid(1005, currentBest, precioBase, 'plata');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Puja minima');
  });
});
