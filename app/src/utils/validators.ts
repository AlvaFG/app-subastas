/**
 * Validadores compartidos para el frontend.
 * Mantener las reglas alineadas con el backend.
 */

export const PASSWORD_MIN_LENGTH = 8;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida un email con un regex simple sobre el valor recortado.
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Valida una clave segun las reglas del backend.
 * Retorna null si es valida; si no, un mensaje describiendo el problema.
 * Reglas: largo >= PASSWORD_MIN_LENGTH, al menos una mayuscula, al menos un numero.
 */
export function validatePassword(clave: string): string | null {
  if (clave.length < PASSWORD_MIN_LENGTH) {
    return `La clave debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (!/[A-Z]/.test(clave)) {
    return 'La clave debe incluir al menos una letra mayuscula.';
  }
  if (!/[0-9]/.test(clave)) {
    return 'La clave debe incluir al menos un numero.';
  }
  return null;
}
