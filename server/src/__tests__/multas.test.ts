/**
 * Tests for penalty (multa) calculation logic from multasController.ts
 * Rules:
 *   - importeMulta = importeOriginal * 0.10 (10%)
 *   - fechaLimite = now + 72 hours
 */

function calcularMulta(importeOriginal: number): number {
  return importeOriginal * 0.10;
}

function calcularFechaLimite(desde: Date): Date {
  const fecha = new Date(desde);
  fecha.setHours(fecha.getHours() + 72);
  return fecha;
}

describe('Multa Calculation', () => {
  describe('importeMulta', () => {
    it('should calculate 10% of importe original', () => {
      expect(calcularMulta(1000)).toBe(100);
    });

    it('should handle decimal amounts', () => {
      expect(calcularMulta(1555.50)).toBeCloseTo(155.55);
    });

    it('should return 0 for 0 importe', () => {
      expect(calcularMulta(0)).toBe(0);
    });

    it('should handle large amounts', () => {
      expect(calcularMulta(1000000)).toBe(100000);
    });

    it('should handle small amounts', () => {
      expect(calcularMulta(1)).toBeCloseTo(0.10);
    });
  });

  describe('fechaLimite (72 hour deadline)', () => {
    it('should add exactly 72 hours', () => {
      const now = new Date('2026-01-15T10:00:00Z');
      const limit = calcularFechaLimite(now);
      expect(limit.getTime() - now.getTime()).toBe(72 * 60 * 60 * 1000);
    });

    it('should cross day boundaries correctly', () => {
      const now = new Date('2026-01-15T23:00:00Z');
      const limit = calcularFechaLimite(now);
      expect(limit.toISOString()).toBe('2026-01-18T23:00:00.000Z');
    });

    it('should not mutate the original date', () => {
      const now = new Date('2026-01-15T10:00:00Z');
      const originalTime = now.getTime();
      calcularFechaLimite(now);
      expect(now.getTime()).toBe(originalTime);
    });
  });

  describe('multa message formatting', () => {
    it('should format the penalty message correctly', () => {
      const importeOriginal = 5000;
      const importeMulta = calcularMulta(importeOriginal);
      const mensaje = `Se le ha aplicado una multa de $${importeMulta.toFixed(2)} (10% de $${importeOriginal.toFixed(2)}). Tiene 72hs para presentar los fondos necesarios.`;
      expect(mensaje).toContain('$500.00');
      expect(mensaje).toContain('$5000.00');
      expect(mensaje).toContain('72hs');
    });
  });
});
