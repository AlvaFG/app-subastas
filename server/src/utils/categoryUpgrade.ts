import { CATEGORY_ORDER, getCategoryLevel } from './category';

// TPO §53: "La diversidad de los medios de pago del usuario y su actividad en las
// subastas permiten mejorar su categoria." Regla academica documentada:
//   score = (tipos distintos de medios verificados) + (subastas ganadas)
// La categoria solo MEJORA automaticamente; nunca baja.
export function suggestCategory(distinctVerifiedTipos: number, wins: number): typeof CATEGORY_ORDER[number] {
  const score = distinctVerifiedTipos + wins;
  if (score >= 5) return 'platino';
  if (score >= 4) return 'oro';
  if (score >= 3) return 'plata';
  if (score >= 1) return 'especial';
  return 'comun';
}

export function upgradedCategory(current: string, distinctVerifiedTipos: number, wins: number): string {
  const suggested = suggestCategory(distinctVerifiedTipos, wins);
  return getCategoryLevel(suggested) > getCategoryLevel(current) ? suggested : current;
}
