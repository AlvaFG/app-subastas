import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { connectDB } from '../models/db';
import { CATEGORY_ORDER } from '../utils/category';

// Capa administrativa/interna (A5/A6/A7/A9). Todas las rutas que montan estas
// funciones van protegidas por authGuard + adminGuard, por lo que req.user.id es
// el identificador del empleado autenticado (no un cliente).

// ─── Clientes: admision y categoria (A5) ───

// GET /admin/clientes?admitido=si|no
export async function listClientes(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { admitido } = req.query;
    const pool = await connectDB();
    const request = pool.request();
    let filter = '';
    if (admitido === 'si' || admitido === 'no') {
      filter = 'WHERE c.admitido = @admitido';
      request.input('admitido', admitido);
    }

    const result = await request.query(`
      SELECT c.identificador, p.nombre, p.apellido, p.documento, c.email,
             c.admitido, c.categoria, c.numeroPais, c.fechaAprobacion, c.admitidoPor
      FROM clientes c
      INNER JOIN personas p ON p.identificador = c.identificador
      ${filter}
      ORDER BY c.identificador DESC
    `);

    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error listClientes:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// PATCH /admin/clientes/:id/admitir  { admitido: 'si'|'no', categoria? }
export async function admitirCliente(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { admitido, categoria } = req.body;

    if (admitido !== 'si' && admitido !== 'no') {
      res.status(400).json({ success: false, error: 'Valor de admitido invalido' });
      return;
    }
    if (categoria !== undefined && !CATEGORY_ORDER.includes(categoria)) {
      res.status(400).json({ success: false, error: 'Categoria invalida' });
      return;
    }

    const pool = await connectDB();
    const request = pool.request()
      .input('id', id)
      .input('admitido', admitido)
      .input('admitidoPor', req.user!.id);

    // Solo actualiza categoria si se envia; al rechazar se mantiene la actual.
    const setCategoria = categoria !== undefined ? ', categoria = @categoria' : '';
    if (categoria !== undefined) request.input('categoria', categoria);

    const result = await request.query(`
      UPDATE clientes
      SET admitido = @admitido, admitidoPor = @admitidoPor, fechaAprobacion = GETDATE()${setCategoria}
      WHERE identificador = @id
    `);

    if (result.rowsAffected[0] === 0) {
      res.status(404).json({ success: false, error: 'Cliente no encontrado' });
      return;
    }

    res.json({ success: true, data: { mensaje: admitido === 'si' ? 'Cliente admitido' : 'Cliente rechazado' } });
  } catch (error) {
    console.error('Error admitirCliente:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// PATCH /admin/clientes/:id/categoria  { categoria }
export async function asignarCategoria(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { categoria } = req.body;

    if (!CATEGORY_ORDER.includes(categoria)) {
      res.status(400).json({ success: false, error: 'Categoria invalida' });
      return;
    }

    const pool = await connectDB();
    const result = await pool.request()
      .input('id', id)
      .input('categoria', categoria)
      .query('UPDATE clientes SET categoria = @categoria WHERE identificador = @id');

    if (result.rowsAffected[0] === 0) {
      res.status(404).json({ success: false, error: 'Cliente no encontrado' });
      return;
    }

    res.json({ success: true, data: { mensaje: 'Categoria asignada', categoria } });
  } catch (error) {
    console.error('Error asignarCategoria:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// ─── Medios de pago: verificacion por la empresa (A6) ───

// GET /admin/medios-pago?verificado=si|no
export async function listMediosPago(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { verificado } = req.query;
    const pool = await connectDB();
    const request = pool.request();
    let filter = "WHERE m.activo = 'si'";
    if (verificado === 'si' || verificado === 'no') {
      filter += ' AND m.verificado = @verificado';
      request.input('verificado', verificado);
    }

    const result = await request.query(`
      SELECT m.identificador, m.cliente, p.nombre as clienteNombre, m.tipo, m.descripcion,
             m.banco, m.moneda, m.internacional, m.montoCheque, m.montoDisponible,
             m.verificado, m.verificadorId
      FROM mediosDePago m
      INNER JOIN personas p ON p.identificador = m.cliente
      ${filter}
      ORDER BY m.identificador DESC
    `);

    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error listMediosPago:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// PUT /admin/medios-pago/:id/verificar  { verificado: 'si'|'no' }
export async function verificarMedioPago(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { verificado } = req.body;

    if (verificado !== 'si' && verificado !== 'no') {
      res.status(400).json({ success: false, error: 'Valor de verificado invalido' });
      return;
    }

    const pool = await connectDB();
    // A6: la empresa verifica el medio de CUALQUIER cliente (no se filtra por dueño).
    const result = await pool.request()
      .input('id', id)
      .input('verificado', verificado)
      .input('verificadorId', req.user!.id)
      .query(`
        UPDATE mediosDePago
        SET verificado = @verificado, verificadorId = @verificadorId
        WHERE identificador = @id
      `);

    if (result.rowsAffected[0] === 0) {
      res.status(404).json({ success: false, error: 'Medio de pago no encontrado' });
      return;
    }

    res.json({ success: true, data: { mensaje: 'Estado de verificacion actualizado', verificado } });
  } catch (error) {
    console.error('Error verificarMedioPago (admin):', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// ─── Solicitudes de venta: inspeccion y respuesta de la empresa (A9) ───

// GET /admin/venta/solicitudes?estado=
export async function listSolicitudes(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { estado } = req.query;
    const pool = await connectDB();
    const request = pool.request();
    let filter = '';
    const estadosValidos = ['pendiente', 'en_inspeccion', 'aceptada', 'rechazada', 'devuelta'];
    if (typeof estado === 'string' && estadosValidos.includes(estado)) {
      filter = 'WHERE s.estado = @estado';
      request.input('estado', estado);
    }

    const result = await request.query(`
      SELECT s.identificador, s.cliente, p.nombre as clienteNombre, s.descripcion,
             s.estado, s.valorBase, s.comisionPropuesta, s.motivoRechazo,
             s.aceptadoPorUsuario, s.moneda, s.fechaSolicitud, s.inspeccionadoEl, s.inspector,
             s.origenLicito
      FROM solicitudesVenta s
      INNER JOIN personas p ON p.identificador = s.cliente
      ${filter}
      ORDER BY s.fechaSolicitud DESC
    `);

    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error listSolicitudes:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// PUT /admin/venta/solicitudes/:id/inspeccionar
export async function inspeccionarSolicitud(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const pool = await connectDB();
    const result = await pool.request()
      .input('id', id)
      .input('inspector', req.user!.id)
      .query(`
        UPDATE solicitudesVenta
        SET estado = 'en_inspeccion', inspeccionadoEl = GETDATE(), inspector = @inspector
        WHERE identificador = @id AND estado = 'pendiente'
      `);

    if (result.rowsAffected[0] === 0) {
      res.status(404).json({ success: false, error: 'Solicitud no encontrada o no esta pendiente' });
      return;
    }

    res.json({ success: true, data: { mensaje: 'Solicitud en inspeccion' } });
  } catch (error) {
    console.error('Error inspeccionarSolicitud:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// PUT /admin/venta/solicitudes/:id/respuesta
//   { acepta: 'si'|'no', valorBase?, comision?, motivoRechazo? }
// La EMPRESA define precio base y comision al aceptar, o rechaza con motivo.
export async function responderSolicitudAdmin(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { acepta, valorBase, comision, motivoRechazo } = req.body;

    if (acepta !== 'si' && acepta !== 'no') {
      res.status(400).json({ success: false, error: 'Debe indicar si acepta o no' });
      return;
    }

    const pool = await connectDB();

    // Solo se puede responder una solicitud pendiente o en inspeccion.
    const check = await pool.request()
      .input('id', id)
      .query(`
        SELECT identificador, cliente, estado FROM solicitudesVenta
        WHERE identificador = @id AND estado IN ('pendiente', 'en_inspeccion')
      `);

    if (check.recordset.length === 0) {
      res.status(404).json({ success: false, error: 'Solicitud no encontrada o ya respondida' });
      return;
    }

    const clienteId = check.recordset[0].cliente;

    if (acepta === 'si') {
      const base = Number(valorBase);
      if (!Number.isFinite(base) || base <= 0) {
        res.status(400).json({ success: false, error: 'Debe definir un precio base valido' });
        return;
      }
      const comisionFinal = Number.isFinite(Number(comision)) && Number(comision) >= 0
        ? Number(comision)
        : +(base * 0.10).toFixed(2);

      await pool.request()
        .input('id', id)
        .input('valorBase', base)
        .input('comision', comisionFinal)
        .query(`
          UPDATE solicitudesVenta
          SET estado = 'aceptada', valorBase = @valorBase, comisionPropuesta = @comision,
              aceptadoPorUsuario = NULL, motivoRechazo = NULL
          WHERE identificador = @id
        `);

      await pool.request()
        .input('cliente', clienteId)
        .input('mensaje', `Su solicitud fue aceptada. Precio base: ${base.toFixed(2)}, comision: ${comisionFinal.toFixed(2)}. Revise y acepte o rechace las condiciones en "Mis Solicitudes".`)
        .query(`
          INSERT INTO notificaciones (cliente, tipo, titulo, mensaje)
          VALUES (@cliente, 'sistema', 'Solicitud aceptada', @mensaje)
        `);

      res.json({ success: true, data: { mensaje: 'Solicitud aceptada con condiciones definidas', valorBase: base, comision: comisionFinal } });
    } else {
      await pool.request()
        .input('id', id)
        .input('motivo', motivoRechazo || 'No cumple los criterios de la empresa')
        .query(`
          UPDATE solicitudesVenta
          SET estado = 'rechazada', motivoRechazo = @motivo
          WHERE identificador = @id
        `);

      await pool.request()
        .input('cliente', clienteId)
        .input('mensaje', `Su solicitud fue rechazada. Motivo: ${motivoRechazo || 'No cumple los criterios de la empresa'}. El bien sera devuelto con cargo.`)
        .query(`
          INSERT INTO notificaciones (cliente, tipo, titulo, mensaje)
          VALUES (@cliente, 'sistema', 'Solicitud rechazada', @mensaje)
        `);

      res.json({ success: true, data: { mensaje: 'Solicitud rechazada' } });
    }
  } catch (error) {
    console.error('Error responderSolicitudAdmin:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// ─── Multas: alta manual por la empresa (A7) ───

// POST /admin/multas  { cliente, subasta, item, importeOriginal, moneda? }
export async function crearMultaAdmin(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { cliente, subasta, item, importeOriginal, moneda } = req.body;

    const importeBase = Number(importeOriginal);
    if (!Number.isFinite(importeBase) || importeBase <= 0) {
      res.status(400).json({ success: false, error: 'importeOriginal invalido' });
      return;
    }

    const importeMulta = +(importeBase * 0.10).toFixed(2);
    const fechaLimite = new Date();
    fechaLimite.setHours(fechaLimite.getHours() + 72);
    const monedaFinal = moneda === 'USD' ? 'USD' : 'ARS';

    const pool = await connectDB();

    await pool.request()
      .input('cliente', cliente)
      .input('subasta', subasta)
      .input('item', item)
      .input('importeOriginal', importeBase)
      .input('importeMulta', importeMulta)
      .input('fechaLimite', fechaLimite)
      .input('moneda', monedaFinal)
      .query(`
        INSERT INTO multas (cliente, subasta, item, importeOriginal, importeMulta, fechaLimite, moneda)
        VALUES (@cliente, @subasta, @item, @importeOriginal, @importeMulta, @fechaLimite, @moneda)
      `);

    await pool.request()
      .input('cliente', cliente)
      .input('mensaje', `Se le aplico una multa de ${monedaFinal} ${importeMulta.toFixed(2)} (10% de ${monedaFinal} ${importeBase.toFixed(2)}). Tiene 72hs para presentar los fondos.`)
      .query(`
        INSERT INTO notificaciones (cliente, tipo, titulo, mensaje)
        VALUES (@cliente, 'multa', 'Multa por impago', @mensaje)
      `);

    res.status(201).json({ success: true, data: { importeMulta, fechaLimite, moneda: monedaFinal } });
  } catch (error) {
    console.error('Error crearMultaAdmin:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}
