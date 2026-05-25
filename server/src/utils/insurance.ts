import { normalizePriceBaseToArs } from './category';

export interface InsurancePolicyTier {
  nroPoliza: string;
  tipoPoliza: string;
  importe: number;
  valorBaseMin: number;
  valorBaseMax: number | null;
  depositoId: number;
}

export const INSURANCE_POLICY_TIERS: InsurancePolicyTier[] = [
  {
    nroPoliza: 'POL-1000',
    tipoPoliza: 'esencial',
    importe: 1000,
    valorBaseMin: 0.01,
    valorBaseMax: 5000,
    depositoId: 1,
  },
  {
    nroPoliza: 'POL-5000',
    tipoPoliza: 'estandar',
    importe: 5000,
    valorBaseMin: 5000.01,
    valorBaseMax: 20000,
    depositoId: 2,
  },
  {
    nroPoliza: 'POL-10000',
    tipoPoliza: 'extendida',
    importe: 10000,
    valorBaseMin: 20000.01,
    valorBaseMax: 50000,
    depositoId: 3,
  },
  {
    nroPoliza: 'POL-20000',
    tipoPoliza: 'premium',
    importe: 20000,
    valorBaseMin: 50000.01,
    valorBaseMax: null,
    depositoId: 3,
  },
];

export function resolveInsurancePolicyByPriceBase(precioBase: number, moneda?: string | null): InsurancePolicyTier {
  const precioBaseArs = normalizePriceBaseToArs(precioBase, moneda);
  const [tier1, tier2, tier3, tier4] = INSURANCE_POLICY_TIERS;

  if (!tier1 || !tier2 || !tier3 || !tier4) {
    throw new Error('Insurance policy tiers are not configured correctly');
  }

  if (precioBaseArs <= 5000) return tier1;
  if (precioBaseArs <= 20000) return tier2;
  if (precioBaseArs <= 50000) return tier3;
  return tier4;
}

export function resolveDepositByPriceBase(precioBase: number, moneda?: string | null): number {
  return resolveInsurancePolicyByPriceBase(precioBase, moneda).depositoId;
}

export function findInsurancePolicyIndex(nroPoliza?: string | null): number {
  if (!nroPoliza) return -1;
  return INSURANCE_POLICY_TIERS.findIndex((tier) => tier.nroPoliza === nroPoliza);
}

export function getNextInsurancePolicyByCurrentNroPoliza(nroPoliza?: string | null): InsurancePolicyTier | null {
  const currentIndex = findInsurancePolicyIndex(nroPoliza);
  if (currentIndex < 0 || currentIndex >= INSURANCE_POLICY_TIERS.length - 1) {
    return null;
  }

  return INSURANCE_POLICY_TIERS[currentIndex + 1] ?? null;
}

export function getInsurancePolicyUpgradeDifference(currentImporte: number, nextImporte: number): number {
  return Math.max(0, Number((nextImporte - currentImporte).toFixed(2)));
}
