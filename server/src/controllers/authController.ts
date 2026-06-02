import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import sql from 'mssql';
import { connectDB } from '../models/db';
import { AuthRequest } from '../middleware/auth';
import { getJwtSecret, getJwtRefreshSecret } from '../config/env';
import { uploadImage, toBuffer } from '../services/cloudinary';

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
    const { documento, nombre, apellido, direccion, numeroPais, fotoFrente, fotoDorso } = req.body;
    const fullName = apellido ? `${nombre} ${apellido}` : nombre;

    const pool = await connectDB();

    // Verificar si ya existe
    const existing = await pool.request()
      .input('documento', documento)
      .query('SELECT identificador FROM personas WHERE documento = @documento');

    if (existing.recordset.length > 0) {
      res.status(400).json({ success: false, error: 'El documento ya esta registrado' });
      return;
    }

    // verificador: use a real, existing empleado instead of a hardcoded id (BSEC-02).
    // NOTE (academic simplification): there is no external-investigation admin panel,
    // so registration auto-admits the client and assigns the system's first empleado
    // as verificador. The category stays 'comun' until upgraded by activity.
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

    // Insertar persona
    const personaResult = await pool.request()
      .input('documento', documento)
      .input('nombre', fullName)
      .input('direccion', direccion)
      .input('estado', 'activo')
      .query(`
        INSERT INTO personas (documento, nombre, direccion, estado)
        OUTPUT INSERTED.identificador
        VALUES (@documento, @nombre, @direccion, @estado)
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

    // Auto-aprobar al usuario al completar etapa 1 (simplificacion academica: no hay
    // investigacion externa). La categoria base es 'comun'; nunca se asigna al azar.
    const insertReq = pool.request()
      .input('identificador', personaId)
      .input('admitido', 'si')
      .input('categoria', 'comun')
      .input('verificador', verificadorId);

    if (numeroPaisToInsert !== null) {
      insertReq.input('numeroPais', sql.Int, numeroPaisToInsert);
    } else {
      insertReq.input('numeroPais', sql.Int, null);
    }

    await insertReq.query(`
      INSERT INTO clientes (identificador, numeroPais, admitido, categoria, verificador)
      VALUES (@identificador, @numeroPais, @admitido, @categoria, @verificador)
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
        autoAprobado: true,
        mensaje: 'Registro etapa 1 completado. Puede continuar con la etapa 2.',
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
    const { identificador, email, clave } = req.body;

    const pool = await connectDB();

    // Verificar que el cliente existe y esta admitido
    const cliente = await pool.request()
      .input('identificador', identificador)
      .query(`
        SELECT c.identificador, c.admitido, c.email, c.categoria
        FROM clientes c
        WHERE c.identificador = @identificador
      `);

    if (cliente.recordset.length === 0) {
      res.status(404).json({ success: false, error: 'Cliente no encontrado' });
      return;
    }

    if (cliente.recordset[0].admitido !== 'si') {
      res.status(403).json({ success: false, error: 'Cliente aun no ha sido admitido' });
      return;
    }

    if (cliente.recordset[0].email) {
      res.status(400).json({ success: false, error: 'El registro ya fue completado' });
      return;
    }

    // Hashear clave y guardar. La categoria NO se toca aqui: queda la 'comun'
    // asignada en etapa 1 (BSEC-01/REQ-01: nunca se asigna al azar).
    const claveHash = await bcrypt.hash(clave, 10);

    await pool.request()
      .input('identificador', identificador)
      .input('email', email)
      .input('claveHash', claveHash)
      .query(`
        UPDATE clientes
        SET email = @email, claveHash = @claveHash
        WHERE identificador = @identificador
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
        SELECT p.identificador, p.documento, p.nombre, p.direccion,
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
