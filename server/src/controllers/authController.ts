import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { connectDB } from '../models/db';
import { AuthRequest } from '../middleware/auth';

// T202: POST /auth/register/step1
export async function registerStep1(req: Request, res: Response): Promise<void> {
  try {
    const { documento, nombre, direccion, numeroPais, fotoFrente, fotoDorso } = req.body;

    const pool = await connectDB();

    // Verificar si ya existe
    const existing = await pool.request()
      .input('documento', documento)
      .query('SELECT identificador FROM personas WHERE documento = @documento');

    if (existing.recordset.length > 0) {
      res.status(400).json({ success: false, error: 'El documento ya esta registrado' });
      return;
    }

    // Insertar persona
    const personaResult = await pool.request()
      .input('documento', documento)
      .input('nombre', nombre)
      .input('direccion', direccion)
      .input('estado', 'activo')
      .query(`
        INSERT INTO personas (documento, nombre, direccion, estado)
        OUTPUT INSERTED.identificador
        VALUES (@documento, @nombre, @direccion, @estado)
      `);

    const personaId = personaResult.recordset[0].identificador;

    // Auto-aprobar al usuario al completar etapa 1 si supera las validaciones de entrada.
    await pool.request()
      .input('identificador', personaId)
      .input('numeroPais', numeroPais)
      .input('admitido', 'si')
      .input('categoria', 'comun')
      .input('verificador', 1) // TODO: asignar verificador real
      .query(`
        INSERT INTO clientes (identificador, numeroPais, admitido, categoria, verificador)
        VALUES (@identificador, @numeroPais, @admitido, @categoria, @verificador)
      `);

    // TODO: Guardar fotos documento en Cloudinary (fotoFrente, fotoDorso)

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
    const categoriasDisponibles = ['comun', 'especial', 'plata', 'oro', 'platino'];
    const categoriaAsignada = categoriasDisponibles[Math.floor(Math.random() * categoriasDisponibles.length)];

    const pool = await connectDB();

    // Verificar que el cliente existe y esta admitido
    const cliente = await pool.request()
      .input('identificador', identificador)
      .query(`
        SELECT c.identificador, c.admitido, c.email
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

    // Hashear clave y guardar
    const claveHash = await bcrypt.hash(clave, 10);

    await pool.request()
      .input('identificador', identificador)
      .input('email', email)
      .input('claveHash', claveHash)
      .input('categoria', categoriaAsignada)
      .query(`
        UPDATE clientes
        SET email = @email, claveHash = @claveHash, categoria = @categoria
        WHERE identificador = @identificador
      `);

    res.json({
      success: true,
      data: {
        mensaje: 'Registro completado. Ya puede iniciar sesion.',
        categoria: categoriaAsignada,
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
      res.status(401).json({ success: false, error: 'Credenciales invalidas' });
      return;
    }

    const payload = {
      id: user.identificador,
      email: user.email,
      categoria: user.categoria,
      admitido: user.admitido,
    };

    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      throw new Error('JWT secrets not configured');
    }

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

    // Guardar refresh token en sesiones
    const expiracion = new Date();
    expiracion.setDate(expiracion.getDate() + 7);

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

// POST /auth/refresh
export async function refreshToken(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      res.status(400).json({ success: false, error: 'Refresh token requerido' });
      return;
    }

    const pool = await connectDB();

    // Verificar que el refresh token existe y esta activo
    const sesion = await pool.request()
      .input('refreshToken', token)
      .query(`
        SELECT s.cliente, s.fechaExpiracion, c.email, c.categoria, c.admitido
        FROM sesiones s
        INNER JOIN clientes c ON c.identificador = s.cliente
        WHERE s.refreshToken = @refreshToken AND s.activo = 'si'
      `);

    if (sesion.recordset.length === 0) {
      res.status(401).json({ success: false, error: 'Refresh token invalido' });
      return;
    }

    const sesionData = sesion.recordset[0];

    if (new Date(sesionData.fechaExpiracion) < new Date()) {
      res.status(401).json({ success: false, error: 'Refresh token expirado' });
      return;
    }

    if (!process.env.JWT_REFRESH_SECRET || !process.env.JWT_SECRET) {
      throw new Error('JWT secrets not configured');
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET) as any;

    const payload = {
      id: decoded.id,
      email: sesionData.email,
      categoria: sesionData.categoria,
      admitido: sesionData.admitido,
    };

    const newAccessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({
      success: true,
      data: { accessToken: newAccessToken },
    });
  } catch {
    res.status(401).json({ success: false, error: 'Refresh token invalido' });
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
