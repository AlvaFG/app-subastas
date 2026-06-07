/**
 * Email delivery via SMTP (nodemailer).
 *
 * Configured through env (all optional — if SMTP isn't set the service degrades
 * gracefully instead of crashing the app):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * The transport is created lazily and cached, so importing this module is free
 * and tests that mock it never touch nodemailer.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { isSmtpConfigured } from '../config/env';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!isSmtpConfigured()) return null;
  if (!transporter) {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Best-effort send. Returns true if the mail was handed to the SMTP server.
 * Never throws to the caller: callers (e.g. forgot-password) must not leak
 * whether the address exists or whether delivery succeeded.
 */
export async function sendEmail({ to, subject, text, html }: MailOptions): Promise<boolean> {
  const tx = getTransporter();
  if (!tx) {
    // No SMTP configured: log so dev/demo still has a way to follow the flow.
    console.warn(`[email] SMTP no configurado; mail a ${to} NO enviado. Asunto: "${subject}"`);
    return false;
  }
  try {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    await tx.sendMail({ from, to, subject, text, html });
    return true;
  } catch (err) {
    console.error('[email] Error enviando mail:', err);
    return false;
  }
}

/** Admission email: tells an approved registrant to set their password (etapa 2). */
export async function sendAdmissionEmail(
  to: string,
  activationUrl: string,
  nombre?: string
): Promise<boolean> {
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,';
  const text =
    `${saludo}\n\n` +
    '¡Buenas noticias! La empresa reviso tus datos y tu cuenta en Subastas fue admitida.\n' +
    `Para completar el registro y crear tu clave, abri el siguiente enlace:\n\n${activationUrl}\n\n` +
    'Una vez creada tu clave vas a poder iniciar sesion y participar de las subastas.';
  const html =
    `<p>${saludo}</p>` +
    '<p>¡Buenas noticias! La empresa reviso tus datos y tu cuenta en <b>Subastas</b> fue admitida.</p>' +
    `<p><a href="${activationUrl}">Crear mi clave y completar el registro</a></p>` +
    '<p>Una vez creada tu clave vas a poder iniciar sesion y participar de las subastas.</p>';
  return sendEmail({ to, subject: 'Tu cuenta fue admitida — Subastas', text, html });
}

/** Password-recovery email with the one-time reset link. */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  nombre?: string
): Promise<boolean> {
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,';
  const text =
    `${saludo}\n\n` +
    'Recibimos un pedido para restablecer la clave de tu cuenta en Subastas.\n' +
    `Abri el siguiente enlace para crear una nueva clave (vence en 30 minutos):\n\n${resetUrl}\n\n` +
    'Si no pediste esto, podes ignorar este mensaje: tu clave no cambiara.';
  const html =
    `<p>${saludo}</p>` +
    '<p>Recibimos un pedido para restablecer la clave de tu cuenta en <b>Subastas</b>.</p>' +
    `<p><a href="${resetUrl}">Restablecer mi clave</a> (el enlace vence en 30 minutos).</p>` +
    '<p>Si no pediste esto, podes ignorar este mensaje: tu clave no cambiara.</p>';
  return sendEmail({ to, subject: 'Restablecer tu clave — Subastas', text, html });
}
