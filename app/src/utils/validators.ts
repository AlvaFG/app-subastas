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

// ─── Sanitizadores de input (filtrado en vivo, en onChangeText) ───

/** Deja solo digitos. Para documento, telefono, etc. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Deja solo caracteres validos de un nombre: letras (incluye acentos y ñ),
 * espacios, guion y apostrofe. Filtra numeros y simbolos raros.
 */
export function onlyNameChars(value: string): string {
  return value.replace(/[^a-zA-ZÀ-ÿñÑ\s'-]/g, '');
}

// ─── Validadores de formato (al enviar) ───

export const DOCUMENTO_MIN_LENGTH = 6;
export const DOCUMENTO_MAX_LENGTH = 9;

/** Documento: solo numeros, entre 6 y 9 digitos (DNI). */
export function isValidDocumento(documento: string): boolean {
  return new RegExp(`^\\d{${DOCUMENTO_MIN_LENGTH},${DOCUMENTO_MAX_LENGTH}}$`).test(documento.trim());
}

/** Nombre/apellido: al menos 2 letras (ademas del filtro en vivo). */
export function isValidName(value: string): boolean {
  return /[a-zA-ZÀ-ÿñÑ]{2,}/.test(value.trim());
}
