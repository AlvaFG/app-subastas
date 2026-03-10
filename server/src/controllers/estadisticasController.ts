import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { connectDB } from '../models/db';

// T602: GET /usuarios/:id/estadisticas
export async function getEstadisticas(req: AuthRequest, res: Response): Promise<void> {
  try {
    const clienteId = req.user!.id;
    const pool = await connectDB();

    // Subastas asistidas
    const asistidas = await pool.request()
      .input('cliente', clienteId)
      .query('SELECT COUNT(DISTINCT subasta) as total FROM asistentes WHERE cliente = @cliente');

    // Veces que gano
    const ganadas = await pool.request()
      .input('cliente', clienteId)
      .query(`
        SELECT COUNT(*) as total
        FROM pujos p
        INNER JOIN asistentes a ON a.identificador = p.asistente
        WHERE a.cliente = @cliente AND p.ganador = 'si'
      `);

    // Total pujado e importes pagados
    const importes = await pool.request()
      .input('cliente', clienteId)
      .query(`
        SELECT
          COALESCE(SUM(p.importe), 0) as totalPujado,
          COUNT(p.identificador) as totalPujas
        FROM pujos p
        INNER JOIN asistentes a ON a.identificador = p.asistente
        WHERE a.cliente = @cliente
      `);

    const pagados = await pool.request()
      .input('cliente', clienteId)
      .query(`
        SELECT
          COALESCE(SUM(importe), 0) as totalPagado,
          COALESCE(SUM(comision), 0) as totalComisiones
        FROM registroDeSubasta
        WHERE cliente = @cliente
      `);

    // Participacion por categoria
    const porCategoria = await pool.request()
      .input('cliente', clienteId)
      .query(`
        SELECT s.categoria, COUNT(DISTINCT s.identificador) as cantidad
        FROM asistentes a
        INNER JOIN subastas s ON s.identificador = a.subasta
        WHERE a.cliente = @cliente
        GROUP BY s.categoria
      `);

    // Multas
    const multas = await pool.request()
      .input('cliente', clienteId)
      .query(`
        SELECT COUNT(*) as total,
               SUM(CASE WHEN pagada = 'no' THEN 1 ELSE 0 END) as impagas
        FROM multas WHERE cliente = @cliente
      `);

    res.json({
      success: true,
      data: {
        subastasAsistidas: asistidas.recordset[0].total,
        subastasGanadas: ganadas.recordset[0].total,
        totalPujas: importes.recordset[0].totalPujas,
        totalPujado: parseFloat(importes.recordset[0].totalPujado),
        totalPagado: parseFloat(pagados.recordset[0].totalPagado),
        totalComisiones: parseFloat(pagados.recordset[0].totalComisiones),
        porCategoria: porCategoria.recordset,
        multas: {
          total: multas.recordset[0].total,
          impagas: multas.recordset[0].impagas,
        },
      },
    });
  } catch (error) {
    console.error('Error getEstadisticas:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// GET /usuarios/:id/historial-pujas?subastaId=
export async function getHistorialPujas(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { subastaId } = req.query;
    const pool = await connectDB();

    let query = `
      SELECT p.identificador, p.importe, p.ganador,
             ic.identificador as itemId, pr.descripcionCatalogo,
             s.identificador as subastaId, s.fecha as subastaFecha
      FROM pujos p
      INNER JOIN asistentes a ON a.identificador = p.asistente
      INNER JOIN itemsCatalogo ic ON ic.identificador = p.item
      INNER JOIN productos pr ON pr.identificador = ic.producto
      INNER JOIN catalogos c ON c.identificador = ic.catalogo
      INNER JOIN subastas s ON s.identificador = c.subasta
      WHERE a.cliente = @cliente
    `;
    const request = pool.request().input('cliente', req.user!.id);

    if (subastaId) {
      query += ' AND s.identificador = @subastaId';
      request.input('subastaId', subastaId);
    }

    query += ' ORDER BY p.identificador ASC';

    const result = await request.query(query);
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error getHistorialPujas:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}
