import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import sql from 'mssql';
import { connectDB } from '../models/db';
import { AuthPayload } from '../middleware/auth';
import { createWinnerNotification } from '../controllers/notificacionesController';
import { recalcularCategoria } from '../services/categoryService';
import { canParticipateInAuction } from '../utils/category';
import { getJwtSecret } from '../config/env';

// Número de país considerado "local" para el costo de envío (REQ-05).
// Si no se configura, todos los envíos se tratan como domésticos.
const LOCAL_COUNTRY_NUMERO = process.env.LOCAL_COUNTRY_NUMERO
  ? parseInt(process.env.LOCAL_COUNTRY_NUMERO, 10)
  : null;

/**
 * Costo de envío a la dirección declarada del ganador (REQ-05 / BLOG-09).
 * Simplificación académica documentada: sin tabla de tarifas de transporte, se
 * usa una tasa sobre el importe diferenciando envío doméstico vs internacional.
 */
function calcularCostoEnvio(importe: number, esInternacional: boolean): number {
  const tasa = esInternacional ? 0.08 : 0.03;
  return +(importe * tasa).toFixed(2);
}

// Track: userId -> subastaId (T402: max 1 subasta por usuario)
const userConnections = new Map<number, number>();
// Track: itemId -> pending payment winner data
const pendingPayments = new Map<number, {
  subastaId: number;
  itemId: number;
  pujoId: number;
  clienteId: number;
  ganadorNombre: string;
  duenioId: number;
  productoId: number;
  importe: number;
  comision: number;
  costoEnvio: number;
  moneda: string;
}>();

// Correccion 1: la subasta cierra en una fecha/hora de fin definida por la empresa,
// NO por inactividad. Todos los items quedan abiertos hasta ese momento; al cerrar,
// cada item se adjudica a su mejor postor.
// Track: subastaId -> epoch ms de cierre programado
const auctionEndAt = new Map<number, number>();
// Track: subastaId -> timer de cierre programado
const auctionCloseTimers = new Map<number, NodeJS.Timeout>();

// Referencia al servidor de sockets para poder programar cierres desde fuera del
// handler (p.ej. cuando el admin crea una subasta).
let ioRef: Server | null = null;

// setTimeout desborda con delays mayores a ~24.8 dias (2^31 ms) y dispara de
// inmediato. Como una subasta puede cerrar dentro de varias semanas, encadenamos
// timers en tramos seguros.
const MAX_TIMEOUT_MS = 2_147_483_000;

function setLongTimeout(delayMs: number, cb: () => void): NodeJS.Timeout {
  if (delayMs <= MAX_TIMEOUT_MS) {
    return setTimeout(cb, Math.max(0, delayMs));
  }
  return setTimeout(() => setLongTimeout(delayMs - MAX_TIMEOUT_MS, cb), MAX_TIMEOUT_MS);
}

// W6: mensajes por codigo de bloqueo de puja. El frontend usa el code para la UI;
// este texto es el fallback legible.
export const BID_REASON_MESSAGES: Record<string, string> = {
  BLOCKED_INACTIVITY: 'Tu cuenta esta bloqueada',
  REGISTRATION_INCOMPLETE: 'Tu registro aun no fue admitido por la empresa',
  UNPAID_PENALTY: 'Tenes multas impagas. Debes abonarlas antes de pujar',
  CATEGORY_INSUFFICIENT: 'Tu categoria no permite ofertar en esta subasta',
  PAYMENT_METHOD_MISSING: 'No tenes ningun medio de pago registrado',
  PAYMENT_METHOD_UNVERIFIED: 'Tu medio de pago esta pendiente de verificacion por la empresa',
};

function clearAuctionState(subastaId: number) {
  const timer = auctionCloseTimers.get(subastaId);
  if (timer) {
    clearTimeout(timer);
    auctionCloseTimers.delete(subastaId);
  }
  auctionEndAt.delete(subastaId);
  for (const [itemId, pending] of pendingPayments.entries()) {
    if (pending.subastaId === subastaId) {
      pendingPayments.delete(itemId);
    }
  }
}

/**
 * Devuelve fecha/hora de fin (epoch ms) de una subasta a partir de fechaFin/horaFin.
 * null si la subasta no tiene fin definido.
 */
