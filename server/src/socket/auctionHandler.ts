import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { connectDB } from '../models/db';
import { AuthPayload } from '../middleware/auth';
import { createWinnerNotification } from '../controllers/notificacionesController';
import { canParticipateInAuction } from '../utils/category';

// Track: userId -> subastaId (T402: max 1 subasta por usuario)
const userConnections = new Map<number, number>();
// Track: subastaId -> current item being auctioned
const activeItems = new Map<number, number>();
// Track: itemId -> timer for automatic close from first bid
const itemCloseTimers = new Map<number, NodeJS.Timeout>();
// Track: itemId -> timer for auto-buy by company if nobody bids
const itemNoBidTimers = new Map<number, NodeJS.Timeout>();
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

const LAST_BID_CLOSE_MS = 15_000;
const NO_BID_AUTO_BUY_MS = 60 * 60 * 1000;

function clearItemTimers(itemId: number) {
  const closeTimer = itemCloseTimers.get(itemId);
  if (closeTimer) {
    clearTimeout(closeTimer);
    itemCloseTimers.delete(itemId);
  }

  const noBidTimer = itemNoBidTimers.get(itemId);
  if (noBidTimer) {
    clearTimeout(noBidTimer);
    itemNoBidTimers.delete(itemId);
  }
}

function clearAuctionState(subastaId: number) {
  const currentItem = activeItems.get(subastaId);
  if (currentItem) {
    clearItemTimers(currentItem);
  }

  activeItems.delete(subastaId);
  for (const [itemId, pending] of pendingPayments.entries()) {
    if (pending.subastaId === subastaId) {
      pendingPayments.delete(itemId);
    }
  }
}

