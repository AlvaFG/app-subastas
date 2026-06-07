import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import sql from 'mssql';
import { connectDB } from '../models/db';
import { AuthRequest } from '../middleware/auth';
import { getJwtSecret, getJwtRefreshSecret, getWebUrl } from '../config/env';
import { uploadImage, toBuffer } from '../services/cloudinary';
import { sendPasswordResetEmail } from '../services/email';

const ACCESS_TTL = '1h';
const REFRESH_TTL = '7d';
const REFRESH_TTL_DAYS = 7;

// Brute-force protection (BSEC-05): lock an account after repeated failures.
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

interface TokenPayload {
  id: number;
  email: string;
  categoria: string;
  admitido: string;
}

interface AdminTokenPayload {
  id: number;
  email: string;
  rol: string;
}

function signTokens(payload: TokenPayload): { accessToken: string; refreshToken: string } {
  const accessToken = jwt.sign(payload, getJwtSecret(), { expiresIn: ACCESS_TTL });
  const refreshToken = jwt.sign(payload, getJwtRefreshSecret(), { expiresIn: REFRESH_TTL });
  return { accessToken, refreshToken };
}

/** Persist the registrant's ID document photos (REQ-02 / BSEC-03). */
async function saveDocumentPhotos(
  pool: sql.ConnectionPool,
  cliente: number,
  fotoFrente?: string,
  fotoDorso?: string
): Promise<void> {
  if (!fotoFrente || !fotoDorso) return;

  // Prefer Cloudinary; fall back to raw bytes so the photos are never dropped.
  const urlFrente = await uploadImage(fotoFrente, 'documentos').catch(() => null);
  const urlDorso = await uploadImage(fotoDorso, 'documentos').catch(() => null);

  const request = pool.request().input('cliente', cliente);
  if (urlFrente && urlDorso) {
    request.input('urlFrente', urlFrente).input('urlDorso', urlDorso);
    await request.query(`
      INSERT INTO documentosCliente (cliente, urlFrente, urlDorso)
      VALUES (@cliente, @urlFrente, @urlDorso)
    `);
  } else {
    request
      .input('fotoFrente', sql.VarBinary(sql.MAX), toBuffer(fotoFrente))
      .input('fotoDorso', sql.VarBinary(sql.MAX), toBuffer(fotoDorso));
    await request.query(`
      INSERT INTO documentosCliente (cliente, fotoFrente, fotoDorso)
      VALUES (@cliente, @fotoFrente, @fotoDorso)
    `);
  }
}

