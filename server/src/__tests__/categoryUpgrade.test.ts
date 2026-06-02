import { suggestCategory, upgradedCategory } from '../utils/categoryUpgrade';

// TPO §53: la diversidad de medios verificados y la actividad mejoran la categoria.
describe('categoryUpgrade', () => {
  describe('suggestCategory (score = tipos verificados + victorias)', () => {
    it('comun cuando no hay actividad ni medios', () => {
      expect(suggestCategory(0, 0)).toBe('comun');
    });
    it('especial con score 1-2', () => {
      expect(suggestCategory(1, 0)).toBe('especial'); // score 1
      expect(suggestCategory(0, 2)).toBe('especial'); // score 2 (plata recien en >=3)
    });
    it('escala por umbrales', () => {
      expect(suggestCategory(1, 1)).toBe('especial'); // 2
      expect(suggestCategory(2, 1)).toBe('plata');    // 3
      expect(suggestCategory(2, 2)).toBe('oro');       // 4
      expect(suggestCategory(3, 2)).toBe('platino');   // 5
    });
  });

  describe('upgradedCategory (solo mejora, nunca baja)', () => {
    it('mejora si el sugerido es mayor', () => {
      expect(upgradedCategory('comun', 2, 1)).toBe('plata');
    });
    it('mantiene la categoria si el sugerido es menor o igual', () => {
      expect(upgradedCategory('oro', 0, 0)).toBe('oro');
      expect(upgradedCategory('platino', 1, 0)).toBe('platino');
    });
    it('no baja a un cliente ya elevado por la empresa', () => {
      expect(upgradedCategory('oro', 1, 1)).toBe('oro');
    });
  });
});
