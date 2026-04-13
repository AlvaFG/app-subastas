export const CATEGORY_ORDER = ['comun', 'especial', 'plata', 'oro', 'platino'] as const;
export const USD_TO_ARS_RATE = 1400;

export type AuctionCategory = typeof CATEGORY_ORDER[number];

export function getCategoryLevel(category?: string | null): number {
  if (!category) return -1;
  return CATEGORY_ORDER.indexOf(category as AuctionCategory);
}

export function canParticipateInAuction(userCategory: string, auctionCategory: string): boolean {
  const userLevel = getCategoryLevel(userCategory);
  const auctionLevel = getCategoryLevel(auctionCategory);

  if (userLevel < 0 || auctionLevel < 0) return false;

  return auctionLevel <= userLevel && userLevel - auctionLevel <= 1;
}

export function normalizePriceBaseToArs(precioBase: number, moneda?: string | null): number {
  if (!Number.isFinite(precioBase) || precioBase <= 0) return 0;
  return moneda === 'USD' ? precioBase * USD_TO_ARS_RATE : precioBase;
}

export function resolveAuctionCategoryByPriceBase(precioBase: number, moneda?: string | null): AuctionCategory {
  const precioBaseArs = normalizePriceBaseToArs(precioBase, moneda);

  if (precioBaseArs <= 0) return 'comun';
  if (precioBaseArs <= 5000) return 'comun';
  if (precioBaseArs <= 20000) return 'especial';
  if (precioBaseArs <= 50000) return 'plata';
  if (precioBaseArs <= 100000) return 'oro';
  return 'platino';
}