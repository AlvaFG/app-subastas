import { Response } from 'express';
import crypto from 'crypto';
import sql from 'mssql';
import { AuthRequest } from '../middleware/auth';
import { connectDB } from '../models/db';
import { CATEGORY_ORDER } from '../utils/category';
import { getWebUrl } from '../config/env';
import { sendAdmissionEmail, sendRejectionEmail } from '../services/email';
import { scheduleAuctionClose } from '../socket/auctionHandler';

// Ventana de validez del token de activacion enviado en el mail de admision.
const ACTIVACION_TOKEN_TTL_DIAS = 7;

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

    // Al admitir: generar token de activacion de un solo uso y avisar por mail
    // (TPO: "se le envia un mail informandole que debe completar el registro").
    // Solo si el cliente todavia no creo su clave (registro incompleto).
    if (admitido === 'si') {
      const datos = await pool.request()
        .input('id', id)
        .query(`
          SELECT c.email, c.claveHash, p.nombre
          FROM clientes c
          INNER JOIN personas p ON p.identificador = c.identificador
          WHERE c.identificador = @id
        `);
      const cliente = datos.recordset[0];

      if (cliente && !cliente.claveHash && cliente.email) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expira = new Date(Date.now() + ACTIVACION_TOKEN_TTL_DIAS * 24 * 60 * 60 * 1000);

        await pool.request()
          .input('id', id).input('hash', tokenHash).input('expira', expira)
          .query(`UPDATE clientes
                  SET activacionTokenHash = @hash, activacionTokenExpira = @expira
                  WHERE identificador = @id`);

        // Notificacion in-app (ademas del mail).
        await pool.request()
          .input('cliente', id)
          .query(`INSERT INTO notificaciones (cliente, tipo, titulo, mensaje)
                  VALUES (@cliente, 'sistema', 'Cuenta admitida',
                          'Tu cuenta fue admitida. Revisa tu email para crear tu clave y completar el registro.')`);

        // Best-effort: un fallo de envio no debe romper la admision.
        const activationUrl = `${getWebUrl()}/register/step2?token=${rawToken}`;
        await sendAdmissionEmail(cliente.email, activationUrl, cliente.nombre);
      }
    }

    res.json({ success: true, data: { mensaje: admitido === 'si' ? 'Cliente admitido' : 'Cliente rechazado' } });
  } catch (error) {
    console.error('Error admitirCliente:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// DELETE /admin/clientes/:id — rechaza una solicitud de registro: borra al cliente
// y todos sus datos, y le avisa por mail. Solo aplica a solicitudes (cuentas sin
// clave creada). En la base quedan unicamente clientes reales ya completos.
export async function rechazarCliente(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const pool = await connectDB();

    const datos = await pool.request()
      .input('id', id)
      .query(`
        SELECT c.email, c.claveHash, p.nombre
        FROM clientes c
        INNER JOIN personas p ON p.identificador = c.identificador
        WHERE c.identificador = @id
      `);

    if (datos.recordset.length === 0) {
      res.status(404).json({ success: false, error: 'Cliente no encontrado' });
      return;
    }

    const cliente = datos.recordset[0];
    // No borramos cuentas ya completas (registro terminado): el rechazo es solo
    // para solicitudes pendientes. Una cuenta activa se gestiona por otra via.
    if (cliente.claveHash) {
      res.status(400).json({
        success: false,
        error: 'No se puede rechazar un cliente que ya completo su registro',
      });
      return;
    }

    // Borrar datos asociados antes del cliente/persona (respeta las FK).
    for (const tabla of ['sesiones', 'notificaciones', 'mediosDePago', 'documentosCliente']) {
      await pool.request().input('id', id)
        .query(`DELETE FROM ${tabla} WHERE cliente = @id`);
    }
    await pool.request().input('id', id).query('DELETE FROM clientes WHERE identificador = @id');
    await pool.request().input('id', id).query('DELETE FROM personas WHERE identificador = @id');

    // Aviso por mail (best-effort: no bloquea el rechazo si falla el envio).
    if (cliente.email) {
      await sendRejectionEmail(cliente.email, cliente.nombre);
    }

    res.json({ success: true, data: { mensaje: 'Solicitud rechazada y datos eliminados' } });
  } catch (error) {
    console.error('Error rechazarCliente:', error);
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

// ─── Armado de subastas: el admin elige productos disponibles (Correccion 2) ───

function normalizeHora(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(v)) return v;
  if (/^\d{2}:\d{2}$/.test(v)) return `${v}:00`;
  return null;
}

// GET /admin/productos-disponibles
// Productos cuyo dueño-vendedor ya acordo condiciones (solicitud aceptada -> producto
// creado y disponible) y que todavia NO fueron colocados en ninguna subasta. Esta es
// la lista que el admin usa para ARMAR una subasta.
export async function listProductosDisponibles(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = await connectDB();
    // Una sola consulta: datos del producto + dueño + condiciones acordadas en la
    // solicitud + cantidad de elementos (si es un conjunto) + una foto de portada.
    const result = await pool.request().query(`
      SELECT pr.identificador, pr.descripcionCatalogo, pr.descripcionCompleta, pr.duenio,
             per.nombre AS duenioNombre, per.apellido AS duenioApellido,
             pr.esObraDisenador, pr.nombreArtistaDisenador, pr.fechaObjeto, pr.historiaObjeto,
             s.identificador AS solicitudId, s.valorBase, s.comisionPropuesta, s.moneda,
             (SELECT COUNT(*) FROM productoArticulos pa WHERE pa.producto = pr.identificador) AS cantidadElementos,
             f.foto AS fotoPrincipalBin
      FROM productos pr
      LEFT JOIN solicitudesVenta s ON s.productoId = pr.identificador
      LEFT JOIN personas per ON per.identificador = pr.duenio
      OUTER APPLY (SELECT TOP 1 foto FROM fotos WHERE producto = pr.identificador ORDER BY identificador) f
      WHERE pr.disponible = 'si'
        AND NOT EXISTS (SELECT 1 FROM itemsCatalogo ic WHERE ic.producto = pr.identificador)
      ORDER BY pr.identificador DESC
    `);

    // El binario de la foto no debe salir crudo: se convierte a data URI base64.
    const data = result.recordset.map((row: any) => {
      const { fotoPrincipalBin, ...rest } = row;
      return {
        ...rest,
        cantidadElementos: Number(rest.cantidadElementos || 0),
        fotoPrincipal: fotoPrincipalBin
          ? `data:image/jpeg;base64,${Buffer.from(fotoPrincipalBin).toString('base64')}`
          : null,
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error listProductosDisponibles:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// GET /admin/subastas — listado para la vista administrativa.
export async function listSubastasAdmin(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT s.identificador, s.fecha, s.hora, s.fechaFin, s.horaFin, s.estado,
             s.categoria, s.moneda, s.ubicacion,
             (SELECT COUNT(*) FROM itemsCatalogo ic
                INNER JOIN catalogos c ON c.identificador = ic.catalogo
              WHERE c.subasta = s.identificador) AS cantidadItems
      FROM subastas s
      ORDER BY s.identificador DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error listSubastasAdmin:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// POST /admin/subastas
//   { fecha?, hora?, fechaFin, horaFin, categoria, moneda, ubicacion?, productos: number[] }
// El admin arma una subasta eligiendo 1+ productos disponibles. La subasta abre de
// inmediato (estado 'abierta') y cierra en fechaFin/horaFin (Correccion 1).
export async function crearSubastaAdmin(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { fecha, hora, fechaFin, horaFin, categoria, moneda, ubicacion, productos } = req.body;

    if (!Array.isArray(productos) || productos.length === 0) {
      res.status(400).json({ success: false, error: 'Debe seleccionar al menos un producto' });
      return;
    }
    const productIds = productos.map((p: any) => Number(p)).filter((n) => Number.isInteger(n) && n > 0);
    if (productIds.length === 0) {
      res.status(400).json({ success: false, error: 'Lista de productos invalida' });
      return;
    }

    if (!CATEGORY_ORDER.includes(categoria)) {
      res.status(400).json({ success: false, error: 'Categoria invalida' });
      return;
    }
    const monedaFinal = moneda === 'USD' ? 'USD' : 'ARS';

    // Fin obligatorio. Inicio opcional: por defecto la subasta abre hoy.
    const horaFinNorm = normalizeHora(horaFin);
    if (!fechaFin || !horaFinNorm) {
      res.status(400).json({ success: false, error: 'Debe indicar fecha y hora de fin (HH:MM)' });
      return;
    }
    const finDate = new Date(`${fechaFin}T${horaFinNorm}`);
    if (Number.isNaN(finDate.getTime())) {
      res.status(400).json({ success: false, error: 'Fecha/hora de fin invalida' });
      return;
    }
    if (finDate.getTime() <= Date.now()) {
      res.status(400).json({ success: false, error: 'La fecha/hora de fin debe ser futura' });
      return;
    }

    const hoy = new Date();
    const fechaInicio = typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
      ? fecha
      : hoy.toISOString().split('T')[0];
    const horaInicio = normalizeHora(hora) || `${String(hoy.getHours()).padStart(2, '0')}:${String(hoy.getMinutes()).padStart(2, '0')}:00`;

    const pool = await connectDB();

    // Validar productos: disponibles, no colocados aun, con valorBase definido y de la
    // misma moneda que la subasta (TPO: la subasta no puede ser bimonetaria).
    const placeholders = productIds.map((_, i) => `@p${i}`).join(',');
    const reqCheck = pool.request();
    productIds.forEach((id, i) => reqCheck.input(`p${i}`, id));
    const disponibles = await reqCheck.query(`
      SELECT pr.identificador, s.valorBase, s.comisionPropuesta, s.moneda
      FROM productos pr
      LEFT JOIN solicitudesVenta s ON s.productoId = pr.identificador
      WHERE pr.identificador IN (${placeholders})
        AND pr.disponible = 'si'
        AND NOT EXISTS (SELECT 1 FROM itemsCatalogo ic WHERE ic.producto = pr.identificador)
    `);

    if (disponibles.recordset.length !== productIds.length) {
      res.status(400).json({
        success: false,
        error: 'Uno o mas productos no estan disponibles o ya fueron incluidos en una subasta',
      });
      return;
    }

    for (const p of disponibles.recordset) {
      if (!Number.isFinite(Number(p.valorBase)) || Number(p.valorBase) <= 0) {
        res.status(400).json({ success: false, error: `El producto ${p.identificador} no tiene precio base definido` });
        return;
      }
      const monedaProd = p.moneda === 'USD' ? 'USD' : 'ARS';
      if (monedaProd !== monedaFinal) {
        res.status(400).json({
          success: false,
          error: `El producto ${p.identificador} es en ${monedaProd}; la subasta es en ${monedaFinal}. Una subasta no puede ser bimonetaria.`,
        });
        return;
      }
    }

    // Responsable del catalogo: el empleado admin autenticado. Defensivo: si su id no
    // existe en empleados, usar el primer empleado disponible.
    let responsable = req.user!.id;
    const empCheck = await pool.request()
      .input('id', responsable)
      .query('SELECT identificador FROM empleados WHERE identificador = @id');
    if (empCheck.recordset.length === 0) {
      const anyEmp = await pool.request().query('SELECT TOP 1 identificador FROM empleados ORDER BY identificador');
      if (anyEmp.recordset.length === 0) {
        res.status(400).json({ success: false, error: 'No hay empleados configurados en el sistema' });
        return;
      }
      responsable = anyEmp.recordset[0].identificador;
    }

    const tx = new sql.Transaction(pool);
    await tx.begin();
    let subastaId: number;
    let catalogoId: number;
    try {
      const subastaResult = await new sql.Request(tx)
        .input('fecha', fechaInicio)
        .input('hora', horaInicio)
        .input('fechaFin', fechaFin)
        .input('horaFin', horaFinNorm)
        .input('estado', 'abierta')
        .input('ubicacion', typeof ubicacion === 'string' && ubicacion.trim() ? ubicacion.trim() : 'Centro de Remates')
        .input('tieneDeposito', 'si')
        .input('seguridadPropia', 'si')
        .input('categoria', categoria)
        .input('moneda', monedaFinal)
        .query(`
          INSERT INTO subastas (fecha, hora, fechaFin, horaFin, estado, ubicacion, tieneDeposito, seguridadPropia, categoria, moneda)
          OUTPUT INSERTED.identificador
          VALUES (@fecha, @hora, @fechaFin, @horaFin, @estado, @ubicacion, @tieneDeposito, @seguridadPropia, @categoria, @moneda)
        `);
      subastaId = subastaResult.recordset[0].identificador;

      const catalogoResult = await new sql.Request(tx)
        .input('subasta', subastaId)
        .input('descripcion', 'Catalogo de subasta')
        .input('responsable', responsable)
        .query(`
          INSERT INTO catalogos (subasta, descripcion, responsable)
          OUTPUT INSERTED.identificador
          VALUES (@subasta, @descripcion, @responsable)
        `);
      catalogoId = catalogoResult.recordset[0].identificador;

      for (const p of disponibles.recordset) {
        const precioBase = Number(p.valorBase);
        const comision = Number.isFinite(Number(p.comisionPropuesta)) && Number(p.comisionPropuesta) > 0
          ? Number(p.comisionPropuesta)
          : +(precioBase * 0.10).toFixed(2);
        await new sql.Request(tx)
          .input('catalogo', catalogoId)
          .input('producto', p.identificador)
          .input('precioBase', precioBase)
          .input('comision', comision)
          .input('subastado', 'no')
          .query(`
            INSERT INTO itemsCatalogo (catalogo, producto, precioBase, comision, subastado)
            VALUES (@catalogo, @producto, @precioBase, @comision, @subastado)
          `);
      }

      await tx.commit();
    } catch (txErr) {
      try { await tx.rollback(); } catch { /* ya revertida */ }
      throw txErr;
    }

    // Programar el cierre automatico de la subasta al llegar fechaFin/horaFin.
    scheduleAuctionClose(subastaId, finDate);

    res.status(201).json({
      success: true,
      data: { identificador: subastaId, items: disponibles.recordset.length, fin: finDate.toISOString() },
    });
  } catch (error) {
    console.error('Error crearSubastaAdmin:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}
