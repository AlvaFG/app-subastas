import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { connectDB } from '../models/db';

// GET /notificaciones
export async function getNotificaciones(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('cliente', req.user!.id)
      .query(`
        SELECT identificador, tipo, titulo, mensaje, leida, fecha
        FROM notificaciones
        WHERE cliente = @cliente
        ORDER BY fecha DESC
      `);

    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error getNotificaciones:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// PUT /notificaciones/:id/leer
export async function marcarLeida(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const pool = await connectDB();

    await pool.request()
      .input('id', id)
      .input('cliente', req.user!.id)
      .query("UPDATE notificaciones SET leida = 'si' WHERE identificador = @id AND cliente = @cliente");

    res.json({ success: true, data: { mensaje: 'Notificacion marcada como leida' } });
  } catch (error) {
    console.error('Error marcarLeida:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// GET /notificaciones/count
export async function getUnreadCount(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('cliente', req.user!.id)
      .query("SELECT COUNT(*) as count FROM notificaciones WHERE cliente = @cliente AND leida = 'no'");

    res.json({ success: true, data: { count: result.recordset[0].count } });
  } catch (error) {
    console.error('Error getUnreadCount:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// T604: Create winner notification (called internally)
export async function createWinnerNotification(
  clienteId: number,
  importe: number,
  comision: number,
  costoEnvio: number,
  moneda: string,
): Promise<void> {
  const pool = await connectDB();
  const symbol = moneda === 'USD' ? 'US$' : '$';
  const total = importe + comision + costoEnvio;

  const mensaje = [
    `Importe pujado: ${symbol} ${importe.toFixed(2)}`,
    `Comisiones: ${symbol} ${comision.toFixed(2)}`,
    `Costo de envio: ${symbol} ${costoEnvio.toFixed(2)}`,
    `Total a pagar: ${symbol} ${total.toFixed(2)}`,
    '',
    'Puede retirar personalmente el bien, pero en ese caso pierde la cobertura del seguro.',
  ].join('\n');

  await pool.request()
    .input('cliente', clienteId)
    .input('titulo', 'Felicitaciones! Ganaste una subasta')
    .input('mensaje', mensaje)
    .query(`
      INSERT INTO notificaciones (cliente, tipo, titulo, mensaje)
      VALUES (@cliente, 'ganador', @titulo, @mensaje)
    `);
}