// T202: POST /auth/register/step1
export async function registerStep1(req: Request, res: Response): Promise<void> {
  try {
    const { documento, nombre, apellido, direccion, numeroPais, email, fotoFrente, fotoDorso } = req.body;

    const pool = await connectDB();

    // Verificar si ya existe
    const existing = await pool.request()
      .input('documento', documento)
      .query('SELECT identificador FROM personas WHERE documento = @documento');

    if (existing.recordset.length > 0) {
      res.status(400).json({ success: false, error: 'El documento ya esta registrado' });
      return;
    }

    // El email se pide en etapa 1 para poder avisarle por mail cuando sea admitido
    // (TPO: "se le envia un mail informandole que debe completar el registro").
    // Debe ser unico: el login identifica al cliente por email.
    const emailEnUso = await pool.request()
      .input('email', email)
      .query('SELECT identificador FROM clientes WHERE email = @email');
    if (emailEnUso.recordset.length > 0) {
      res.status(400).json({ success: false, error: 'El email ya esta registrado' });
      return;
    }

    // verificador: use a real, existing empleado instead of a hardcoded id (BSEC-02).
    // A5: el cliente queda PENDIENTE de admision (admitido='no'). La empresa lo
    // admite y le asigna categoria via PATCH /api/admin/clientes/:id/admitir.
    // Hasta entonces, register/step2 devuelve 403 (no puede crear su clave).
    const verificadorResult = await pool.request()
      .query('SELECT TOP 1 identificador FROM empleados ORDER BY identificador');
    if (verificadorResult.recordset.length === 0) {
      res.status(500).json({
        success: false,
        error: 'No hay empleados configurados para verificar el registro',
      });
      return;
    }
    const verificadorId = verificadorResult.recordset[0].identificador;

    // Insertar persona con nombre y apellido por separado (A4-W2).
    const personaResult = await pool.request()
      .input('documento', documento)
      .input('nombre', nombre)
      .input('apellido', apellido || null)
      .input('direccion', direccion)
      .input('estado', 'activo')
      .query(`
        INSERT INTO personas (documento, nombre, apellido, direccion, estado)
        OUTPUT INSERTED.identificador
        VALUES (@documento, @nombre, @apellido, @direccion, @estado)
      `);

    const personaId = personaResult.recordset[0].identificador;

    // Verificar que el numeroPais exista en la tabla `paises` para evitar violacion FK.
    let numeroPaisToInsert: number | null = null;
    if (numeroPais !== undefined && numeroPais !== null) {
      const parsed = parseInt(String(numeroPais), 10);
      if (!Number.isNaN(parsed)) {
        const paisCheck = await pool.request()
          .input('numeroPais', parsed)
          .query('SELECT numero FROM paises WHERE numero = @numeroPais');
        if (paisCheck.recordset.length > 0) {
          numeroPaisToInsert = parsed;
        } else {
          console.warn(`Pais con numero ${parsed} no encontrado en tabla paises; se insertara NULL en clientes.numeroPais.`);
        }
      }
    }

    // A5: el cliente arranca PENDIENTE (admitido='no'). La empresa lo admite y le
    // asigna categoria tras la investigacion externa. La categoria 'comun' es el
    // valor por defecto del schema hasta que un empleado la confirme/eleve.
    const insertReq = pool.request()
      .input('identificador', personaId)
      .input('admitido', 'no')
      .input('categoria', 'comun')
      .input('verificador', verificadorId)
      .input('email', email);

    if (numeroPaisToInsert !== null) {
      insertReq.input('numeroPais', sql.Int, numeroPaisToInsert);
    } else {
      insertReq.input('numeroPais', sql.Int, null);
    }

    await insertReq.query(`
      INSERT INTO clientes (identificador, numeroPais, admitido, categoria, verificador, email)
      VALUES (@identificador, @numeroPais, @admitido, @categoria, @verificador, @email)
    `);

    // Persistir las fotos del documento (REQ-02). No bloquea el registro si falla.
    try {
      await saveDocumentPhotos(pool, personaId, fotoFrente, fotoDorso);
    } catch (photoError) {
      console.error('Error guardando fotos de documento:', photoError);
    }

    res.status(201).json({
      success: true,
      data: {
        identificador: personaId,
        autoAprobado: false,
        admitido: 'no',
        mensaje: 'Registro etapa 1 recibido. La empresa revisara sus datos; cuando sea admitido podra completar la etapa 2 y crear su clave.',
      },
    });
  } catch (error) {
    console.error('Error en registerStep1:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// T204: POST /auth/register/step2
export async function registerStep2(req: Request, res: Response): Promise<void> {
  try {
    const { token, clave } = req.body;

    const pool = await connectDB();

    // El token de activacion viaja en el mail de admision. Validamos su hash, que
    // no haya vencido, que el cliente este admitido y que aun no tenga clave.
    const tokenHash = sha256(token);
    const cliente = await pool.request()
      .input('hash', tokenHash)
      .query(`
        SELECT identificador, categoria
        FROM clientes
        WHERE activacionTokenHash = @hash
          AND activacionTokenExpira > GETDATE()
          AND admitido = 'si'
          AND claveHash IS NULL
      `);

    if (cliente.recordset.length === 0) {
      res.status(400).json({ success: false, error: 'Token de activacion invalido o expirado' });
      return;
    }

    const clienteId = cliente.recordset[0].identificador;

    // Hashear clave y guardar. La categoria NO se toca aqui: queda la asignada al
    // admitir (BSEC-01/REQ-01: nunca se asigna al azar). El email ya se cargo en
    // la etapa 1. Invalidamos el token de activacion (un solo uso).
    const claveHash = await bcrypt.hash(clave, 10);

    await pool.request()
      .input('id', clienteId)
      .input('claveHash', claveHash)
      .query(`
        UPDATE clientes
        SET claveHash = @claveHash,
            activacionTokenHash = NULL,
            activacionTokenExpira = NULL
        WHERE identificador = @id
      `);

    res.json({
      success: true,
      data: {
        mensaje: 'Registro completado. Ya puede iniciar sesion.',
        categoria: cliente.recordset[0].categoria,
      },
    });
  } catch (error) {
    console.error('Error en registerStep2:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// T205: POST /auth/login
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, clave } = req.body;

    const pool = await connectDB();

    const result = await pool.request()
      .input('email', email)
      .query(`
        SELECT c.identificador, c.email, c.claveHash, c.categoria, c.admitido,
               c.failedAttempts, c.lockUntil,
               p.nombre, p.estado
        FROM clientes c
        INNER JOIN personas p ON p.identificador = c.identificador
        WHERE c.email = @email
      `);

    if (result.recordset.length === 0) {
      res.status(401).json({ success: false, error: 'Credenciales invalidas' });
      return;
    }

    const user = result.recordset[0];

    if (user.estado === 'inactivo') {
      res.status(403).json({ success: false, error: 'Cuenta bloqueada' });
      return;
    }

    // Bloqueo temporal por intentos fallidos (BSEC-05)
    if (user.lockUntil && new Date(user.lockUntil) > new Date()) {
      res.status(403).json({
        success: false,
        error: 'Cuenta bloqueada temporalmente por intentos fallidos. Intente mas tarde.',
      });
      return;
    }

    // Verificar multas impagas derivadas a justicia
    const multasBlock = await pool.request()
      .input('cliente', user.identificador)
      .query(`
        SELECT COUNT(*) as count FROM multas
        WHERE cliente = @cliente AND derivadaJusticia = 'si'
      `);

    if (multasBlock.recordset[0].count > 0) {
      res.status(403).json({ success: false, error: 'Cuenta suspendida por incumplimiento de pago' });
      return;
    }

    const validPassword = await bcrypt.compare(clave, user.claveHash);
    if (!validPassword) {
      const attempts = (user.failedAttempts || 0) + 1;
      const lockUntil = attempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
        : null;
      await pool.request()
        .input('id', user.identificador)
        .input('attempts', attempts)
        .input('lockUntil', sql.DateTime, lockUntil)
        .query('UPDATE clientes SET failedAttempts = @attempts, lockUntil = @lockUntil WHERE identificador = @id');
      res.status(401).json({ success: false, error: 'Credenciales invalidas' });
      return;
    }

    // Login correcto: resetear contador de intentos
    if (user.failedAttempts > 0 || user.lockUntil) {
      await pool.request()
        .input('id', user.identificador)
        .query('UPDATE clientes SET failedAttempts = 0, lockUntil = NULL WHERE identificador = @id');
    }

    const payload: TokenPayload = {
      id: user.identificador,
      email: user.email,
      categoria: user.categoria,
      admitido: user.admitido,
    };

    const { accessToken, refreshToken } = signTokens(payload);

    // Guardar refresh token en sesiones
    const expiracion = new Date();
    expiracion.setDate(expiracion.getDate() + REFRESH_TTL_DAYS);

    await pool.request()
      .input('cliente', user.identificador)
      .input('refreshToken', refreshToken)
      .input('fechaExpiracion', expiracion)
      .query(`
        INSERT INTO sesiones (cliente, refreshToken, fechaExpiracion)
        VALUES (@cliente, @refreshToken, @fechaExpiracion)
      `);

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.identificador,
          nombre: user.nombre,
          email: user.email,
          categoria: user.categoria,
        },
      },
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// Recupero de clave: ventana de validez del token de reseteo.
const RESET_TOKEN_TTL_MINUTES = 30;

const sha256 = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex');

// Respuesta generica del forgot-password: nunca revela si el email existe
// (anti-enumeracion, igual criterio que el login).
const FORGOT_GENERIC_MSG =
  'Si el email esta registrado, te enviamos un enlace para restablecer la clave.';

// POST /auth/forgot-password — inicia el recupero de clave.
// Siempre responde 200 con un mensaje generico. Si el cliente existe y completo
// su registro, genera un token de un solo uso (guardado hasheado) y manda el mail.
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body;
    const pool = await connectDB();

    const result = await pool.request()
      .input('email', email)
      .query(`
        SELECT c.identificador, c.email, c.claveHash, p.nombre, p.estado
        FROM clientes c
        INNER JOIN personas p ON p.identificador = c.identificador
        WHERE c.email = @email
      `);

    const user = result.recordset[0];

    // Solo emitimos token a cuentas activas que ya tienen clave (registro completo).
    // En cualquier otro caso respondemos el mismo mensaje sin hacer nada.
    if (user && user.claveHash && user.estado !== 'inactivo') {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = sha256(rawToken);
      const expira = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

      await pool.request()
        .input('id', user.identificador)
        .input('hash', tokenHash)
        .input('expira', sql.DateTime, expira)
        .query(`
          UPDATE clientes
          SET resetTokenHash = @hash, resetTokenExpira = @expira
          WHERE identificador = @id
        `);

      const resetUrl = `${getWebUrl()}/reset-password?token=${rawToken}`;
      // Best-effort: un fallo de envio no debe cambiar la respuesta ni filtrar info.
      await sendPasswordResetEmail(user.email, resetUrl, user.nombre);
    }

    res.json({ success: true, data: { mensaje: FORGOT_GENERIC_MSG } });
  } catch (error) {
    console.error('Error en forgotPassword:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// POST /auth/reset-password — completa el recupero con el token del mail.
// Valida el token (hash + vencimiento), setea la nueva clave, limpia el lock por
// intentos fallidos y revoca todas las sesiones activas del cliente (BSEC-04).
export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { token, clave } = req.body;
    const pool = await connectDB();

    const tokenHash = sha256(token);
    const result = await pool.request()
      .input('hash', tokenHash)
      .query(`
        SELECT identificador
        FROM clientes
        WHERE resetTokenHash = @hash AND resetTokenExpira > GETDATE()
      `);

    if (result.recordset.length === 0) {
      res.status(400).json({ success: false, error: 'Token invalido o expirado' });
      return;
    }

    const clienteId = result.recordset[0].identificador;
    const claveHash = await bcrypt.hash(clave, 10);

    // Setear clave, invalidar el token (un solo uso) y resetear el lock.
    await pool.request()
      .input('id', clienteId)
      .input('claveHash', claveHash)
      .query(`
        UPDATE clientes
        SET claveHash = @claveHash,
            resetTokenHash = NULL,
            resetTokenExpira = NULL,
            failedAttempts = 0,
            lockUntil = NULL
        WHERE identificador = @id
      `);

    // Revocar sesiones abiertas: un reseteo cierra sesion en todos los dispositivos.
    await pool.request()
      .input('cliente', clienteId)
      .query("UPDATE sesiones SET activo = 'no' WHERE cliente = @cliente AND activo = 'si'");

    res.json({ success: true, data: { mensaje: 'Clave actualizada. Ya podes iniciar sesion.' } });
  } catch (error) {
    console.error('Error en resetPassword:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// POST /auth/admin/login — autenticacion de empleado/admin (A5/A6/A7/A9).
// Emite un access token con claim `rol`. No genera refresh token porque la tabla
// `sesiones` referencia `clientes` (un empleado no es cliente); el panel admin
// reautentica al expirar.
export async function adminLogin(req: Request, res: Response): Promise<void> {
  try {
    const { email, clave } = req.body;

    const pool = await connectDB();

    const result = await pool.request()
      .input('email', email)
      .query(`
        SELECT e.identificador, e.email, e.claveHash, e.rol, p.nombre, p.estado
        FROM empleados e
        INNER JOIN personas p ON p.identificador = e.identificador
        WHERE e.email = @email
      `);

    if (result.recordset.length === 0) {
      res.status(401).json({ success: false, error: 'Credenciales invalidas' });
      return;
    }

    const emp = result.recordset[0];

    if (emp.estado === 'inactivo') {
      res.status(403).json({ success: false, error: 'Cuenta bloqueada' });
      return;
    }

    if (!emp.claveHash) {
      res.status(401).json({ success: false, error: 'Credenciales invalidas' });
      return;
    }

    const validPassword = await bcrypt.compare(clave, emp.claveHash);
    if (!validPassword) {
      res.status(401).json({ success: false, error: 'Credenciales invalidas' });
      return;
    }

    const payload: AdminTokenPayload = {
      id: emp.identificador,
      email: emp.email,
      rol: emp.rol,
    };
    const accessToken = jwt.sign(payload, getJwtSecret(), { expiresIn: ACCESS_TTL });

    res.json({
      success: true,
      data: {
        accessToken,
        user: { id: emp.identificador, nombre: emp.nombre, email: emp.email, rol: emp.rol },
      },
    });
  } catch (error) {
    console.error('Error en adminLogin:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// POST /auth/refresh — rotates the refresh token (BSEC-04)
export async function refreshToken(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      res.status(400).json({ success: false, error: 'Refresh token requerido' });
      return;
    }

    const pool = await connectDB();

    const sesion = await pool.request()
      .input('refreshToken', token)
      .query(`
        SELECT s.identificador, s.cliente, s.fechaExpiracion, c.email, c.categoria, c.admitido
        FROM sesiones s
        INNER JOIN clientes c ON c.identificador = s.cliente
        WHERE s.refreshToken = @refreshToken AND s.activo = 'si'
      `);

    if (sesion.recordset.length === 0) {
      res.status(401).json({ success: false, error: 'Refresh token invalido' });
      return;
    }

    const sesionData = sesion.recordset[0];

    // Revocar la sesion si el token expiro, para evitar reuso.
    if (new Date(sesionData.fechaExpiracion) < new Date()) {
      await pool.request()
        .input('id', sesionData.identificador)
        .query("UPDATE sesiones SET activo = 'no' WHERE identificador = @id");
      res.status(401).json({ success: false, error: 'Refresh token expirado' });
      return;
    }

    // Verificar firma. Si falla, revocar la sesion.
    try {
      jwt.verify(token, getJwtRefreshSecret());
    } catch {
      await pool.request()
        .input('id', sesionData.identificador)
        .query("UPDATE sesiones SET activo = 'no' WHERE identificador = @id");
      res.status(401).json({ success: false, error: 'Refresh token invalido' });
      return;
    }

    const payload: TokenPayload = {
      id: sesionData.cliente,
      email: sesionData.email,
      categoria: sesionData.categoria,
      admitido: sesionData.admitido,
    };

    // Rotacion: emitir nuevos tokens, invalidar el refresh anterior.
    const { accessToken, refreshToken: newRefreshToken } = signTokens(payload);
    const expiracion = new Date();
    expiracion.setDate(expiracion.getDate() + REFRESH_TTL_DAYS);

    await pool.request()
      .input('id', sesionData.identificador)
      .query("UPDATE sesiones SET activo = 'no' WHERE identificador = @id");

    await pool.request()
      .input('cliente', sesionData.cliente)
      .input('refreshToken', newRefreshToken)
      .input('fechaExpiracion', expiracion)
      .query(`
        INSERT INTO sesiones (cliente, refreshToken, fechaExpiracion)
        VALUES (@cliente, @refreshToken, @fechaExpiracion)
      `);

    res.json({
      success: true,
      data: { accessToken, refreshToken: newRefreshToken },
    });
  } catch (error) {
    console.error('Error en refreshToken:', error);
    res.status(401).json({ success: false, error: 'Refresh token invalido' });
  }
}

// POST /auth/logout — revokes a refresh token (BSEC-04)
export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      res.status(400).json({ success: false, error: 'Refresh token requerido' });
      return;
    }

    const pool = await connectDB();
    await pool.request()
      .input('refreshToken', token)
      .query("UPDATE sesiones SET activo = 'no' WHERE refreshToken = @refreshToken");

    res.json({ success: true, data: { mensaje: 'Sesion cerrada' } });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// GET /auth/me
export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'No autenticado' });
      return;
    }

    const pool = await connectDB();

    const result = await pool.request()
      .input('id', req.user.id)
      .query(`
        SELECT p.identificador, p.documento, p.nombre, p.apellido, p.direccion,
               c.email, c.categoria, c.admitido, c.numeroPais,
               pa.nombre as paisNombre
        FROM personas p
        INNER JOIN clientes c ON c.identificador = p.identificador
        LEFT JOIN paises pa ON pa.numero = c.numeroPais
        WHERE p.identificador = @id
      `);

    if (result.recordset.length === 0) {
      res.status(404).json({ success: false, error: 'Usuario no encontrado' });
      return;
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (error) {
    console.error('Error en getMe:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}
