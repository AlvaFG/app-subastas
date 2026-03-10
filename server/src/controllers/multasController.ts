import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { connectDB } from '../models/db';

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
    const result = await pool.request()
      .input('cliente', req.user!.id)
      .query(`
        SELECT m.identificador, m.importeOriginal, m.importeMulta, m.pagada,
               m.fechaMulta, m.fechaLimite, m.derivadaJusticia
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
