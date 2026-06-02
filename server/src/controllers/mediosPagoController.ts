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
      ultimosDigitos, internacional, montoCheque, montoDisponible,
    } = req.body;

    const pool = await connectDB();

    let montoChequeFinal: number | null = null;
    let montoInicialSeguro = 0;

    if (tipo === 'cheque_certificado') {
      // REQ-04: el cheque certificado funciona como garantia: las compras no pueden
      // superar el monto del cheque, por lo que el saldo disponible arranca igual al
      // monto del cheque (se ignora cualquier montoDisponible enviado por el cliente).
      const monto = Number(montoCheque ?? montoDisponible ?? 0);
      montoChequeFinal = Number.isFinite(monto) && monto > 0 ? monto : null;
      montoInicialSeguro = montoChequeFinal ?? 0;
    } else {
      // Otros tipos: respeta el saldo disponible declarado (comportamiento actual).
      const monto = Number(montoDisponible ?? 0);
      montoInicialSeguro = Number.isFinite(monto) && monto > 0 ? monto : 0;
    }

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
      .input('montoCheque', montoChequeFinal)
      .input('montoDisponible', montoInicialSeguro)
      // REQ-03 / A6: el medio se crea verificado='no'. Solo la empresa lo habilita
      // (PUT /api/admin/medios-pago/:id/verificar). Hasta entonces el usuario no
      // puede pujar con el (ver join-auction / place-bid).
      .input('verificado', 'no')
      .query(`
        INSERT INTO mediosDePago (cliente, tipo, descripcion, banco, numeroCuenta, cbu, moneda,
                                   ultimosDigitos, internacional, montoCheque, montoDisponible, verificado)
        OUTPUT INSERTED.identificador
        VALUES (@cliente, @tipo, @descripcion, @banco, @numeroCuenta, @cbu, @moneda,
                @ultimosDigitos, @internacional, @montoCheque, @montoDisponible, @verificado)
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

// PUT /medios-pago/:id/saldo - Update balance for a payment method
export async function updateSaldoMedioPago(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { monto } = req.body;

    if (typeof monto !== 'number' || monto === 0) {
      res.status(400).json({ success: false, error: 'Monto invalido' });
      return;
    }

    const pool = await connectDB();

    // Get current balance and verify ownership
    const medio = await pool.request()
      .input('id', id)
      .input('cliente', req.user!.id)
      .query(`
        SELECT identificador, montoDisponible, moneda
        FROM mediosDePago
        WHERE identificador = @id AND cliente = @cliente
      `);

    if (medio.recordset.length === 0) {
      res.status(404).json({ success: false, error: 'Medio de pago no encontrado' });
      return;
    }

    const nuevoMonto = Number(medio.recordset[0].montoDisponible || 0) + monto;

    if (nuevoMonto < 0) {
      res.status(400).json({ success: false, error: 'Saldo insuficiente' });
      return;
    }

    await pool.request()
      .input('id', id)
      .input('nuevoMonto', nuevoMonto)
      .query(`
        UPDATE mediosDePago
        SET montoDisponible = @nuevoMonto
        WHERE identificador = @id
      `);

    res.json({
      success: true,
      data: {
        montoAnterior: Number(medio.recordset[0].montoDisponible || 0),
        montoNuevo: nuevoMonto,
        moneda: medio.recordset[0].moneda,
      },
    });
  } catch (error) {
    console.error('Error updateSaldoMedioPago:', error);
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
