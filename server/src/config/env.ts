/**
 * Environment validation and typed accessors (BSEC-06).
 *
 * Required secrets are validated once at startup (see index.ts) so a missing
 * value fails fast with a clear message instead of surfacing as a runtime 500
 * deep inside a request handler.
 */

const REQUIRED_VARS = [
  'DB_USER',
  'DB_PASSWORD',
  'DB_SERVER',
  'DB_NAME',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
] as const;

export function validateEnv(): void {
  const missing = REQUIRED_VARS.filter((key) => {
    const value = process.env[key];
    return value === undefined || value.trim() === '';
  });

  if (missing.length > 0) {
    throw new Error(
      `Faltan variables de entorno requeridas: ${missing.join(', ')}. ` +
        'Configure server/.env (ver .env.example) antes de iniciar el servidor.'
    );
  }
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET no configurado');
  return secret;
}

export function getJwtRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET no configurado');
  return secret;
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  );
}

/**
 * Public base URL of the web app, used to build the password-reset link.
 * Falls back to the first CORS origin, then to a localhost dev default.
 */
export function getWebUrl(): string {
  if (process.env.WEB_URL) return process.env.WEB_URL.replace(/\/$/, '');
  const firstOrigin = process.env.CORS_ORIGINS?.split(',')[0]?.trim();
  return (firstOrigin || 'http://localhost:8081').replace(/\/$/, '');
}
