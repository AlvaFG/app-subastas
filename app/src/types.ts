/**
 * Tipos compartidos del frontend.
 */

export interface MedioPago {
  identificador: number;
  tipo: string;
  descripcion: string;
  moneda: string;
  internacional?: string;
  montoDisponible?: number | null;
  verificado?: string;
  activo?: string;
  banco?: string | null;
  numeroCuenta?: string | null;
  ultimosDigitos?: string | null;
  montoCheque?: number | null;
}