async function getAuctionEnd(pool: sql.ConnectionPool, subastaId: number): Promise<number | null> {
  const r = await pool.request()
    .input('id', subastaId)
    .query(`
      SELECT CONVERT(varchar(10), fechaFin, 23) AS fechaFinStr,
             CONVERT(varchar(8), horaFin, 108) AS horaFinStr
      FROM subastas WHERE identificador = @id
    `);
  if (r.recordset.length === 0) return null;
  const { fechaFinStr, horaFinStr } = r.recordset[0];
  if (!fechaFinStr || !horaFinStr) return null;
  const ms = new Date(`${fechaFinStr}T${horaFinStr}`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Items del catalogo de una subasta con su mejor oferta actual. Es lo que ve el
 * usuario al entrar: todos los items abiertos, con quien va ganando y por cuanto.
 */
async function getAuctionItems(pool: sql.ConnectionPool, subastaId: number): Promise<any[]> {
  const items = await pool.request()
    .input('subastaId', subastaId)
    .query(`
      SELECT ic.identificador, ic.precioBase, ic.subastado,
             pr.descripcionCatalogo
      FROM itemsCatalogo ic
      INNER JOIN catalogos c ON c.identificador = ic.catalogo
      INNER JOIN productos pr ON pr.identificador = ic.producto
      WHERE c.subasta = @subastaId
      ORDER BY ic.identificador
    `);

  const result: any[] = [];
  for (const it of items.recordset) {
    const best = await pool.request()
      .input('item', it.identificador)
      .query(`
        SELECT TOP 1 p.importe, pe.nombre AS postorNombre, a.cliente AS postorId
        FROM pujos p
        INNER JOIN asistentes a ON a.identificador = p.asistente
        INNER JOIN clientes c ON c.identificador = a.cliente
        INNER JOIN personas pe ON pe.identificador = c.identificador
        WHERE p.item = @item
        ORDER BY p.importe DESC, p.fechaPuja DESC, p.identificador DESC
      `);
    const countRes = await pool.request()
      .input('item', it.identificador)
      .query('SELECT COUNT(*) AS count FROM pujos WHERE item = @item');

    result.push({
      identificador: it.identificador,
      precioBase: it.precioBase,
      descripcionCatalogo: it.descripcionCatalogo,
      subastado: it.subastado,
      bestBid: best.recordset[0]
        ? { importe: best.recordset[0].importe, postorNombre: best.recordset[0].postorNombre, postorId: best.recordset[0].postorId }
        : null,
      totalBids: countRes.recordset[0].count,
    });
  }
  return result;
}

async function getCurrentBestBid(pool: any, itemId: number) {
  const bestBid = await pool.request()
    .input('item', itemId)
    .query(`
      SELECT TOP 1 p.identificador as bidId, p.importe, pe.nombre as postorNombre, a.cliente as postorId
      FROM pujos p
      INNER JOIN asistentes a ON a.identificador = p.asistente
      INNER JOIN clientes c ON c.identificador = a.cliente
      INNER JOIN personas pe ON pe.identificador = c.identificador
      WHERE p.item = @item
      ORDER BY p.importe DESC, p.fechaPuja DESC, p.identificador DESC
    `);

  return bestBid.recordset[0] || null;
}

/**
 * Adjudica un item a su mejor postor (o lo compra la empresa si no hubo pujas).
 * Crea el pago pendiente y notifica al ganador conectado. Se usa al cerrar la
 * subasta (un item por vez) y al cancelar un pago (re-adjudica al siguiente).
 */
async function finalizeItemForPayment(io: Server, subastaId: number, itemId: number): Promise<{ success: boolean; noBids?: boolean; error?: string }> {
  const pool = await connectDB();

  const itemStatus = await pool.request()
    .input('item', itemId)
    .input('subastaId', subastaId)
    .query(`
      SELECT ic.subastado
      FROM itemsCatalogo ic
      INNER JOIN catalogos c ON c.identificador = ic.catalogo
      WHERE ic.identificador = @item AND c.subasta = @subastaId
    `);

  if (itemStatus.recordset.length === 0) return { success: false, error: 'Item no encontrado' };
  if (itemStatus.recordset[0].subastado === 'si') return { success: true };

  const winner = await pool.request()
    .input('item', itemId)
    .query(`
      SELECT TOP 1 p.identificador as pujoId, p.importe, p.asistente,
             a.cliente, pe.nombre as ganadorNombre, c.numeroPais,
             ic.precioBase, ic.comision,
             pr.identificador as productoId, pr.duenio,
             s.moneda
      FROM pujos p
      INNER JOIN asistentes a ON a.identificador = p.asistente
      INNER JOIN clientes c ON c.identificador = a.cliente
      INNER JOIN personas pe ON pe.identificador = c.identificador
      INNER JOIN itemsCatalogo ic ON ic.identificador = p.item
      INNER JOIN catalogos ca ON ca.identificador = ic.catalogo
      INNER JOIN subastas s ON s.identificador = ca.subasta
      INNER JOIN productos pr ON pr.identificador = ic.producto
      WHERE p.item = @item
      ORDER BY p.importe DESC, p.fechaPuja ASC, p.identificador ASC
    `);

  if (winner.recordset.length === 0) {
    await pool.request()
      .input('item', itemId)
      .query("UPDATE itemsCatalogo SET subastado = 'si' WHERE identificador = @item");

    // Compra automatica de la empresa a precio base (REQ-18). Nota: registroDeSubasta
    // exige un cliente comprador y la empresa no es un cliente del modelo, por lo que la
    // compra se refleja marcando el item como subastado + evento (limitacion documentada).
    io.to(`auction-${subastaId}`).emit('item-no-bids', { itemId, compraEmpresa: true });
    return { success: true, noBids: true };
  }

  const w = winner.recordset[0];
  const importe = parseFloat(w.importe);
  const comision = parseFloat(w.comision || 0);
  const esInternacional =
    LOCAL_COUNTRY_NUMERO !== null &&
    w.numeroPais != null &&
    Number(w.numeroPais) !== LOCAL_COUNTRY_NUMERO;
  const costoEnvio = calcularCostoEnvio(importe, esInternacional);

  pendingPayments.set(itemId, {
    subastaId,
    itemId,
    pujoId: w.pujoId,
    clienteId: w.cliente,
    ganadorNombre: w.ganadorNombre,
    duenioId: w.duenio,
    productoId: w.productoId,
    importe,
    comision,
    costoEnvio,
    moneda: w.moneda || 'ARS',
  });

  const medios = await pool.request()
    .input('cliente', w.cliente)
    .input('moneda', w.moneda || 'ARS')
    .query(`
      SELECT identificador, tipo, descripcion, moneda, internacional, montoDisponible
      FROM mediosDePago
      WHERE cliente = @cliente AND verificado = 'si' AND activo = 'si'
        AND moneda = @moneda
      ORDER BY identificador DESC
    `);

  io.to(`auction-${subastaId}`).emit('item-closed', {
    itemId,
    ganadorId: w.cliente,
    ganadorNombre: w.ganadorNombre,
    importe,
    pendientePago: true,
  });

  const sockets = await io.in(`auction-${subastaId}`).fetchSockets();
  for (const s of sockets) {
    if ((s as any).user?.id === w.cliente) {
      s.emit('you-won', {
        itemId,
        importe,
        comision,
        costoEnvio,
        total: +(importe + comision + costoEnvio).toFixed(2),
        moneda: w.moneda || 'ARS',
        medios: medios.recordset,
      });
    }
  }

  return { success: true };
}

/**
 * Cierre programado de la subasta (Correccion 1). Marca la subasta como cerrada,
 * adjudica cada item a su mejor postor (o compra de la empresa) y avisa a la sala.
 */
async function closeAuctionAndFinalize(subastaId: number): Promise<void> {
  const io = ioRef;
  if (!io) return;
  const pool = await connectDB();

  const subasta = await pool.request()
    .input('id', subastaId)
    .query("SELECT estado FROM subastas WHERE identificador = @id");
  if (subasta.recordset.length === 0) {
    clearAuctionState(subastaId);
    return;
  }

  // Marcar cerrada para que no se acepten mas pujas.
  await pool.request()
    .input('id', subastaId)
    .query("UPDATE subastas SET estado = 'cerrada' WHERE identificador = @id");

  // Adjudicar cada item pendiente a su mejor postor.
  const items = await pool.request()
    .input('subastaId', subastaId)
    .query(`
      SELECT ic.identificador
      FROM itemsCatalogo ic
      INNER JOIN catalogos c ON c.identificador = ic.catalogo
      WHERE c.subasta = @subastaId AND (ic.subastado = 'no' OR ic.subastado IS NULL)
      ORDER BY ic.identificador
    `);

  for (const it of items.recordset) {
    try {
      await finalizeItemForPayment(io, subastaId, Number(it.identificador));
    } catch (err) {
      console.error(`Error finalizando item ${it.identificador} al cerrar subasta ${subastaId}:`, err);
    }
  }

  const timer = auctionCloseTimers.get(subastaId);
  if (timer) clearTimeout(timer);
  auctionCloseTimers.delete(subastaId);
  auctionEndAt.delete(subastaId);

  io.to(`auction-${subastaId}`).emit('auction-ended', { subastaId });
}

/**
 * Programa (o reprograma) el cierre automatico de una subasta. Exportada para que
 * el admin la invoque al crear la subasta. Si la fecha ya paso, cierra de inmediato.
 */
export function scheduleAuctionClose(subastaId: number, finDate: Date | number): void {
  const finMs = finDate instanceof Date ? finDate.getTime() : finDate;
  if (!Number.isFinite(finMs)) return;

  auctionEndAt.set(subastaId, finMs);

  const existing = auctionCloseTimers.get(subastaId);
  if (existing) clearTimeout(existing);

  const delay = finMs - Date.now();
  if (delay <= 0) {
    closeAuctionAndFinalize(subastaId).catch((e) => console.error('Error cerrando subasta vencida:', e));
    return;
  }

  const timer = setLongTimeout(delay, () => {
    auctionCloseTimers.delete(subastaId);
    closeAuctionAndFinalize(subastaId).catch((e) => console.error('Error en cierre programado:', e));
  });
  auctionCloseTimers.set(subastaId, timer);
}

/**
 * Al iniciar el servidor reprograma los cierres de las subastas abiertas que tengan
 * fin definido (sobrevive a reinicios). Las ya vencidas se cierran en el acto.
 */
export async function scheduleOpenAuctionsFromDB(): Promise<void> {
  try {
    const pool = await connectDB();
    const open = await pool.request().query(`
      SELECT identificador,
             CONVERT(varchar(10), fechaFin, 23) AS fechaFinStr,
             CONVERT(varchar(8), horaFin, 108) AS horaFinStr
      FROM subastas
      WHERE estado = 'abierta' AND fechaFin IS NOT NULL AND horaFin IS NOT NULL
    `);
    for (const row of open.recordset) {
      const ms = new Date(`${row.fechaFinStr}T${row.horaFinStr}`).getTime();
      if (!Number.isNaN(ms)) scheduleAuctionClose(Number(row.identificador), ms);
    }
    if (open.recordset.length > 0) {
      console.log(`[auction] ${open.recordset.length} subasta(s) abierta(s) con cierre programado`);
    }
  } catch (err) {
    console.error('Error reprogramando cierres de subastas:', err);
  }
}

export function setupAuctionSocket(io: Server) {
  ioRef = io;

  // Auth middleware for socket
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Token requerido'));
    }
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as unknown as AuthPayload;
      (socket as any).user = decoded;
      next();
    } catch {
      next(new Error('Token invalido'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user: AuthPayload = (socket as any).user;
    console.log(`Socket auth: ${user.email} (${socket.id})`);

    // T401: Join auction room
    socket.on('join-auction', async (subastaId: number, callback: Function) => {
      try {
        // T402: Check if user is already in another auction
        const currentAuction = userConnections.get(user.id);
        if (currentAuction && currentAuction !== subastaId) {
          callback({ success: false, error: 'Ya estas conectado a otra subasta. Desconectate primero.' });
          return;
        }

        const pool = await connectDB();

        // La subasta debe existir. Se permite entrar si esta abierta o si el usuario
        // tiene un pago pendiente en ella (para poder pagar tras el cierre).
        const subasta = await pool.request()
          .input('id', subastaId)
          .query("SELECT identificador, categoria, estado, moneda FROM subastas WHERE identificador = @id");

        if (subasta.recordset.length === 0) {
          callback({ success: false, error: 'Subasta no encontrada' });
          return;
        }

        const estadoSubasta = subasta.recordset[0].estado;
        const tienePendiente = Array.from(pendingPayments.values())
          .some((p) => p.subastaId === subastaId && p.clienteId === user.id);
        if (estadoSubasta !== 'abierta' && !tienePendiente) {
          callback({ success: false, error: 'Subasta cerrada' });
          return;
        }

        const canBidByCategory = canParticipateInAuction(user.categoria, subasta.recordset[0].categoria);

        // Estado de cuenta y admision revalidados en DB (el token puede estar desactualizado).
        const accountRow = await pool.request()
          .input('cliente', user.id)
          .query(`
            SELECT p.estado, c.admitido
            FROM personas p
            INNER JOIN clientes c ON c.identificador = p.identificador
            WHERE p.identificador = @cliente
          `);
        const account = accountRow.recordset[0] || { estado: 'inactivo', admitido: 'no' };

        // Medios de pago: distinguir "sin medio" de "medio sin verificar" (W6).
        const mediosRow = await pool.request()
          .input('cliente', user.id)
          .query(`
            SELECT
              SUM(CASE WHEN activo = 'si' THEN 1 ELSE 0 END) as activos,
              SUM(CASE WHEN activo = 'si' AND verificado = 'si' THEN 1 ELSE 0 END) as verificados
            FROM mediosDePago WHERE cliente = @cliente
          `);
        const mediosActivos = Number(mediosRow.recordset[0]?.activos || 0);
        const mediosVerificados = Number(mediosRow.recordset[0]?.verificados || 0);

        // Multas impagas.
        const multas = await pool.request()
          .input('cliente', user.id)
          .query("SELECT COUNT(*) as count FROM multas WHERE cliente = @cliente AND pagada = 'no'");
        const hasUnpaidPenalty = multas.recordset[0].count > 0;

        // W6: codigo de bloqueo estable (de mas a menos critico) para que el
        // frontend muestre un mensaje/UI especifico por cada estado.
        let reasonCode: string | null = null;
        if (account.estado === 'inactivo') reasonCode = 'BLOCKED_INACTIVITY';
        else if (account.admitido !== 'si') reasonCode = 'REGISTRATION_INCOMPLETE';
        else if (hasUnpaidPenalty) reasonCode = 'UNPAID_PENALTY';
        else if (!canBidByCategory) reasonCode = 'CATEGORY_INSUFFICIENT';
        else if (mediosActivos === 0) reasonCode = 'PAYMENT_METHOD_MISSING';
        else if (mediosVerificados === 0) reasonCode = 'PAYMENT_METHOD_UNVERIFIED';

        // Solo se puede pujar si la subasta sigue abierta.
        const canBid = reasonCode === null && estadoSubasta === 'abierta';

        // Join room
        socket.join(`auction-${subastaId}`);
        userConnections.set(user.id, subastaId);

        // Asegurar que el cierre este programado (sobrevive a reinicios del server).
        let finMs = auctionEndAt.get(subastaId) ?? null;
        if (finMs === null) {
          finMs = await getAuctionEnd(pool, subastaId);
          if (finMs !== null && estadoSubasta === 'abierta' && !auctionCloseTimers.has(subastaId)) {
            scheduleAuctionClose(subastaId, finMs);
          }
        }

        const items = await getAuctionItems(pool, subastaId);

        callback({
          success: true,
          data: {
            canBid,
            reasonCode,
            reason: reasonCode ? BID_REASON_MESSAGES[reasonCode] : null,
            moneda: subasta.recordset[0].moneda,
            categoria: subasta.recordset[0].categoria,
            estado: estadoSubasta,
            fin: finMs !== null ? new Date(finMs).toISOString() : null,
            items,
          },
        });

        // Notify room
        io.to(`auction-${subastaId}`).emit('user-joined', {
          userId: user.id,
          nombre: user.email,
        });

      } catch (error) {
        console.error('Error join-auction:', error);
        callback({ success: false, error: 'Error interno' });
      }
    });

    // T405: Place bid
    socket.on('place-bid', async (data: { subastaId: number; itemId: number; importe: number }, callback: Function) => {
      try {
        const { subastaId, itemId, importe } = data;
        const pool = await connectDB();

        // Validate bid amount
        if (!Number.isFinite(importe) || importe <= 0) {
          callback({ success: false, error: 'El monto debe ser un numero positivo' });
          return;
        }

        // Verify user is in this auction
        if (userConnections.get(user.id) !== subastaId) {
          callback({ success: false, error: 'No estas conectado a esta subasta' });
          return;
        }

        // Correccion 1: la subasta sigue abierta hasta su fin programado. Rechazar si
        // ya paso el horario de cierre aunque el timer todavia no haya disparado.
        const finMs = auctionEndAt.get(subastaId) ?? await getAuctionEnd(pool, subastaId);
        if (finMs !== null && Date.now() >= finMs) {
          callback({ success: false, error: 'La subasta ya finalizo' });
          return;
        }

        // BSEC-08: revalidar el estado de la cuenta en cada puja, ya que el token
        // no refleja bloqueos aplicados despues de la conexion del socket.
        const accountState = await pool.request()
          .input('cliente', user.id)
          .query("SELECT estado FROM personas WHERE identificador = @cliente");
        if (accountState.recordset.length === 0 || accountState.recordset[0].estado === 'inactivo') {
          callback({ success: false, error: 'Cuenta bloqueada' });
          return;
        }

        // Check unpaid penalties
        const multaCheck = await pool.request()
          .input('cliente', user.id)
          .query("SELECT COUNT(*) as count FROM multas WHERE cliente = @cliente AND pagada = 'no'");
        if (multaCheck.recordset[0].count > 0) {
          callback({ success: false, error: 'Tiene multas impagas. Debe abonarlas antes de pujar.' });
          return;
        }

        // Get item info + auction category
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
          callback({ success: false, error: 'Item no encontrado en esta subasta' });
          return;
        }

        const { precioBase, subastado, categoria, estado } = itemInfo.recordset[0];

        if (estado !== 'abierta') {
          callback({ success: false, error: 'La subasta ya esta cerrada' });
          return;
        }

        if (subastado === 'si') {
          callback({ success: false, error: 'Este item ya fue vendido' });
          return;
        }

        if (!canParticipateInAuction(user.categoria, categoria)) {
          callback({ success: false, error: 'Tu categoria no permite ofertar en esta subasta' });
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
          const duenioIdRaw = ownerRes.recordset[0].duenio;
          const duenioId = Number(duenioIdRaw);
          if (!Number.isNaN(duenioId) && duenioId === Number(user.id)) {
            console.warn(`Rejected bid: user ${user.id} is owner of item ${itemId}`);
            callback({ success: false, error: 'El dueño del producto no puede ofertar en su propia subasta' });
            return;
          }
        }

        const base = parseFloat(precioBase);
        const isHighCategory = categoria === 'oro' || categoria === 'platino';

        // T605 / BLOG-13: medio de pago compatible con la moneda de la subasta.
        // Si la subasta es en USD, exige un medio internacional (transferencia o
        // tarjeta internacional).
        const subastaMoneda = itemInfo.recordset[0].moneda || 'ARS';
        const mediosCompat = await pool.request()
          .input('cliente2', user.id)
          .input('moneda', subastaMoneda)
          .query(`
            SELECT montoDisponible FROM mediosDePago
            WHERE cliente = @cliente2 AND verificado = 'si' AND activo = 'si'
              AND moneda = @moneda
              AND (@moneda <> 'USD' OR internacional = 'si')
          `);

        if (mediosCompat.recordset.length === 0) {
          callback({
            success: false,
            error: subastaMoneda === 'USD'
              ? 'Para subastas en USD necesita un medio de pago internacional'
              : `No tiene medio de pago compatible con moneda ${subastaMoneda}`,
          });
          return;
        }

        // BLOG-06: la puja no puede superar los fondos del medio. Clave para la
        // garantia por cheque (req 21): las compras no superan el monto del cheque.
        // Un medio con montoDisponible NULL (cuenta/tarjeta sin tope) se considera suficiente.
        const fondosIlimitados = mediosCompat.recordset.some((m: any) => m.montoDisponible === null);
        const maxDisponible = mediosCompat.recordset.reduce(
          (max: number, m: any) =>
            m.montoDisponible !== null && parseFloat(m.montoDisponible) > max ? parseFloat(m.montoDisponible) : max,
          0
        );
        if (!fondosIlimitados && maxDisponible < importe) {
          callback({ success: false, error: 'Sus medios de pago (incluido el cheque certificado) no cubren esta puja.' });
          return;
        }

        // BLOG-01 / DB-12: seccion critica atomica. Se serializa por item con
        // bloqueo para que dos pujas concurrentes no lean el mismo "mejor postor"
        // ni dupliquen numeroPostor (req 26: no pujar sin confirmar la anterior).
        const tx = new sql.Transaction(pool);
        await tx.begin();
        let bidId: number;
        try {
          const itemLock = await new sql.Request(tx)
            .input('item', itemId)
            .query("SELECT subastado FROM itemsCatalogo WITH (UPDLOCK, HOLDLOCK) WHERE identificador = @item");
          if (itemLock.recordset.length === 0 || itemLock.recordset[0].subastado === 'si') {
            await tx.rollback();
            callback({ success: false, error: 'Este item ya fue vendido' });
            return;
          }

          const bestBidTx = await new sql.Request(tx)
            .input('item', itemId)
            .query('SELECT TOP 1 importe FROM pujos WITH (UPDLOCK, HOLDLOCK) WHERE item = @item ORDER BY importe DESC, fechaPuja DESC');
          const currentBest = bestBidTx.recordset.length > 0
            ? parseFloat(bestBidTx.recordset[0].importe)
            : base;

          // T404: validar limites de puja contra el mejor postor (ya bloqueado).
          if (importe <= currentBest) {
            await tx.rollback();
            callback({ success: false, error: `La puja debe ser mayor a ${currentBest}` });
            return;
          }
          if (!isHighCategory) {
            const minBid = currentBest + base * 0.01;
            const maxBid = currentBest + base * 0.20;
            if (importe < minBid) {
              await tx.rollback();
              callback({ success: false, error: `Puja minima: ${minBid.toFixed(2)} (ultima + 1% base)` });
              return;
            }
            if (importe > maxBid) {
              await tx.rollback();
              callback({ success: false, error: `Puja maxima: ${maxBid.toFixed(2)} (ultima + 20% base)` });
              return;
            }
          }

          // Asegurar registro de asistente (numeroPostor unico por subasta)
          let asistenteId: number;
          const existingAsistente = await new sql.Request(tx)
            .input('cliente', user.id)
            .input('subasta', subastaId)
            .query('SELECT identificador FROM asistentes WITH (UPDLOCK, HOLDLOCK) WHERE cliente = @cliente AND subasta = @subasta');
          if (existingAsistente.recordset.length > 0) {
            asistenteId = existingAsistente.recordset[0].identificador;
          } else {
            const maxPostor = await new sql.Request(tx)
              .input('subasta', subastaId)
              .query('SELECT COALESCE(MAX(numeroPostor), 0) + 1 as next FROM asistentes WITH (UPDLOCK, HOLDLOCK) WHERE subasta = @subasta');
            const inserted = await new sql.Request(tx)
              .input('numeroPostor', maxPostor.recordset[0].next)
              .input('cliente', user.id)
              .input('subasta', subastaId)
              .query(`
                INSERT INTO asistentes (numeroPostor, cliente, subasta)
                OUTPUT INSERTED.identificador
                VALUES (@numeroPostor, @cliente, @subasta)
              `);
            asistenteId = inserted.recordset[0].identificador;
          }

          const bidResult = await new sql.Request(tx)
            .input('asistente', asistenteId)
            .input('item', itemId)
            .input('importe', importe)
            .query(`
              INSERT INTO pujos (asistente, item, importe)
              OUTPUT INSERTED.identificador
              VALUES (@asistente, @item, @importe)
            `);
          bidId = bidResult.recordset[0].identificador;
          await tx.commit();
        } catch (txError) {
          try { await tx.rollback(); } catch { /* ya revertida */ }
          throw txError;
        }

        // T406: Broadcast a todos los conectados (fuera de la transaccion). El itemId
        // permite que el cliente actualice el "quien va ganando" del item correcto.
        io.to(`auction-${subastaId}`).emit('new-bid', {
          bidId,
          itemId,
          importe,
          postorId: user.id,
          postorNombre: user.email,
          timestamp: new Date().toISOString(),
        });

        callback({ success: true, data: { bidId } });

      } catch (error) {
        console.error('Error place-bid:', error);
        callback({ success: false, error: 'Error al registrar la puja' });
      }
    });

    // Winner selects payment method and confirms payment.
    socket.on('confirm-payment', async (data: { itemId: number; medioPagoId: number; modoEntrega?: 'envio' | 'retiro' }, callback: Function) => {
      try {
        const pending = pendingPayments.get(data.itemId);
        if (!pending) {
          callback({ success: false, error: 'No hay pago pendiente para este item' });
          return;
        }

        if (pending.clienteId !== user.id) {
          callback({ success: false, error: 'Solo el ganador puede confirmar el pago' });
          return;
        }

        const pool = await connectDB();
        const medio = await pool.request()
          .input('medioId', data.medioPagoId)
          .input('cliente', user.id)
          .query(`
            SELECT identificador, tipo, moneda, internacional, montoDisponible
            FROM mediosDePago
            WHERE identificador = @medioId AND cliente = @cliente AND verificado = 'si' AND activo = 'si'
          `);

        if (medio.recordset.length === 0) {
          callback({ success: false, error: 'Medio de pago no valido' });
          return;
        }

        const mp = medio.recordset[0];
        if (mp.moneda !== pending.moneda) {
          callback({ success: false, error: `El medio no es compatible con ${pending.moneda}` });
          return;
        }
        // BLOG-13: pagos en USD requieren medio internacional.
        if (pending.moneda === 'USD' && mp.internacional !== 'si') {
          callback({ success: false, error: 'Para pagos en USD necesita un medio internacional' });
          return;
        }

        // §125: el retiro personal anula el costo de envio y la cobertura del seguro.
        const modoEntrega: 'envio' | 'retiro' = data.modoEntrega === 'retiro' ? 'retiro' : 'envio';
        const costoEnvioFinal = modoEntrega === 'retiro' ? 0 : pending.costoEnvio;
        const seguroComprador = modoEntrega === 'retiro' ? 'no' : 'si';

        const total = +(pending.importe + pending.comision + costoEnvioFinal).toFixed(2);
        const disponible = parseFloat(mp.montoDisponible || 0);

        if (disponible < total) {
          const importeMulta = +(pending.importe * 0.10).toFixed(2);
          const fechaLimite = new Date();
          fechaLimite.setHours(fechaLimite.getHours() + 72);
          const mensajeMulta = `No posee fondos suficientes para pagar su oferta. Multa aplicada: ${importeMulta.toFixed(2)}. Debe pagarla en 72hs.`;

          // Multa + notificacion + marcar item: atomico para no dejar multa huerfana
          // si una de las operaciones falla (review fix). La columna multas.moneda
          // esta garantizada por la migracion 004.
          const multaTx = new sql.Transaction(pool);
          await multaTx.begin();
          try {
            await new sql.Request(multaTx)
              .input('cliente', user.id)
              .input('subasta', pending.subastaId)
              .input('item', pending.itemId)
              .input('importeOriginal', pending.importe)
              .input('importeMulta', importeMulta)
              .input('fechaLimite', fechaLimite)
              .input('moneda', pending.moneda)
              .query(`
                INSERT INTO multas (cliente, subasta, item, importeOriginal, importeMulta, fechaLimite, moneda)
                VALUES (@cliente, @subasta, @item, @importeOriginal, @importeMulta, @fechaLimite, @moneda)
              `);

            await new sql.Request(multaTx)
              .input('cliente', user.id)
              .input('titulo', 'Multa por impago')
              .input('mensaje', mensajeMulta)
              .query(`
                INSERT INTO notificaciones (cliente, tipo, titulo, mensaje)
                VALUES (@cliente, 'multa', @titulo, @mensaje)
              `);

            await new sql.Request(multaTx)
              .input('item', pending.itemId)
              .query("UPDATE itemsCatalogo SET subastado = 'si' WHERE identificador = @item");

            await multaTx.commit();
          } catch (txErr) {
            try { await multaTx.rollback(); } catch { /* ya revertida */ }
            throw txErr;
          }

          pendingPayments.delete(data.itemId);

          io.to(`auction-${pending.subastaId}`).emit('item-payment-defaulted', {
            itemId: pending.itemId,
            subastaId: pending.subastaId,
            multa: importeMulta,
            fechaLimite,
          });

          // A5-03: codigo estable para que el cliente no dependa de parsear el texto.
          callback({ success: false, error: mensajeMulta, code: 'MULTA_APLICADA' });
          return;
        }

        // Verificador (empleado) requerido por la FK de duenios. El seed de la
        // migracion 011 garantiza al menos un empleado; validamos defensivamente.
        const verificadorRow = await pool.request()
          .query('SELECT TOP 1 identificador FROM empleados ORDER BY identificador');
        const verificadorId = verificadorRow.recordset.length > 0 ? verificadorRow.recordset[0].identificador : null;
        if (verificadorId === null) {
          callback({ success: false, error: 'No hay empleados configurados en el sistema' });
          return;
        }

        // Pago atomico: descuento de fondos, ganador, item vendido, alta de duenio,
        // transferencia de propiedad y registro de venta van en una sola transaccion
        // para no dejar estados inconsistentes ante un fallo parcial (review fix).
        const payTx = new sql.Transaction(pool);
        await payTx.begin();
        try {
          await new sql.Request(payTx)
            .input('medioId', data.medioPagoId)
            .input('total', total)
            .query('UPDATE mediosDePago SET montoDisponible = montoDisponible - @total WHERE identificador = @medioId');

          await new sql.Request(payTx)
            .input('pujoId', pending.pujoId)
            .query("UPDATE pujos SET ganador = 'si' WHERE identificador = @pujoId");

          await new sql.Request(payTx)
            .input('item', pending.itemId)
            .query("UPDATE itemsCatalogo SET subastado = 'si' WHERE identificador = @item");

          // Alta del comprador como duenio (idempotente y atomica: evita la carrera
          // check-then-insert si gana y paga dos items casi simultaneamente).
          await new sql.Request(payTx)
            .input('identificador', user.id)
            .input('verificador', verificadorId)
            .query(`
              INSERT INTO duenios (identificador, verificador)
              SELECT @identificador, @verificador
              WHERE NOT EXISTS (SELECT 1 FROM duenios WHERE identificador = @identificador)
            `);

          // TPO §118: el ganador pasa a ser el NUEVO dueno de la pieza. El vendedor
          // original queda registrado en registroDeSubasta.duenio (historico).
          await new sql.Request(payTx)
            .input('producto', pending.productoId)
            .input('duenio', user.id)
            .query('UPDATE productos SET duenio = @duenio WHERE identificador = @producto');

          await new sql.Request(payTx)
            .input('subasta', pending.subastaId)
            .input('duenio', pending.duenioId)
            .input('producto', pending.productoId)
            .input('cliente', user.id)
            .input('importe', pending.importe)
            .input('comision', pending.comision)
            .input('modoEntrega', modoEntrega)
            .input('costoEnvio', costoEnvioFinal)
            .input('seguroComprador', seguroComprador)
            .query(`
              INSERT INTO registroDeSubasta (subasta, duenio, producto, cliente, importe, comision, modoEntrega, costoEnvio, seguroComprador)
              VALUES (@subasta, @duenio, @producto, @cliente, @importe, @comision, @modoEntrega, @costoEnvio, @seguroComprador)
            `);

          await payTx.commit();
        } catch (txErr) {
          try { await payTx.rollback(); } catch { /* ya revertida */ }
          throw txErr;
        }

        io.to(`auction-${pending.subastaId}`).emit('item-sold', {
          itemId: pending.itemId,
          ganadorId: user.id,
          ganadorNombre: pending.ganadorNombre,
          importe: pending.importe,
          comision: pending.comision,
          costoEnvio: costoEnvioFinal,
          modoEntrega,
        });

        await createWinnerNotification(user.id, pending.importe, pending.comision, costoEnvioFinal, pending.moneda, modoEntrega);

        // TPO §53: la actividad (ganar) puede mejorar la categoria del cliente. No bloquea el pago.
        recalcularCategoria(user.id).catch((e) => console.error('Error recalculando categoria:', e));

        pendingPayments.delete(data.itemId);
        callback({ success: true, data: { totalPagado: total, modoEntrega, costoEnvio: costoEnvioFinal } });
      } catch (error) {
        console.error('Error confirm-payment:', error);
        callback({ success: false, error: 'No se pudo confirmar el pago' });
      }
    });

    // Winner cancels payment: remove their winning bid and re-award the item to the
    // next best bidder (or the company if no other bids remain).
    socket.on('cancel-payment', async (data: { itemId: number }, callback: Function) => {
      try {
        const pending = pendingPayments.get(data.itemId);
        if (!pending) {
          callback({ success: false, error: 'No hay pago pendiente para este item' });
          return;
        }

        if (pending.clienteId !== user.id) {
          callback({ success: false, error: 'Solo el ganador puede cancelar el pago' });
          return;
        }

        const pool = await connectDB();
        const subastaId = pending.subastaId;
        const itemId = pending.itemId;

        // Quitar la puja ganadora y liberar el pago pendiente.
        await pool.request()
          .input('pujoId', pending.pujoId)
          .query('DELETE FROM pujos WHERE identificador = @pujoId');
        pendingPayments.delete(data.itemId);

        // Avisar al canceller para que cierre su modal.
        const reopenedBid = await getCurrentBestBid(pool, itemId);
        io.to(`auction-${subastaId}`).emit('item-payment-cancelled', {
          itemId,
          bidId: pending.pujoId,
          bestBid: reopenedBid ? Number(reopenedBid.importe) : null,
          bestBidder: reopenedBid?.postorNombre || '',
        });

        // Re-adjudicar al siguiente mejor postor (o compra de la empresa si no hay).
        await finalizeItemForPayment(io, subastaId, itemId);

        callback({
          success: true,
          data: {
            itemId,
            bestBid: reopenedBid ? Number(reopenedBid.importe) : null,
            bestBidder: reopenedBid?.postorNombre || '',
          },
        });
      } catch (error) {
        console.error('Error cancel-payment:', error);
        callback({ success: false, error: 'No se pudo cancelar el pago' });
      }
    });

    // Leave auction
    socket.on('leave-auction', (subastaId: number) => {
      socket.leave(`auction-${subastaId}`);
      userConnections.delete(user.id);
      io.to(`auction-${subastaId}`).emit('user-left', { userId: user.id });
    });

    // Disconnect cleanup
    socket.on('disconnect', () => {
      const subastaId = userConnections.get(user.id);
      if (subastaId) {
        userConnections.delete(user.id);
        io.to(`auction-${subastaId}`).emit('user-left', { userId: user.id });
      }
    });
  });
}
