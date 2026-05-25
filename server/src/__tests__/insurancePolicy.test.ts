import {
  getNextInsurancePolicyByCurrentNroPoliza,
  resolveDepositByPriceBase,
  resolveInsurancePolicyByPriceBase,
} from '../utils/insurance';

describe('insurance policy mapping', () => {
  it('assigns the lowest policy and deposit for small base values', () => {
    const policy = resolveInsurancePolicyByPriceBase(3000, 'ARS');

    expect(policy.nroPoliza).toBe('POL-1000');
    expect(policy.depositoId).toBe(1);
    expect(resolveDepositByPriceBase(3000, 'ARS')).toBe(1);
  });

  it('assigns the middle policy for medium values', () => {
    const policy = resolveInsurancePolicyByPriceBase(12000, 'ARS');

    expect(policy.nroPoliza).toBe('POL-5000');
    expect(policy.depositoId).toBe(2);
  });

  it('upgrades to the next policy tier in order', () => {
    const nextPolicy = getNextInsurancePolicyByCurrentNroPoliza('POL-5000');

    expect(nextPolicy?.nroPoliza).toBe('POL-10000');
  });

  it('returns null when the policy is already at the top tier', () => {
    expect(getNextInsurancePolicyByCurrentNroPoliza('POL-20000')).toBeNull();
  });
});
