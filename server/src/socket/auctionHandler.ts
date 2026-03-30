import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { connectDB } from '../models/db';
import { AuthPayload } from '../middleware/auth';

// Track: userId -> subastaId (T402: max 1 subasta por usuario)
const userConnections = new Map<number, number>();
// Track: subastaId -> current item being auctioned
const activeItems = new Map<number, number>();

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

        // T307: Category access check
        const order = ['comun', 'especial', 'plata', 'oro', 'platino'];
        const subastaLevel = order.indexOf(subasta.recordset[0].categoria);
        const userLevel = order.indexOf(user.categoria);
        if (userLevel < subastaLevel) {
          callback({ success: false, error: 'Tu categoria no permite acceder a esta subasta' });
          return;
        }

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
        const currentItem = activeItems.get(subastaId);
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
              SELECT ic.identificador, ic.precioBase, pr.descripcionCatalogo
              FROM itemsCatalogo ic
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
          }
        }

        callback({
          success: true,
          data: {
            canBid: canBid && !hasUnpaidPenalty,
            reason: hasUnpaidPenalty ? 'Tiene multas impagas' : (!canBid ? 'Sin medio de pago verificado' : null),
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
            SELECT ic.precioBase, ic.subastado, s.categoria, s.moneda
            FROM itemsCatalogo ic
            INNER JOIN catalogos c ON c.identificador = ic.catalogo
            INNER JOIN subastas s ON s.identificador = c.subasta
            WHERE ic.identificador = @item AND s.identificador = @subastaId
          `);

        if (itemInfo.recordset.length === 0) {
          callback({ success: false, error: 'Item no encontrado en esta subasta' });
          return;
        }

        const { precioBase, subastado, categoria } = itemInfo.recordset[0];

        if (subastado === 'si') {
          callback({ success: false, error: 'Este item ya fue vendido' });
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
              AND (moneda = @moneda OR internacional = 'si')
          `);

        if (mediosCompat.recordset[0].count === 0) {
          callback({ success: false, error: `No tiene medio de pago compatible con moneda ${subastaMoneda}` });
          return;
        }

        // T410: Check certified check balance
        const cheques = await pool.request()
          .input('cliente', user.id)
          .query(`
            SELECT COALESCE(SUM(montoDisponible), 0) as disponible
            FROM mediosDePago
            WHERE cliente = @cliente AND tipo = 'cheque_certificado'
              AND verificado = 'si' AND activo = 'si'
          `);

        const chequeDisponible = parseFloat(cheques.recordset[0].disponible);
        // Only check if user ONLY has cheques
        const otherMedios = await pool.request()
          .input('cliente', user.id)
          .query(`
            SELECT COUNT(*) as count FROM mediosDePago
            WHERE cliente = @cliente AND tipo != 'cheque_certificado'
              AND verificado = 'si' AND activo = 'si'
          `);

        if (otherMedios.recordset[0].count === 0 && chequeDisponible > 0 && importe > chequeDisponible) {
          callback({ success: false, error: `Monto excede su garantia de cheque (${chequeDisponible.toFixed(2)})` });
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

        // Get winning bid
        const winner = await pool.request()
          .input('item', itemId)
          .query(`
            SELECT TOP 1 p.identificador as pujoId, p.importe, p.asistente,
                   a.cliente, pe.nombre as ganadorNombre,
                   ic.precioBase, ic.comision,
                   pr.identificador as productoId, pr.duenio
            FROM pujos p
            INNER JOIN asistentes a ON a.identificador = p.asistente
            INNER JOIN clientes c ON c.identificador = a.cliente
            INNER JOIN personas pe ON pe.identificador = c.identificador
            INNER JOIN itemsCatalogo ic ON ic.identificador = p.item
            INNER JOIN productos pr ON pr.identificador = ic.producto
            WHERE p.item = @item
            ORDER BY p.importe DESC
          `);

        if (winner.recordset.length === 0) {
          // T606: No bids — company buys at base price
          const itemData = await pool.request()
            .input('item2', itemId)
            .query(`
              SELECT ic.precioBase, ic.comision,
                     pr.identificador as productoId, pr.duenio
              FROM itemsCatalogo ic
              INNER JOIN productos pr ON pr.identificador = ic.producto
              WHERE ic.identificador = @item2
            `);

          if (itemData.recordset.length > 0) {
            const it = itemData.recordset[0];

            // Mark item as sold
            await pool.request()
              .input('item3', itemId)
              .query("UPDATE itemsCatalogo SET subastado = 'si' WHERE identificador = @item3");

            // Register company purchase (cliente = NULL means company)
            await pool.request()
              .input('subasta2', subastaId)
              .input('duenio2', it.duenio)
              .input('producto2', it.productoId)
              .input('importe2', it.precioBase)
              .input('comision2', 0)
              .query(`
                INSERT INTO registroDeSubasta (subasta, duenio, producto, cliente, importe, comision)
                VALUES (@subasta2, @duenio2, @producto2, NULL, @importe2, @comision2)
              `);
          }

          callback({ success: true, data: { noBids: true, compraEmpresa: true } });
          io.to(`auction-${subastaId}`).emit('item-no-bids', { itemId, compraEmpresa: true });
          return;
        }

        const w = winner.recordset[0];

        // Mark winning bid
        await pool.request()
          .input('pujoId', w.pujoId)
          .query("UPDATE pujos SET ganador = 'si' WHERE identificador = @pujoId");

        // Mark item as sold
        await pool.request()
          .input('item', itemId)
          .query("UPDATE itemsCatalogo SET subastado = 'si' WHERE identificador = @item");

        // Register sale
        await pool.request()
          .input('subasta', subastaId)
          .input('duenio', w.duenio)
          .input('producto', w.productoId)
          .input('cliente', w.cliente)
          .input('importe', w.importe)
          .input('comision', w.comision)
          .query(`
            INSERT INTO registroDeSubasta (subasta, duenio, producto, cliente, importe, comision)
            VALUES (@subasta, @duenio, @producto, @cliente, @importe, @comision)
          `);

        // T410: Deduct from certified check if applicable
        await pool.request()
          .input('cliente', w.cliente)
          .input('importe', w.importe)
          .query(`
            UPDATE mediosDePago
            SET montoDisponible = montoDisponible - @importe
            WHERE cliente = @cliente AND tipo = 'cheque_certificado'
              AND verificado = 'si' AND activo = 'si' AND montoDisponible >= @importe
          `);

        // Broadcast sale to all
        io.to(`auction-${subastaId}`).emit('item-sold', {
          itemId,
          ganadorId: w.cliente,
          ganadorNombre: w.ganadorNombre,
          importe: w.importe,
          comision: w.comision,
        });

        // Notify winner privately
        const winnerSockets = await io.in(`auction-${subastaId}`).fetchSockets();
        for (const s of winnerSockets) {
          if ((s as any).user?.id === w.cliente) {
            s.emit('you-won', {
              itemId,
              importe: w.importe,
              comision: w.comision,
              mensaje: 'Seleccione su medio de pago',
            });
          }
        }

        callback({ success: true, data: { ganador: w.ganadorNombre, importe: w.importe } });

      } catch (error) {
        console.error('Error close-item:', error);
        callback({ success: false, error: 'Error al cerrar item' });
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
