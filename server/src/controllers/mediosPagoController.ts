import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { connectDB } from '../models/db';

// GET /medios-pago
export async function getMediosPago(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('cliente', req.user!.id)
      .query(`
        SELECT identificador, tipo, descripcion, banco, numeroCuenta, cbu, moneda,
               ultimosDigitos, internacional, montoCheque, montoDisponible,
               verificado, activo
        FROM mediosDePago
        WHERE cliente = @cliente AND activo = 'si'
      `);

    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error getMediosPago:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// POST /medios-pago
export async function createMedioPago(req: AuthRequest, res: Response): Promise<void> {
  try {
    const {
      tipo, descripcion, banco, numeroCuenta, cbu, moneda,
      ultimosDigitos, internacional, montoCheque,
    } = req.body;

    const pool = await connectDB();

    const result = await pool.request()
      .input('cliente', req.user!.id)
      .input('tipo', tipo)
      .input('descripcion', descripcion)
      .input('banco', banco || null)
      .input('numeroCuenta', numeroCuenta || null)
      .input('cbu', cbu || null)
      .input('moneda', moneda || 'ARS')
      .input('ultimosDigitos', ultimosDigitos || null)
      .input('internacional', internacional || 'no')
      .input('montoCheque', montoCheque || null)
      .input('montoDisponible', montoCheque || null)
      .query(`
        INSERT INTO mediosDePago (cliente, tipo, descripcion, banco, numeroCuenta, cbu, moneda,
                                   ultimosDigitos, internacional, montoCheque, montoDisponible)
        OUTPUT INSERTED.identificador
        VALUES (@cliente, @tipo, @descripcion, @banco, @numeroCuenta, @cbu, @moneda,
                @ultimosDigitos, @internacional, @montoCheque, @montoDisponible)
      `);

    res.status(201).json({
      success: true,
      data: { identificador: result.recordset[0].identificador },
    });
  } catch (error) {
    console.error('Error createMedioPago:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// PUT /medios-pago/:id
export async function updateMedioPago(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { descripcion, banco, numeroCuenta, cbu, moneda, ultimosDigitos, internacional } = req.body;

    const pool = await connectDB();

    // Verificar que pertenece al usuario
    const check = await pool.request()
      .input('id', id)
      .input('cliente', req.user!.id)
      .query('SELECT identificador FROM mediosDePago WHERE identificador = @id AND cliente = @cliente');

    if (check.recordset.length === 0) {
      res.status(404).json({ success: false, error: 'Medio de pago no encontrado' });
      return;
    }

    await pool.request()
      .input('id', id)
      .input('descripcion', descripcion)
      .input('banco', banco || null)
      .input('numeroCuenta', numeroCuenta || null)
      .input('cbu', cbu || null)
      .input('moneda', moneda || 'ARS')
      .input('ultimosDigitos', ultimosDigitos || null)
      .input('internacional', internacional || 'no')
      .query(`
        UPDATE mediosDePago
        SET descripcion = @descripcion, banco = @banco, numeroCuenta = @numeroCuenta,
            cbu = @cbu, moneda = @moneda, ultimosDigitos = @ultimosDigitos,
            internacional = @internacional, verificado = 'no'
        WHERE identificador = @id
      `);

    res.json({ success: true, data: { mensaje: 'Medio de pago actualizado' } });
  } catch (error) {
    console.error('Error updateMedioPago:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// DELETE /medios-pago/:id (soft delete)
export async function deleteMedioPago(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const pool = await connectDB();

    const check = await pool.request()
      .input('id', id)
      .input('cliente', req.user!.id)
      .query('SELECT identificador FROM mediosDePago WHERE identificador = @id AND cliente = @cliente');

    if (check.recordset.length === 0) {
      res.status(404).json({ success: false, error: 'Medio de pago no encontrado' });
      return;
    }

    await pool.request()
      .input('id', id)
      .query("UPDATE mediosDePago SET activo = 'no' WHERE identificador = @id");

    res.json({ success: true, data: { mensaje: 'Medio de pago eliminado' } });
  } catch (error) {
    console.error('Error deleteMedioPago:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}
