import { canParticipateInAuction, resolveAuctionCategoryByPriceBase } from '../utils/category';

describe('auction category helpers', () => {
  it('should classify subastas by price base', () => {
    expect(resolveAuctionCategoryByPriceBase(1000)).toBe('comun');
    expect(resolveAuctionCategoryByPriceBase(10000)).toBe('especial');
    expect(resolveAuctionCategoryByPriceBase(30000)).toBe('plata');
    expect(resolveAuctionCategoryByPriceBase(75000)).toBe('oro');
    expect(resolveAuctionCategoryByPriceBase(150000)).toBe('platino');
  });

  it('should normalize USD to ARS before classifying', () => {
    expect(resolveAuctionCategoryByPriceBase(5, 'USD')).toBe('especial');
    expect(resolveAuctionCategoryByPriceBase(10, 'USD')).toBe('especial');
    expect(resolveAuctionCategoryByPriceBase(40, 'USD')).toBe('oro');
  });

  it('should allow same category and one level down only', () => {
    expect(canParticipateInAuction('plata', 'plata')).toBe(true);
    expect(canParticipateInAuction('plata', 'especial')).toBe(true);
    expect(canParticipateInAuction('plata', 'comun')).toBe(false);
    expect(canParticipateInAuction('oro', 'plata')).toBe(true);
    expect(canParticipateInAuction('oro', 'especial')).toBe(false);
    expect(canParticipateInAuction('comun', 'especial')).toBe(false);
  });
});