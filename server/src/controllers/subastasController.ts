import { Request, Response } from 'express';
import { connectDB } from '../models/db';
import { AuthRequest } from '../middleware/auth';
import { canParticipateInAuction } from '../utils/category';
import sql from 'mssql';

// T305: POST /subastas/:id/bid  (REST wrapper for socket place-bid)
export async function placeBid(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const subastaId = parseInt(String(id), 10);
    const { itemId, importe } = req.body;

    if (!req.user) {
      res.status(401).json({ success: false, error: 'No autenticado' });
      return;
    }

    const user = req.user;

    const pool = await connectDB();

    // Basic validations
    if (!Number.isFinite(importe) || importe <= 0) {
      res.status(400).json({ success: false, error: 'El monto debe ser un numero positivo' });
      return;
    }

    // Get item info + auction
    const itemInfo = await pool.request()
      .input('item', itemId)
      .input('subastaId', subastaId)
      .query(`
        SELECT ic.precioBase, ic.subastado, s.categoria, s.moneda, s.estado
        FROM itemsCatalogo ic
        INNER JOIN catalogos c ON c.identificador = ic.catalogo
        INNER JOIN subastas s ON s.identificador = c.subasta
        WHERE ic.identificador = @item AND s.identificador = @subastaId
      `);

    if (itemInfo.recordset.length === 0) {
      res.status(404).json({ success: false, error: 'Item no encontrado en esta subasta' });
      return;
    }

    const { precioBase, subastado, categoria, estado } = itemInfo.recordset[0];

    if (estado !== 'abierta') {
      res.status(400).json({ success: false, error: 'La subasta ya esta cerrada' });
      return;
    }

    if (subastado === 'si') {
      res.status(400).json({ success: false, error: 'Este item ya fue vendido' });
      return;
    }

    if (!canParticipateInAuction(user.categoria, categoria)) {
      res.status(403).json({ success: false, error: 'Tu categoria no permite ofertar en esta subasta' });
      return;
    }

    // Security: the owner of the product cannot place bids on their own item
    const ownerRes = await pool.request()
      .input('item', itemId)
      .query(`
        SELECT pr.duenio
        FROM itemsCatalogo ic
        INNER JOIN productos pr ON pr.identificador = ic.producto
        WHERE ic.identificador = @item
      `);

    if (ownerRes.recordset.length > 0) {
      const duenioId = Number(ownerRes.recordset[0].duenio);
      if (!Number.isNaN(duenioId) && duenioId === Number(user.id)) {
        res.status(403).json({ success: false, error: 'El dueño del producto no puede ofertar en su propia subasta' });
        return;
      }
    }

    // Get current best bid
    const bestBid = await pool.request()
      .input('item', itemId)
      .query('SELECT TOP 1 importe FROM pujos WHERE item = @item ORDER BY importe DESC');

    const currentBest = bestBid.recordset.length > 0
      ? parseFloat(bestBid.recordset[0].importe)
      : parseFloat(precioBase);

    const base = parseFloat(precioBase);
    const isHighCategory = categoria === 'oro' || categoria === 'platino';

    if (importe <= currentBest) {
      res.status(400).json({ success: false, error: `La puja debe ser mayor a ${currentBest}` });
      return;
    }

    if (!isHighCategory) {
      const minBid = currentBest + (base * 0.01);
      const maxBid = currentBest + (base * 0.20);
      if (importe < minBid) {
        res.status(400).json({ success: false, error: `Puja minima: ${minBid.toFixed(2)} (ultima + 1% base)` });
        return;
      }
      if (importe > maxBid) {
        res.status(400).json({ success: false, error: `Puja maxima: ${maxBid.toFixed(2)} (ultima + 20% base)` });
        return;
      }
    }

    // Validate payment methods compatible with auction currency
    const subastaMoneda = itemInfo.recordset[0].moneda || 'ARS';
    const mediosCompat = await pool.request()
      .input('cliente2', user.id)
      .input('moneda', subastaMoneda)
      .query(`
        SELECT COUNT(*) as count FROM mediosDePago
        WHERE cliente = @cliente2 AND verificado = 'si' AND activo = 'si'
          AND moneda = @moneda
      `);

    if (mediosCompat.recordset[0].count === 0) {
      res.status(400).json({ success: false, error: `No tiene medio de pago compatible con moneda ${subastaMoneda}` });
      return;
    }

    // Get or create asistente
    let asistenteId: number;
    const existingAsistente = await pool.request()
      .input('cliente', user.id)
      .input('subasta', subastaId)
      .query('SELECT identificador FROM asistentes WHERE cliente = @cliente AND subasta = @subasta');

    if (existingAsistente.recordset.length > 0) {
      asistenteId = existingAsistente.recordset[0].identificador;
    } else {
      const maxPostor = await pool.request()
        .input('subasta', subastaId)
        .query('SELECT COALESCE(MAX(numeroPostor), 0) + 1 as next FROM asistentes WHERE subasta = @subasta');

      const result = await pool.request()
        .input('numeroPostor', maxPostor.recordset[0].next)
        .input('cliente', user.id)
        .input('subasta', subastaId)
        .query(`
          INSERT INTO asistentes (numeroPostor, cliente, subasta)
          OUTPUT INSERTED.identificador
          VALUES (@numeroPostor, @cliente, @subasta)
        `);
      asistenteId = result.recordset[0].identificador;
    }

    const bidResult = await pool.request()
      .input('asistente', asistenteId)
      .input('item', itemId)
      .input('importe', importe)
      .query(`
        INSERT INTO pujos (asistente, item, importe)
        OUTPUT INSERTED.identificador
        VALUES (@asistente, @item, @importe)
      `);

    // Try to emit via Socket.IO if available (lazy require to avoid circular imports)
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { io } = require('../index');
      if (io) {
        io.to(`auction-${subastaId}`).emit('new-bid', {
          bidId: bidResult.recordset[0].identificador,
          itemId,
          importe,
          postorId: user.id,
          postorNombre: user.email,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (emitErr) {
      console.warn('No se pudo emitir new-bid por Socket.IO desde endpoint REST:', (emitErr as any)?.message || emitErr);
    }

    res.json({ success: true, data: { bidId: bidResult.recordset[0].identificador } });
  } catch (error) {
    console.error('Error placeBid (REST):', error);
    res.status(500).json({ success: false, error: 'Error al registrar la puja' });
  }
}

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
             (SELECT COALESCE(SUM(CASE WHEN paCount.cantidad > 0 THEN paCount.cantidad ELSE 1 END), 0)
              FROM itemsCatalogo ic
              INNER JOIN catalogos c ON c.identificador = ic.catalogo
              OUTER APPLY (
                SELECT COUNT(*) as cantidad
                FROM productoArticulos pa
                WHERE pa.producto = ic.producto
              ) paCount
              WHERE c.subasta = s.identificador) as totalItems,
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

    const totalPiezasResult = await pool.request()
      .input('subastaId', id)
      .query(`
        SELECT COALESCE(SUM(CASE WHEN paCount.cantidad > 0 THEN paCount.cantidad ELSE 1 END), 0) as totalPiezas
        FROM itemsCatalogo ic
        INNER JOIN catalogos c ON c.identificador = ic.catalogo
        OUTER APPLY (
          SELECT COUNT(*) as cantidad
          FROM productoArticulos pa
          WHERE pa.producto = ic.producto
        ) paCount
        WHERE c.subasta = @subastaId
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

    const totalPiezas = totalPiezasResult.recordset[0]?.totalPiezas || withFotos.length;

    res.json({ success: true, data: withFotos, totalPiezas });
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

    const articulosResult = await pool.request()
      .input('productoId', item.productoId)
      .query(`
        SELECT pa.identificador, pa.orden, pa.descripcion
        FROM productoArticulos pa
        WHERE pa.producto = @productoId
        ORDER BY pa.orden, pa.identificador
      `);

    const fotosArticulosResult = await pool.request()
      .input('productoId', item.productoId)
      .query(`
        SELECT paf.articulo, paf.foto
        FROM productoArticuloFotos paf
        INNER JOIN productoArticulos pa ON pa.identificador = paf.articulo
        WHERE pa.producto = @productoId
        ORDER BY pa.orden, paf.identificador
      `);

    const articulos = articulosResult.recordset.map((articulo: any) => ({
      identificador: articulo.identificador,
      orden: articulo.orden,
      descripcion: articulo.descripcion,
      fotos: fotosArticulosResult.recordset
        .filter((foto: any) => foto.articulo === articulo.identificador)
        .map((foto: any) => `data:image/jpeg;base64,${Buffer.from(foto.foto).toString('base64')}`),
    }));

    res.json({ success: true, data: { ...item, articulos } });
  } catch (error) {
    console.error('Error getItemDetalle:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}
