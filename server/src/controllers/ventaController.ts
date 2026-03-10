import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { connectDB } from '../models/db';

// T502: POST /solicitudes-venta
export async function createSolicitud(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { descripcion, datosHistoricos, declaracionPropiedad } = req.body;

    if (declaracionPropiedad !== 'si') {
      res.status(400).json({ success: false, error: 'Debe declarar que el bien le pertenece' });
      return;
    }

    const pool = await connectDB();

    const result = await pool.request()
      .input('cliente', req.user!.id)
      .input('descripcion', descripcion)
      .input('datosHistoricos', datosHistoricos || null)
      .input('declaracionPropiedad', 'si')
      .query(`
        INSERT INTO solicitudesVenta (cliente, descripcion, datosHistoricos, declaracionPropiedad)
        OUTPUT INSERTED.identificador
        VALUES (@cliente, @descripcion, @datosHistoricos, @declaracionPropiedad)
      `);

    res.status(201).json({
      success: true,
      data: { identificador: result.recordset[0].identificador },
    });
  } catch (error) {
    console.error('Error createSolicitud:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// GET /solicitudes-venta
export async function getSolicitudes(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('cliente', req.user!.id)
      .query(`
        SELECT identificador, descripcion, datosHistoricos, estado,
               motivoRechazo, fechaSolicitud, valorBase, comisionPropuesta,
               aceptadoPorUsuario
        FROM solicitudesVenta
        WHERE cliente = @cliente
        ORDER BY fechaSolicitud DESC
      `);

    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error getSolicitudes:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// GET /solicitudes-venta/:id
export async function getSolicitudDetalle(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const pool = await connectDB();

    const result = await pool.request()
      .input('id', id)
      .input('cliente', req.user!.id)
      .query(`
        SELECT s.*,
               d.nombre as depositoNombre, d.direccion as depositoDireccion,
               seg.nroPoliza, seg.compania, seg.importe as importeSeguro
        FROM solicitudesVenta s
        LEFT JOIN productos pr ON pr.duenio = s.cliente
        LEFT JOIN depositos d ON d.identificador = pr.deposito
        LEFT JOIN seguros seg ON seg.nroPoliza = pr.seguro
        WHERE s.identificador = @id AND s.cliente = @cliente
      `);

    if (result.recordset.length === 0) {
      res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
      return;
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (error) {
    console.error('Error getSolicitudDetalle:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// PUT /solicitudes-venta/:id/respuesta — user accepts/rejects base value
export async function responderSolicitud(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { acepta } = req.body; // 'si' or 'no'

    const pool = await connectDB();

    const check = await pool.request()
      .input('id', id)
      .input('cliente', req.user!.id)
      .query("SELECT identificador, estado FROM solicitudesVenta WHERE identificador = @id AND cliente = @cliente AND estado = 'aceptada'");

    if (check.recordset.length === 0) {
      res.status(404).json({ success: false, error: 'Solicitud no encontrada o no esta aceptada' });
      return;
    }

    await pool.request()
      .input('id', id)
      .input('acepta', acepta)
      .query(`
        UPDATE solicitudesVenta SET aceptadoPorUsuario = @acepta
        WHERE identificador = @id
      `);

    const mensaje = acepta === 'si'
      ? 'Acepto las condiciones. Su bien sera incluido en la subasta.'
      : 'Rechazo las condiciones. Se procedera a la devolucion.';

    res.json({ success: true, data: { mensaje } });
  } catch (error) {
    console.error('Error responderSolicitud:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// T508: Cuentas a la vista
export async function getCuentasVista(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('duenio', req.user!.id)
      .query("SELECT * FROM cuentasAVista WHERE duenio = @duenio AND activa = 'si'");

    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error getCuentasVista:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

export async function createCuentaVista(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { banco, numeroCuenta, cbu, moneda, pais } = req.body;
    const pool = await connectDB();

    const result = await pool.request()
      .input('duenio', req.user!.id)
      .input('banco', banco)
      .input('numeroCuenta', numeroCuenta)
      .input('cbu', cbu || null)
      .input('moneda', moneda || 'ARS')
      .input('pais', pais || null)
      .query(`
        INSERT INTO cuentasAVista (duenio, banco, numeroCuenta, cbu, moneda, pais)
        OUTPUT INSERTED.identificador
        VALUES (@duenio, @banco, @numeroCuenta, @cbu, @moneda, @pais)
      `);

    res.status(201).json({ success: true, data: { identificador: result.recordset[0].identificador } });
  } catch (error) {
    console.error('Error createCuentaVista:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}
