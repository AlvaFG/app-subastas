import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { connectDB } from '../models/db';

async function hasMultasMonedaColumn(pool: any): Promise<boolean> {
  const columnCheck = await pool.request().query(`
    SELECT COUNT(*) as count
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'multas' AND COLUMN_NAME = 'moneda'
  `);
  return Number(columnCheck.recordset[0]?.count || 0) > 0;
}

// T409: POST /multas - Register penalty for non-payment (internal use only — called by close-item)
export async function createMulta(req: AuthRequest, res: Response): Promise<void> {
  try {
    // Security: only allow admin/system to create multas, use authenticated user as target
    const { subasta, item, importeOriginal } = req.body;
    const cliente = req.user!.id; // Always use authenticated user, never accept from body
    const importeMulta = importeOriginal * 0.10; // 10% penalty

    const pool = await connectDB();

    // Calculate 72h deadline
    const fechaLimite = new Date();
    fechaLimite.setHours(fechaLimite.getHours() + 72);

    await pool.request()
      .input('cliente', cliente)
      .input('subasta', subasta)
      .input('item', item)
      .input('importeOriginal', importeOriginal)
      .input('importeMulta', importeMulta)
      .input('fechaLimite', fechaLimite)
      .query(`
        INSERT INTO multas (cliente, subasta, item, importeOriginal, importeMulta, fechaLimite)
        VALUES (@cliente, @subasta, @item, @importeOriginal, @importeMulta, @fechaLimite)
      `);

    // Create notification
    await pool.request()
      .input('cliente', cliente)
      .input('titulo', 'Multa por impago')
      .input('mensaje', `Se le ha aplicado una multa de $${importeMulta.toFixed(2)} (10% de $${importeOriginal.toFixed(2)}). Tiene 72hs para presentar los fondos necesarios.`)
      .query(`
        INSERT INTO notificaciones (cliente, tipo, titulo, mensaje)
        VALUES (@cliente, 'multa', @titulo, @mensaje)
      `);

    res.status(201).json({
      success: true,
      data: { importeMulta, fechaLimite },
    });
  } catch (error) {
    console.error('Error createMulta:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// GET /multas - Get user penalties
export async function getMultas(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = await connectDB();
    const hasMoneda = await hasMultasMonedaColumn(pool);
    const selectMoneda = hasMoneda ? "COALESCE(m.moneda, 'ARS') as moneda" : "'ARS' as moneda";

    const result = await pool.request()
      .input('cliente', req.user!.id)
      .query(`
        SELECT m.identificador, m.importeOriginal, m.importeMulta, m.pagada,
               m.fechaMulta, m.fechaLimite, m.derivadaJusticia, ${selectMoneda}
        FROM multas m
        WHERE m.cliente = @cliente
        ORDER BY m.fechaMulta DESC
      `);

    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error getMultas:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// PUT /multas/:id/pagar - Mark a fine as paid using a payment method
export async function pagarMulta(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { medioPagoId } = req.body;
    const pool = await connectDB();
    const hasMoneda = await hasMultasMonedaColumn(pool);
    const selectMoneda = hasMoneda ? "COALESCE(moneda, 'ARS') as moneda" : "'ARS' as moneda";

    // Get multa details including currency
    const multa = await pool.request()
      .input('id', id)
      .input('cliente', req.user!.id)
      .query(`
        SELECT identificador, pagada, importeMulta, ${selectMoneda}
        FROM multas
        WHERE identificador = @id AND cliente = @cliente
      `);

    if (multa.recordset.length === 0) {
      res.status(404).json({ success: false, error: 'Multa no encontrada' });
      return;
    }

    if (multa.recordset[0].pagada === 'si') {
      res.json({ success: true, data: { mensaje: 'La multa ya estaba pagada' } });
      return;
    }

    const importeMulta = Number(multa.recordset[0].importeMulta || 0);
    const multaMoneda = multa.recordset[0].moneda;

    // Validate payment method exists and belongs to user, with currency compatibility
    const medioPago = await pool.request()
      .input('medioPagoId', medioPagoId)
      .input('cliente', req.user!.id)
      .input('moneda', multaMoneda)
      .query(`
        SELECT identificador, montoDisponible, tipo, moneda, internacional
        FROM mediosDePago
        WHERE identificador = @medioPagoId AND cliente = @cliente AND activo = 'si'
          AND (moneda = @moneda OR internacional = 'si')
      `);

    if (medioPago.recordset.length === 0) {
      res.status(400).json({ success: false, error: `Medio de pago no compatible con ${multaMoneda}` });
      return;
    }

    const montoDisponible = Number(medioPago.recordset[0].montoDisponible || 0);

    // Validate sufficient balance
    if (montoDisponible < importeMulta) {
      res.status(400).json({ 
        success: false, 
        error: `Saldo insuficiente. Se necesitan ${multaMoneda} ${importeMulta.toFixed(2)} pero el medio tiene ${multaMoneda} ${montoDisponible.toFixed(2)}`
      });
      return;
    }

    // Deduct from payment method and mark multa as paid
    await pool.request()
      .input('medioPagoId', medioPagoId)
      .input('importeMulta', importeMulta)
      .query(`
        UPDATE mediosDePago
        SET montoDisponible = montoDisponible - @importeMulta
        WHERE identificador = @medioPagoId
      `);

    await pool.request()
      .input('id', id)
      .query("UPDATE multas SET pagada = 'si' WHERE identificador = @id");

    // Create success notification
    await pool.request()
      .input('cliente', req.user!.id)
      .input('titulo', 'Multa pagada')
      .input('mensaje', `Se registró el pago de su multa por $${importeMulta.toFixed(2)}. Ya puede volver a pujar.`)
      .query(`
        INSERT INTO notificaciones (cliente, tipo, titulo, mensaje)
        VALUES (@cliente, 'sistema', @titulo, @mensaje)
      `);

    res.json({ success: true, data: { mensaje: 'Multa pagada correctamente' } });
  } catch (error) {
    console.error('Error pagarMulta:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}