function scheduleNoBidAutoBuy(io: Server, subastaId: number, itemId: number) {
  if (itemNoBidTimers.has(itemId)) return;

  const timer = setTimeout(async () => {
    try {
      await finalizeItemForPayment(io, subastaId, itemId);
    } catch (error) {
      console.error('Error auto-buying item without bids:', error);
    } finally {
      itemNoBidTimers.delete(itemId);
    }
  }, NO_BID_AUTO_BUY_MS);

  itemNoBidTimers.set(itemId, timer);
  io.to(`auction-${subastaId}`).emit('item-no-bid-scheduled', {
    itemId,
    closeInMs: NO_BID_AUTO_BUY_MS,
  });
}

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
             a.cliente, pe.nombre as ganadorNombre,
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
      ORDER BY p.importe DESC
    `);

  if (winner.recordset.length === 0) {
    clearItemTimers(itemId);

    await pool.request()
      .input('item', itemId)
      .query("UPDATE itemsCatalogo SET subastado = 'si' WHERE identificador = @item");

    clearAuctionState(subastaId);
    io.to(`auction-${subastaId}`).emit('item-no-bids', { itemId, compraEmpresa: true });
    return { success: true, noBids: true };
  }

  const w = winner.recordset[0];
  const importe = parseFloat(w.importe);
  const comision = parseFloat(w.comision || 0);
  const costoEnvio = +(importe * 0.05).toFixed(2);

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

  clearItemTimers(itemId);

  return { success: true };
}

async function closeAuction(io: Server, subastaId: number) {
  const pool = await connectDB();

  await pool.request()
    .input('subastaId', subastaId)
    .query("UPDATE subastas SET estado = 'cerrada' WHERE identificador = @subastaId");

  clearAuctionState(subastaId);

  const sockets = await io.in(`auction-${subastaId}`).fetchSockets();
  for (const s of sockets) {
    s.leave(`auction-${subastaId}`);
    s.emit('auction-closed', { subastaId });
  }
}

export function setupAuctionSocket(io: Server) {
  // Auth middleware for socket
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Token requerido'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as unknown as AuthPayload;
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

        // Verify auction exists and is open
        const subasta = await pool.request()
          .input('id', subastaId)
          .query("SELECT identificador, categoria, estado, moneda FROM subastas WHERE identificador = @id AND estado = 'abierta'");

        if (subasta.recordset.length === 0) {
          callback({ success: false, error: 'Subasta no encontrada o cerrada' });
          return;
        }

        const canBidByCategory = canParticipateInAuction(user.categoria, subasta.recordset[0].categoria);

        // Check if user has verified payment method
        const medios = await pool.request()
          .input('cliente', user.id)
          .query("SELECT COUNT(*) as count FROM mediosDePago WHERE cliente = @cliente AND verificado = 'si' AND activo = 'si'");

        const canBid = medios.recordset[0].count > 0;

        // Check for unpaid penalties
        const multas = await pool.request()
          .input('cliente', user.id)
          .query("SELECT COUNT(*) as count FROM multas WHERE cliente = @cliente AND pagada = 'no'");

        const hasUnpaidPenalty = multas.recordset[0].count > 0;

        // Join room
        socket.join(`auction-${subastaId}`);
        userConnections.set(user.id, subastaId);

        // Get current item and best bid
        let currentItem = activeItems.get(subastaId);

        if (!currentItem) {
          const firstUnsold = await pool.request()
            .input('subastaId', subastaId)
            .query(`
              SELECT TOP 1 ic.identificador
              FROM itemsCatalogo ic
              INNER JOIN catalogos c ON c.identificador = ic.catalogo
              WHERE c.subasta = @subastaId AND (ic.subastado = 'no' OR ic.subastado IS NULL)
              ORDER BY ic.identificador
            `);

          if (firstUnsold.recordset.length > 0) {
            const firstItemId = Number(firstUnsold.recordset[0].identificador);
            if (Number.isFinite(firstItemId)) {
              currentItem = firstItemId;
              activeItems.set(subastaId, firstItemId);
              io.to(`auction-${subastaId}`).emit('active-item-changed', { itemId: firstItemId });
              scheduleNoBidAutoBuy(io, subastaId, firstItemId);
            }
          }
        }

        let currentBidData = null;

        if (currentItem) {
          const bestBid = await pool.request()
            .input('item', currentItem)
            .query(`
              SELECT TOP 1 p.importe, pe.nombre as postorNombre
              FROM pujos p
              INNER JOIN asistentes a ON a.identificador = p.asistente
              INNER JOIN clientes c ON c.identificador = a.cliente
              INNER JOIN personas pe ON pe.identificador = c.identificador
              WHERE p.item = @item
              ORDER BY p.importe DESC
            `);

          const itemInfo = await pool.request()
            .input('item', currentItem)
            .query(`
              SELECT ic.identificador, ic.precioBase, pr.descripcionCatalogo, s.categoria as subastaCat
              FROM itemsCatalogo ic
              INNER JOIN catalogos c ON c.identificador = ic.catalogo
              INNER JOIN subastas s ON s.identificador = c.subasta
              INNER JOIN productos pr ON pr.identificador = ic.producto
              WHERE ic.identificador = @item
            `);

          if (itemInfo.recordset.length > 0) {
            currentBidData = {
              item: itemInfo.recordset[0],
              bestBid: bestBid.recordset[0] || null,
              totalBids: 0,
            };

            const bidCount = await pool.request()
              .input('item', currentItem)
              .query('SELECT COUNT(*) as count FROM pujos WHERE item = @item');
            currentBidData.totalBids = bidCount.recordset[0].count;

            if (bidCount.recordset[0].count === 0 && !itemNoBidTimers.has(currentItem)) {
              scheduleNoBidAutoBuy(io, subastaId, currentItem);
            }
          }
        }

        callback({
          success: true,
          data: {
            canBid: canBidByCategory && canBid && !hasUnpaidPenalty,
            reason: !canBidByCategory
              ? 'Tu categoria no permite ofertar en esta subasta'
              : (hasUnpaidPenalty ? 'Tiene multas impagas' : (!canBid ? 'Sin medio de pago verificado' : null)),
            currentBid: currentBidData,
            moneda: subasta.recordset[0].moneda,
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

        // Get current best bid
        const bestBid = await pool.request()
          .input('item', itemId)
          .query('SELECT TOP 1 importe FROM pujos WHERE item = @item ORDER BY importe DESC');

        const currentBest = bestBid.recordset.length > 0
          ? parseFloat(bestBid.recordset[0].importe)
          : parseFloat(precioBase);

        // T404: Validate bid limits
        const base = parseFloat(precioBase);
        const isHighCategory = categoria === 'oro' || categoria === 'platino';

        if (importe <= currentBest) {
          callback({ success: false, error: `La puja debe ser mayor a ${currentBest}` });
          return;
        }

        if (!isHighCategory) {
          const minBid = currentBest + (base * 0.01);
          const maxBid = currentBest + (base * 0.20);

          if (importe < minBid) {
            callback({ success: false, error: `Puja minima: ${minBid.toFixed(2)} (ultima + 1% base)` });
            return;
          }
          if (importe > maxBid) {
            callback({ success: false, error: `Puja maxima: ${maxBid.toFixed(2)} (ultima + 20% base)` });
            return;
          }
        }

        // T605: Validate payment method currency matches auction
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
          callback({ success: false, error: `No tiene medio de pago compatible con moneda ${subastaMoneda}` });
          return;
        }

        // Get or create asistente record
        let asistenteId: number;
        const existingAsistente = await pool.request()
          .input('cliente', user.id)
          .input('subasta', subastaId)
          .query('SELECT identificador FROM asistentes WHERE cliente = @cliente AND subasta = @subasta');

        if (existingAsistente.recordset.length > 0) {
          asistenteId = existingAsistente.recordset[0].identificador;
        } else {
          // Generate postor number
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

        // Insert bid
        const bidResult = await pool.request()
          .input('asistente', asistenteId)
          .input('item', itemId)
          .input('importe', importe)
          .query(`
            INSERT INTO pujos (asistente, item, importe)
            OUTPUT INSERTED.identificador
            VALUES (@asistente, @item, @importe)
          `);

        // T406: Broadcast to all connected users
        io.to(`auction-${subastaId}`).emit('new-bid', {
          bidId: bidResult.recordset[0].identificador,
          itemId,
          importe,
          postorId: user.id,
          postorNombre: user.email,
          timestamp: new Date().toISOString(),
        });

        // Reset the close timer after every valid bid so the last bidder wins if time expires.
        const noBidTimer = itemNoBidTimers.get(itemId);
        if (noBidTimer) {
          clearTimeout(noBidTimer);
          itemNoBidTimers.delete(itemId);
        }

        const existingTimer = itemCloseTimers.get(itemId);
        if (existingTimer) {
          clearTimeout(existingTimer);
          itemCloseTimers.delete(itemId);
        }

        const timer = setTimeout(async () => {
          try {
            await finalizeItemForPayment(io, subastaId, itemId);
          } catch (err) {
            console.error('Error auto-closing item:', err);
          } finally {
            itemCloseTimers.delete(itemId);
          }
        }, LAST_BID_CLOSE_MS);
        itemCloseTimers.set(itemId, timer);
        io.to(`auction-${subastaId}`).emit('item-close-scheduled', {
          itemId,
          closeInMs: LAST_BID_CLOSE_MS,
        });

        callback({ success: true, data: { bidId: bidResult.recordset[0].identificador } });

      } catch (error) {
        console.error('Error place-bid:', error);
        callback({ success: false, error: 'Error al registrar la puja' });
      }
    });

    // T407: Close item auction (emitted by auctioneer/admin)
    socket.on('close-item', async (data: { subastaId: number; itemId: number }, callback: Function) => {
      try {
        const { subastaId, itemId } = data;
        const pool = await connectDB();

        // Security: verify user is the auctioneer for this auction
        const authCheck = await pool.request()
          .input('subastaId', subastaId)
          .input('userId', user.id)
          .query(`
            SELECT s.identificador FROM subastas s
            INNER JOIN subastadores sub ON sub.identificador = s.subastador
            WHERE s.identificador = @subastaId AND sub.identificador = @userId
          `);

        if (authCheck.recordset.length === 0) {
          callback({ success: false, error: 'Solo el subastador puede cerrar items' });
          return;
        }

        const activeTimer = itemCloseTimers.get(itemId);
        if (activeTimer) {
          clearTimeout(activeTimer);
          itemCloseTimers.delete(itemId);
        }

        const result = await finalizeItemForPayment(io, subastaId, itemId);
        if (!result.success) {
          callback({ success: false, error: result.error || 'No se pudo cerrar el item' });
          return;
        }

        callback({ success: true, data: { cerrado: true, pendientePago: !result.noBids } });

      } catch (error) {
        console.error('Error close-item:', error);
        callback({ success: false, error: 'Error al cerrar item' });
      }
    });

    // Winner selects payment method and confirms payment.
    socket.on('confirm-payment', async (data: { itemId: number; medioPagoId: number }, callback: Function) => {
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
        const monedaCompatible = mp.moneda === pending.moneda;
        if (!monedaCompatible) {
          callback({ success: false, error: `El medio no es compatible con ${pending.moneda}` });
          return;
        }

        const total = +(pending.importe + pending.comision + pending.costoEnvio).toFixed(2);
        const disponible = parseFloat(mp.montoDisponible || 0);

        if (disponible < total) {
          const importeMulta = +(pending.importe * 0.10).toFixed(2);
          const fechaLimite = new Date();
          fechaLimite.setHours(fechaLimite.getHours() + 72);
          const mensajeMulta = `No posee fondos suficientes para pagar su oferta. Multa aplicada: ${importeMulta.toFixed(2)}. Debe pagarla en 72hs.`;

          try {
            await pool.request()
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
          } catch (insertError: any) {
            const rawMessage = String(insertError?.message || '').toLowerCase();
            const isMonedaSchemaError = rawMessage.includes('invalid column name') && rawMessage.includes('moneda');

            if (!isMonedaSchemaError) {
              throw insertError;
            }

            await pool.request()
              .input('cliente', user.id)
              .input('subasta', pending.subastaId)
              .input('item', pending.itemId)
              .input('importeOriginal', pending.importe)
              .input('importeMulta', importeMulta)
              .input('fechaLimite', fechaLimite)
              .query(`
                INSERT INTO multas (cliente, subasta, item, importeOriginal, importeMulta, fechaLimite)
                VALUES (@cliente, @subasta, @item, @importeOriginal, @importeMulta, @fechaLimite)
              `);
          }

          await pool.request()
            .input('cliente', user.id)
            .input('titulo', 'Multa por impago')
            .input('mensaje', mensajeMulta)
            .query(`
              INSERT INTO notificaciones (cliente, tipo, titulo, mensaje)
              VALUES (@cliente, 'multa', @titulo, @mensaje)
            `);

          await pool.request()
            .input('item', pending.itemId)
            .query("UPDATE itemsCatalogo SET subastado = 'si' WHERE identificador = @item");

          if (activeItems.get(pending.subastaId) === pending.itemId) {
            activeItems.delete(pending.subastaId);
          }
          clearItemTimers(pending.itemId);
          pendingPayments.delete(data.itemId);

          io.to(`auction-${pending.subastaId}`).emit('item-payment-defaulted', {
            itemId: pending.itemId,
            subastaId: pending.subastaId,
            multa: importeMulta,
            fechaLimite,
          });

          await closeAuction(io, pending.subastaId);

          callback({ success: false, error: mensajeMulta });
          return;
        }

        await pool.request()
          .input('medioId', data.medioPagoId)
          .input('total', total)
          .query('UPDATE mediosDePago SET montoDisponible = montoDisponible - @total WHERE identificador = @medioId');

        await pool.request()
          .input('pujoId', pending.pujoId)
          .query("UPDATE pujos SET ganador = 'si' WHERE identificador = @pujoId");

        await pool.request()
          .input('item', pending.itemId)
          .query("UPDATE itemsCatalogo SET subastado = 'si' WHERE identificador = @item");

        const duenioWinner = await pool.request()
          .input('cliente', user.id)
          .query('SELECT identificador FROM duenios WHERE identificador = @cliente');
        if (duenioWinner.recordset.length === 0) {
          await pool.request()
            .input('identificador', user.id)
            .input('verificador', 1)
            .query('INSERT INTO duenios (identificador, verificador) VALUES (@identificador, @verificador)');
        }

        await pool.request()
          .input('producto', pending.productoId)
          .input('duenio', user.id)
          .query('UPDATE productos SET duenio = @duenio WHERE identificador = @producto');

        await pool.request()
          .input('subasta', pending.subastaId)
          .input('duenio', pending.duenioId)
          .input('producto', pending.productoId)
          .input('cliente', user.id)
          .input('importe', pending.importe)
          .input('comision', pending.comision)
          .query(`
            INSERT INTO registroDeSubasta (subasta, duenio, producto, cliente, importe, comision)
            VALUES (@subasta, @duenio, @producto, @cliente, @importe, @comision)
          `);

        io.to(`auction-${pending.subastaId}`).emit('item-sold', {
          itemId: pending.itemId,
          ganadorId: user.id,
          ganadorNombre: pending.ganadorNombre,
          importe: pending.importe,
          comision: pending.comision,
          costoEnvio: pending.costoEnvio,
        });

        await createWinnerNotification(user.id, pending.importe, pending.comision, pending.costoEnvio, pending.moneda);

        await closeAuction(io, pending.subastaId);

        pendingPayments.delete(data.itemId);
        callback({ success: true, data: { totalPagado: total } });
      } catch (error) {
        console.error('Error confirm-payment:', error);
        callback({ success: false, error: 'No se pudo confirmar el pago' });
      }
    });

    // Set active item for auction (admin/auctioneer only)
    socket.on('set-active-item', async (data: { subastaId: number; itemId: number }, callback?: Function) => {
      try {
        const pool = await connectDB();
        const authCheck = await pool.request()
          .input('subastaId', data.subastaId)
          .input('userId', user.id)
          .query(`
            SELECT s.identificador FROM subastas s
            INNER JOIN subastadores sub ON sub.identificador = s.subastador
            WHERE s.identificador = @subastaId AND sub.identificador = @userId
          `);

        if (authCheck.recordset.length === 0) {
          callback?.({ success: false, error: 'Solo el subastador puede cambiar items' });
          return;
        }

        activeItems.set(data.subastaId, data.itemId);
        io.to(`auction-${data.subastaId}`).emit('active-item-changed', { itemId: data.itemId });
        scheduleNoBidAutoBuy(io, data.subastaId, data.itemId);
        callback?.({ success: true });
      } catch (error) {
        console.error('Error set-active-item:', error);
        callback?.({ success: false, error: 'Error interno' });
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
