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

    // Total pujado por moneda
    const importes = await pool.request()
      .input('cliente', clienteId)
      .query(`
        SELECT
          COALESCE(SUM(CASE WHEN s.moneda = 'ARS' THEN p.importe ELSE 0 END), 0) as totalPujadoARS,
          COALESCE(SUM(CASE WHEN s.moneda = 'USD' THEN p.importe ELSE 0 END), 0) as totalPujadoUSD,
          COUNT(p.identificador) as totalPujas
        FROM pujos p
        INNER JOIN asistentes a ON a.identificador = p.asistente
        INNER JOIN itemsCatalogo ic ON ic.identificador = p.item
        INNER JOIN catalogos c ON c.identificador = ic.catalogo
        INNER JOIN subastas s ON s.identificador = c.subasta
        WHERE a.cliente = @cliente
      `);

    // Total pagado y comisiones por moneda
    const pagados = await pool.request()
      .input('cliente', clienteId)
      .query(`
        SELECT
          COALESCE(SUM(CASE WHEN s.moneda = 'ARS' THEN r.importe ELSE 0 END), 0) as totalPagadoARS,
          COALESCE(SUM(CASE WHEN s.moneda = 'USD' THEN r.importe ELSE 0 END), 0) as totalPagadoUSD,
          COALESCE(SUM(CASE WHEN s.moneda = 'ARS' THEN r.comision ELSE 0 END), 0) as totalComisionesARS,
          COALESCE(SUM(CASE WHEN s.moneda = 'USD' THEN r.comision ELSE 0 END), 0) as totalComisionesUSD
        FROM registroDeSubasta r
        INNER JOIN subastas s ON s.identificador = r.subasta
        WHERE r.cliente = @cliente
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
        totalPujado: parseFloat(importes.recordset[0].totalPujadoARS) + parseFloat(importes.recordset[0].totalPujadoUSD),
        totalPagado: parseFloat(pagados.recordset[0].totalPagadoARS) + parseFloat(pagados.recordset[0].totalPagadoUSD),
        totalComisiones: parseFloat(pagados.recordset[0].totalComisionesARS) + parseFloat(pagados.recordset[0].totalComisionesUSD),
        totalPujadoARS: parseFloat(importes.recordset[0].totalPujadoARS),
        totalPujadoUSD: parseFloat(importes.recordset[0].totalPujadoUSD),
        totalPagadoARS: parseFloat(pagados.recordset[0].totalPagadoARS),
        totalPagadoUSD: parseFloat(pagados.recordset[0].totalPagadoUSD),
        totalComisionesARS: parseFloat(pagados.recordset[0].totalComisionesARS),
        totalComisionesUSD: parseFloat(pagados.recordset[0].totalComisionesUSD),
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
