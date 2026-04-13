import { Request, Response } from 'express';
import { connectDB } from '../models/db';
import { AuthRequest } from '../middleware/auth';

// T302: GET /subastas
export async function getSubastas(req: Request, res: Response): Promise<void> {
  try {
    const { estado, categoria } = req.query;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 20), 100);
    const offset = (page - 1) * limit;

    const pool = await connectDB();
    let query = `
      SELECT s.identificador, s.fecha, s.hora, s.estado, s.ubicacion,
             s.categoria, s.moneda, s.capacidadAsistentes,
             p.nombre as subastadorNombre,
             (SELECT COUNT(*) FROM catalogos c WHERE c.subasta = s.identificador) as totalItems,
             (SELECT TOP 1 pr.descripcionCatalogo FROM itemsCatalogo ic
              INNER JOIN productos pr ON pr.identificador = ic.producto
              INNER JOIN catalogos c ON c.identificador = ic.catalogo
              WHERE c.subasta = s.identificador
              ORDER BY ic.identificador) as nombrePrimerItem,
             (SELECT TOP 1 f.foto FROM fotos f
              INNER JOIN itemsCatalogo ic ON ic.producto = f.producto
              INNER JOIN catalogos c ON c.identificador = ic.catalogo
              WHERE c.subasta = s.identificador
              ORDER BY ic.identificador, f.identificador) as fotoPrimerItem
      FROM subastas s
      LEFT JOIN subastadores sub ON sub.identificador = s.subastador
      LEFT JOIN personas p ON p.identificador = sub.identificador
      WHERE 1=1
    `;
    const request = pool.request();

    if (estado) {
      query += ' AND s.estado = @estado';
      request.input('estado', estado);
    }
    if (categoria) {
      query += ' AND s.categoria = @categoria';
      request.input('categoria', categoria);
    }

    query += ' ORDER BY s.fecha DESC, s.hora DESC, s.identificador DESC';
    query += ' OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY';
    request.input('offset', offset);
    request.input('limit', limit);

    const result = await request.query(query);

    // Total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM subastas WHERE 1=1';
    const countReq = pool.request();
    if (estado) { countQuery += ' AND estado = @estado'; countReq.input('estado', estado); }
    if (categoria) { countQuery += ' AND categoria = @categoria'; countReq.input('categoria', categoria); }
    const countResult = await countReq.query(countQuery);

    // Convert foto to base64 if present
    const subastas = result.recordset.map((s: any) => ({
      ...s,
      fotoPrimerItem: s.fotoPrimerItem 
        ? `data:image/jpeg;base64,${Buffer.from(s.fotoPrimerItem).toString('base64')}`
        : null,
    }));

    res.json({
      success: true,
      data: {
        subastas,
        total: countResult.recordset[0].total,
        page,
        limit,
      },
    });
  } catch (error) {
    console.error('Error getSubastas:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// T304: GET /subastas/:id/catalogo
export async function getCatalogo(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const isAuthenticated = !!req.user;

    const pool = await connectDB();

    // Obtener items del catalogo
    const priceField = isAuthenticated
      ? 'ic.precioBase, ic.comision,'
      : '';

    const result = await pool.request()
      .input('subastaId', id)
      .query(`
        SELECT ic.identificador, ic.subastado,
               ${priceField}
               pr.identificador as productoId,
               pr.descripcionCatalogo, pr.descripcionCompleta,
               pr.fecha as fechaProducto,
               pe.nombre as duenioNombre,
               c.descripcion as catalogoDescripcion,
               (SELECT TOP 1 f.identificador FROM fotos f WHERE f.producto = pr.identificador) as fotoId
        FROM itemsCatalogo ic
        INNER JOIN catalogos c ON c.identificador = ic.catalogo
        INNER JOIN productos pr ON pr.identificador = ic.producto
        INNER JOIN duenios d ON d.identificador = pr.duenio
        INNER JOIN personas pe ON pe.identificador = d.identificador
        WHERE c.subasta = @subastaId
        ORDER BY ic.identificador
      `);

    const items = result.recordset;

    const productoIds = items
      .map((i: any) => i.productoId)
      .filter((v: any) => typeof v === 'number');

    const fotoMap = new Map<number, string>();

    if (productoIds.length > 0) {
      const fotosResult = await pool.request()
        .query(`
          SELECT f.producto, f.foto, f.identificador
          FROM fotos f
          INNER JOIN (
            SELECT producto, MIN(identificador) as minId
            FROM fotos
            WHERE producto IN (${productoIds.join(',')})
            GROUP BY producto
          ) ff ON ff.producto = f.producto AND ff.minId = f.identificador
        `);

      for (const row of fotosResult.recordset) {
        fotoMap.set(row.producto, `data:image/jpeg;base64,${Buffer.from(row.foto).toString('base64')}`);
      }
    }

    const withFotos = items.map((item: any) => ({
      ...item,
      fotoData: fotoMap.get(item.productoId) || null,
    }));

    res.json({ success: true, data: withFotos });
  } catch (error) {
    console.error('Error getCatalogo:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// T306: GET /items/:id
export async function getItemDetalle(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const isAuthenticated = !!req.user;

    const pool = await connectDB();

    const priceField = isAuthenticated ? 'ic.precioBase, ic.comision,' : '';

    const result = await pool.request()
      .input('id', id)
      .query(`
        SELECT ic.identificador, ic.subastado,
               ${priceField}
               pr.identificador as productoId,
               pr.descripcionCatalogo, pr.descripcionCompleta,
               pr.fecha as fechaProducto, pr.disponible,
               pr.esObraDisenador, pr.nombreArtistaDisenador, pr.fechaObjeto, pr.historiaObjeto,
               pe.nombre as duenioNombre,
               c.descripcion as catalogoDescripcion,
               s.identificador as subastaId, s.fecha as subastaFecha,
               s.hora as subastaHora, s.categoria as subastaCat, s.moneda
        FROM itemsCatalogo ic
        INNER JOIN catalogos c ON c.identificador = ic.catalogo
        INNER JOIN subastas s ON s.identificador = c.subasta
        INNER JOIN productos pr ON pr.identificador = ic.producto
        INNER JOIN duenios d ON d.identificador = pr.duenio
        INNER JOIN personas pe ON pe.identificador = d.identificador
        WHERE ic.identificador = @id
      `);

    if (result.recordset.length === 0) {
      res.status(404).json({ success: false, error: 'Item no encontrado' });
      return;
    }

    // Obtener fotos
    const fotos = await pool.request()
      .input('productoId', result.recordset[0].productoId)
      .query('SELECT identificador, foto FROM fotos WHERE producto = @productoId ORDER BY identificador');

    const item = {
      ...result.recordset[0],
      fotos: fotos.recordset.map((f: any) => `data:image/jpeg;base64,${Buffer.from(f.foto).toString('base64')}`),
    };

    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Error getItemDetalle:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}
