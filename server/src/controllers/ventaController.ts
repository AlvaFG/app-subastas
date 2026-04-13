import { Response } from 'express';
import sql from 'mssql';
import { AuthRequest } from '../middleware/auth';
import { connectDB } from '../models/db';
import { resolveAuctionCategoryByPriceBase } from '../utils/category';

const AUTO_ACCEPT_DELAY_MS = 30_000;
let schemaEnsurePromise: Promise<void> | null = null;

async function ensureVentaSchema(): Promise<void> {
  if (!schemaEnsurePromise) {
    schemaEnsurePromise = (async () => {
      const pool = await connectDB();
      await pool.request().query(`
        IF COL_LENGTH('solicitudesVenta', 'moneda') IS NULL
          ALTER TABLE solicitudesVenta ADD moneda VARCHAR(3) NULL;

        IF COL_LENGTH('solicitudesVenta', 'horaSubasta') IS NULL
          ALTER TABLE solicitudesVenta ADD horaSubasta TIME NULL;

        IF COL_LENGTH('solicitudesVenta', 'esObraDisenador') IS NULL
          ALTER TABLE solicitudesVenta ADD esObraDisenador VARCHAR(2) NULL;

        IF COL_LENGTH('solicitudesVenta', 'nombreArtistaDisenador') IS NULL
          ALTER TABLE solicitudesVenta ADD nombreArtistaDisenador VARCHAR(250) NULL;

        IF COL_LENGTH('solicitudesVenta', 'fechaObjeto') IS NULL
          ALTER TABLE solicitudesVenta ADD fechaObjeto DATE NULL;

        IF COL_LENGTH('solicitudesVenta', 'historiaObjeto') IS NULL
          ALTER TABLE solicitudesVenta ADD historiaObjeto VARCHAR(2000) NULL;

        IF COL_LENGTH('productos', 'esObraDisenador') IS NULL
          ALTER TABLE productos ADD esObraDisenador VARCHAR(2) NULL;

        IF COL_LENGTH('productos', 'nombreArtistaDisenador') IS NULL
          ALTER TABLE productos ADD nombreArtistaDisenador VARCHAR(250) NULL;

        IF COL_LENGTH('productos', 'fechaObjeto') IS NULL
          ALTER TABLE productos ADD fechaObjeto DATE NULL;

        IF COL_LENGTH('productos', 'historiaObjeto') IS NULL
          ALTER TABLE productos ADD historiaObjeto VARCHAR(2000) NULL;

        IF OBJECT_ID('solicitudFotos', 'U') IS NULL
        BEGIN
          CREATE TABLE solicitudFotos (
            identificador INT NOT NULL IDENTITY,
            solicitud INT NOT NULL,
            foto VARBINARY(MAX) NOT NULL,
            CONSTRAINT pk_solicitudFotos PRIMARY KEY (identificador),
            CONSTRAINT fk_solicitudFotos_solicitudesVenta FOREIGN KEY (solicitud) REFERENCES solicitudesVenta(identificador)
          );
        END
      `);
    })();
  }

  await schemaEnsurePromise;
}

