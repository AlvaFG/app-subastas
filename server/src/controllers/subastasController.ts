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
             (SELECT COUNT(*) FROM catalogos c WHERE c.subasta = s.identificador) as totalItems
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

    query += ' ORDER BY s.fecha DESC, s.hora DESC';
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

    res.json({
      success: true,
      data: {
        subastas: result.recordset,
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

    // T307: Verificar acceso por categoria si autenticado
    if (isAuthenticated) {
      const subasta = await pool.request()
        .input('id', id)
        .query('SELECT categoria FROM subastas WHERE identificador = @id');

      if (subasta.recordset.length === 0) {
        res.status(404).json({ success: false, error: 'Subasta no encontrada' });
        return;
      }

      const order = ['comun', 'especial', 'plata', 'oro', 'platino'];
      const subastaLevel = order.indexOf(subasta.recordset[0].categoria);
      const userLevel = order.indexOf(req.user!.categoria);

      if (userLevel < subastaLevel) {
        res.status(403).json({ success: false, error: 'Tu categoria no permite acceder a esta subasta' });
        return;
      }
    }

    // Obtener items del catalogo
    const priceField = isAuthenticated
      ? 'ic.precioBase, ic.comision,'
      : '';

    const result = await pool.request()
      .input('subastaId', id)
      .query(`
        SELECT ic.identificador, ic.subastado,
               ${priceField}
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

    res.json({ success: true, data: result.recordset });
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
      .query('SELECT identificador FROM fotos WHERE producto = @productoId');

    const item = {
      ...result.recordset[0],
      fotos: fotos.recordset.map((f: any) => f.identificador),
    };

    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Error getItemDetalle:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}
