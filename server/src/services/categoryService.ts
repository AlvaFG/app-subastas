import { connectDB } from '../models/db';
import { upgradedCategory } from '../utils/categoryUpgrade';

/**
 * TPO §53: recalcula (solo al alza) la categoria de un cliente segun la diversidad
 * de sus medios de pago verificados y su actividad (subastas ganadas). Se invoca
 * tras una compra ganada y puede dispararse manualmente por la empresa.
 * Devuelve la categoria resultante (o null si el cliente no existe).
 */
export async function recalcularCategoria(clienteId: number): Promise<string | null> {
  const pool = await connectDB();
  const r = await pool.request()
    .input('cliente', clienteId)
    .query(`
      SELECT
        (SELECT COUNT(DISTINCT tipo) FROM mediosDePago
         WHERE cliente = @cliente AND verificado = 'si' AND activo = 'si') as tipos,
        (SELECT COUNT(*) FROM pujos p
         INNER JOIN asistentes a ON a.identificador = p.asistente
         WHERE a.cliente = @cliente AND p.ganador = 'si') as wins,
        (SELECT categoria FROM clientes WHERE identificador = @cliente) as categoria
    `);

  const row = r.recordset[0];
  if (!row || !row.categoria) return null;

  const nueva = upgradedCategory(row.categoria, Number(row.tipos || 0), Number(row.wins || 0));
  if (nueva !== row.categoria) {
    await pool.request()
      .input('cliente', clienteId)
      .input('cat', nueva)
      .query('UPDATE clientes SET categoria = @cat WHERE identificador = @cliente');

    await pool.request()
      .input('cliente', clienteId)
      .input('mensaje', `Tu categoria mejoro a "${nueva}" por tu actividad y medios de pago verificados.`)
      .query(`
        INSERT INTO notificaciones (cliente, tipo, titulo, mensaje)
        VALUES (@cliente, 'sistema', 'Mejora de categoria', @mensaje)
      `);
  }

  return nueva;
}