function normalizeHoraSubasta(horaSubasta?: string | Date): string {
  if (!horaSubasta) return '10:00:00';
  if (horaSubasta instanceof Date) {
    const hh = String(horaSubasta.getHours()).padStart(2, '0');
    const mm = String(horaSubasta.getMinutes()).padStart(2, '0');
    const ss = String(horaSubasta.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  const raw = horaSubasta.trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
  return '10:00:00';
}

function scheduleAutoAcceptSolicitud(solicitudId: number): void {
  setTimeout(async () => {
    try {
      const pool = await connectDB();
      await pool.request()
        .input('id', solicitudId)
        .query(`
          UPDATE solicitudesVenta
          SET estado = 'aceptada'
          WHERE identificador = @id AND estado = 'pendiente'
        `);
    } catch (error) {
      console.error('Error auto-aceptando solicitud:', error);
    }
  }, AUTO_ACCEPT_DELAY_MS);
}

// T502: POST /solicitudes-venta
export async function createSolicitud(req: AuthRequest, res: Response): Promise<void> {
  try {
    await ensureVentaSchema();

    const {
      descripcion,
      datosHistoricos,
      valorBase,
      declaracionPropiedad,
      moneda,
      horaSubasta,
      esObraDisenador,
      nombreArtistaDisenador,
      fechaObjeto,
      historiaObjeto,
      fotos,
    } = req.body;

    if (declaracionPropiedad !== 'si') {
      res.status(400).json({ success: false, error: 'Debe declarar que el bien le pertenece' });
      return;
    }

    const pool = await connectDB();

    const monedaFinal = moneda === 'USD' ? 'USD' : 'ARS';
    const esObraFinal = esObraDisenador === 'si' ? 'si' : 'no';
    const horaSubastaFinal = normalizeHoraSubasta(horaSubasta);

    const result = await pool.request()
      .input('cliente', req.user!.id)
      .input('descripcion', descripcion)
      .input('datosHistoricos', datosHistoricos || null)
      .input('valorBase', valorBase || null)
      .input('declaracionPropiedad', 'si')
      .input('moneda', monedaFinal)
      .input('horaSubasta', horaSubastaFinal)
      .input('esObraDisenador', esObraFinal)
      .input('nombreArtistaDisenador', esObraFinal === 'si' ? nombreArtistaDisenador || null : null)
      .input('fechaObjeto', esObraFinal === 'si' ? fechaObjeto || null : null)
      .input('historiaObjeto', esObraFinal === 'si' ? historiaObjeto || null : null)
      .query(`
        INSERT INTO solicitudesVenta (
          cliente, descripcion, datosHistoricos, valorBase, declaracionPropiedad,
          moneda, horaSubasta, esObraDisenador, nombreArtistaDisenador, fechaObjeto, historiaObjeto
        )
        OUTPUT INSERTED.identificador
        VALUES (
          @cliente, @descripcion, @datosHistoricos, @valorBase, @declaracionPropiedad,
          @moneda, @horaSubasta, @esObraDisenador, @nombreArtistaDisenador, @fechaObjeto, @historiaObjeto
        )
      `);

    const solicitudId = result.recordset[0].identificador;

    if (Array.isArray(fotos) && fotos.length > 0) {
      for (const fotoBase64Raw of fotos) {
        if (typeof fotoBase64Raw !== 'string' || !fotoBase64Raw.trim()) continue;
        const cleanBase64 = fotoBase64Raw.includes(',')
          ? fotoBase64Raw.split(',').pop() || ''
          : fotoBase64Raw;
        const buffer = Buffer.from(cleanBase64, 'base64');
        await pool.request()
          .input('solicitud', solicitudId)
          .input('foto', sql.VarBinary(sql.MAX), buffer)
          .query('INSERT INTO solicitudFotos (solicitud, foto) VALUES (@solicitud, @foto)');
      }
    }

    scheduleAutoAcceptSolicitud(solicitudId);

    res.status(201).json({
      success: true,
      data: { identificador: solicitudId },
    });
  } catch (error) {
    console.error('Error createSolicitud:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// GET /solicitudes-venta
export async function getSolicitudes(req: AuthRequest, res: Response): Promise<void> {
  try {
    await ensureVentaSchema();

    const pool = await connectDB();
    const result = await pool.request()
      .input('cliente', req.user!.id)
      .query(`
        SELECT identificador, descripcion, datosHistoricos, estado,
               motivoRechazo, fechaSolicitud, valorBase, comisionPropuesta,
               aceptadoPorUsuario, moneda, horaSubasta, esObraDisenador,
               nombreArtistaDisenador, fechaObjeto, historiaObjeto
        FROM solicitudesVenta
        WHERE cliente = @cliente
        ORDER BY fechaSolicitud DESC
      `);

    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error getSolicitudes:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// GET /solicitudes-venta/:id
export async function getSolicitudDetalle(req: AuthRequest, res: Response): Promise<void> {
  try {
    await ensureVentaSchema();

    const { id } = req.params;
    const pool = await connectDB();

    const result = await pool.request()
      .input('id', id)
      .input('cliente', req.user!.id)
      .query(`
        SELECT s.*,
               d.nombre as depositoNombre, d.direccion as depositoDireccion,
               seg.nroPoliza, seg.compania, seg.importe as importeSeguro
        FROM solicitudesVenta s
        LEFT JOIN productos pr ON pr.duenio = s.cliente
        LEFT JOIN depositos d ON d.identificador = pr.deposito
        LEFT JOIN seguros seg ON seg.nroPoliza = pr.seguro
        WHERE s.identificador = @id AND s.cliente = @cliente
      `);

    if (result.recordset.length === 0) {
      res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
      return;
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (error) {
    console.error('Error getSolicitudDetalle:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// PUT /solicitudes-venta/:id/respuesta — user accepts/rejects base value
export async function responderSolicitud(req: AuthRequest, res: Response): Promise<void> {
  try {
    await ensureVentaSchema();

    const { id } = req.params;
    const { acepta } = req.body;

    const pool = await connectDB();

    const check = await pool.request()
      .input('id', id)
      .input('cliente', req.user!.id)
      .query(`
        SELECT identificador, estado, descripcion, datosHistoricos, valorBase,
               moneda, horaSubasta, esObraDisenador, nombreArtistaDisenador, fechaObjeto, historiaObjeto
        FROM solicitudesVenta
        WHERE identificador = @id AND cliente = @cliente AND estado = 'aceptada'
      `);

    if (check.recordset.length === 0) {
      res.status(404).json({ success: false, error: 'Solicitud no encontrada o no esta aceptada' });
      return;
    }

    await pool.request()
      .input('id', id)
      .input('acepta', acepta)
      .query(`
        UPDATE solicitudesVenta SET aceptadoPorUsuario = @acepta
        WHERE identificador = @id
      `);

    if (acepta === 'si') {
      const solicitud = check.recordset[0];
      console.log(`[VENTA] Usuario ${req.user!.id} aceptó solicitud ${id}`);
      
      // Asegurar que existe registro de duenio para este cliente
      const duenioCheck = await pool.request()
        .input('clienteId', req.user!.id)
        .query('SELECT identificador FROM duenios WHERE identificador = @clienteId');

      if (duenioCheck.recordset.length === 0) {
        console.log(`[VENTA] Creando duenio para cliente ${req.user!.id}`);
        await pool.request()
          .input('identificador', req.user!.id)
          .input('verificador', 1)
          .query(`
            INSERT INTO duenios (identificador, verificador)
            VALUES (@identificador, @verificador)
          `);
      }

      // Crear producto
      console.log(`[VENTA] Creando producto con desc: ${solicitud.descripcion}`);
      const productoResult = await pool.request()
        .input('fecha', new Date())
        .input('disponible', 'si')
        .input('descripcionCatalogo', solicitud.descripcion)
        .input('descripcionCompleta', solicitud.datosHistoricos || solicitud.descripcion)
        .input('revisor', 1)
        .input('duenio', req.user!.id)
        .input('esObraDisenador', solicitud.esObraDisenador || 'no')
        .input('nombreArtistaDisenador', solicitud.nombreArtistaDisenador || null)
        .input('fechaObjeto', solicitud.fechaObjeto || null)
        .input('historiaObjeto', solicitud.historiaObjeto || null)
        .query(`
          INSERT INTO productos (
            fecha, disponible, descripcionCatalogo, descripcionCompleta, revisor, duenio,
            esObraDisenador, nombreArtistaDisenador, fechaObjeto, historiaObjeto
          )
          OUTPUT INSERTED.identificador
          VALUES (
            @fecha, @disponible, @descripcionCatalogo, @descripcionCompleta, @revisor, @duenio,
            @esObraDisenador, @nombreArtistaDisenador, @fechaObjeto, @historiaObjeto
          )
        `);

      const productoId = productoResult.recordset[0].identificador;
      console.log(`[VENTA] Producto creado: ${productoId}`);

      // Crear una subasta nueva por cada solicitud aceptada para que se refleje como nueva entrada.
      const precioBaseItem = solicitud.valorBase || 100.00;
      const fechaSubasta = new Date();
      fechaSubasta.setDate(fechaSubasta.getDate() + 11);
      const categoriaSubasta = resolveAuctionCategoryByPriceBase(precioBaseItem, solicitud.moneda);

      console.log(`[VENTA] Creando nueva subasta para fecha ${fechaSubasta.toISOString().split('T')[0]} con categoria ${categoriaSubasta}`);
      const subastaResult = await pool.request()
        .input('fecha', fechaSubasta.toISOString().split('T')[0])
        .input('hora', normalizeHoraSubasta(solicitud.horaSubasta))
        .input('estado', 'abierta')
        .input('ubicacion', 'Centro de Remates')
        .input('tieneDeposito', 'si')
        .input('seguridadPropia', 'si')
        .input('categoria', categoriaSubasta)
        .input('moneda', solicitud.moneda === 'USD' ? 'USD' : 'ARS')
        .query(`
          INSERT INTO subastas (fecha, hora, estado, ubicacion, tieneDeposito, seguridadPropia, categoria, moneda)
          OUTPUT INSERTED.identificador
          VALUES (@fecha, @hora, @estado, @ubicacion, @tieneDeposito, @seguridadPropia, @categoria, @moneda)
        `);

      const subastaId = subastaResult.recordset[0].identificador;
      console.log(`[VENTA] Subasta creada: ${subastaId}`);

      // Crear catálogo si no existe
      const catalogoCheck = await pool.request()
        .input('subastaId', subastaId)
        .query('SELECT TOP 1 identificador FROM catalogos WHERE subasta = @subastaId');

      let catalogoId = catalogoCheck.recordset[0]?.identificador;
      console.log(`[VENTA] Busqueda de catalogo para subasta ${subastaId}: ${catalogoId ? 'ENCONTRADO' : 'NO ENCONTRADO'}`);

      if (!catalogoId) {
        console.log(`[VENTA] Creando catalogo`);
        const catalogoResult = await pool.request()
          .input('subasta', subastaId)
          .input('descripcion', 'Catálogo General')
          .input('responsable', 1)
          .query(`
            INSERT INTO catalogos (subasta, descripcion, responsable)
            OUTPUT INSERTED.identificador
            VALUES (@subasta, @descripcion, @responsable)
          `);

        catalogoId = catalogoResult.recordset[0].identificador;
        console.log(`[VENTA] Catalogo creado: ${catalogoId}`);
      }

      // Crear item de catálogo usando precio base de la solicitud
      const comisionItem = (precioBaseItem * 0.1);
      console.log(`[VENTA] Creando item con precio ${precioBaseItem}, comision ${comisionItem}`);
      await pool.request()
        .input('catalogo', catalogoId)
        .input('producto', productoId)
        .input('precioBase', precioBaseItem)
        .input('comision', comisionItem)
        .query(`
          INSERT INTO itemsCatalogo (catalogo, producto, precioBase, comision)
          VALUES (@catalogo, @producto, @precioBase, @comision)
        `);

      await pool.request()
        .input('solicitudId', id)
        .input('productoId', productoId)
        .query(`
          INSERT INTO fotos (producto, foto)
          SELECT @productoId, sf.foto
          FROM solicitudFotos sf
          WHERE sf.solicitud = @solicitudId
        `);
      
      console.log(`[VENTA] Item de catalogo creado exitosamente`);
    }

    const mensaje = acepta === 'si'
      ? 'Acepto las condiciones. Su bien sera incluido en la subasta.'
      : 'Rechazo las condiciones. Se procedera a la devolucion.';

    res.json({ success: true, data: { mensaje } });
  } catch (error) {
    console.error('Error responderSolicitud:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// T508: Cuentas a la vista
export async function getCuentasVista(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('duenio', req.user!.id)
      .query("SELECT * FROM cuentasAVista WHERE duenio = @duenio AND activa = 'si'");

    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error getCuentasVista:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

export async function createCuentaVista(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { banco, numeroCuenta, cbu, moneda, pais } = req.body;
    const pool = await connectDB();

    const result = await pool.request()
      .input('duenio', req.user!.id)
      .input('banco', banco)
      .input('numeroCuenta', numeroCuenta)
      .input('cbu', cbu || null)
      .input('moneda', moneda || 'ARS')
      .input('pais', pais || null)
      .query(`
        INSERT INTO cuentasAVista (duenio, banco, numeroCuenta, cbu, moneda, pais)
        OUTPUT INSERTED.identificador
        VALUES (@duenio, @banco, @numeroCuenta, @cbu, @moneda, @pais)
      `);

    res.status(201).json({ success: true, data: { identificador: result.recordset[0].identificador } });
  } catch (error) {
    console.error('Error createCuentaVista:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}
