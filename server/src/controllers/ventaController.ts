import { Response } from 'express';
import sql from 'mssql';
import { AuthRequest } from '../middleware/auth';
import { connectDB } from '../models/db';
import { resolveAuctionCategoryByPriceBase } from '../utils/category';
import {
  getInsurancePolicyUpgradeDifference,
  getNextInsurancePolicyByCurrentNroPoliza,
  resolveDepositByPriceBase,
  resolveInsurancePolicyByPriceBase,
} from '../utils/insurance';

let schemaEnsurePromise: Promise<void> | null = null;

interface SolicitudArticuloInput {
  descripcion: string;
  fotos: string[];
}

function cleanBase64Photo(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) {
    return null;
  }

  const normalized = raw.includes(',')
    ? raw.split(',').pop() || ''
    : raw;

  return normalized.trim() || null;
}

function normalizePhotoList(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map(cleanBase64Photo).filter((photo): photo is string => !!photo);
}

function parseSolicitudArticulos(body: any): SolicitudArticuloInput[] {
  if (Array.isArray(body.articulos) && body.articulos.length > 0) {
    return body.articulos.map((articulo: any, index: number) => {
      const descripcion = typeof articulo?.descripcion === 'string' ? articulo.descripcion.trim() : '';
      const fotos = normalizePhotoList(articulo?.fotos);

      if (!descripcion) {
        throw new Error(`El articulo ${index + 1} debe tener una descripcion`);
      }

      if (fotos.length === 0) {
        throw new Error(`El articulo ${index + 1} debe tener al menos una foto`);
      }

      return { descripcion, fotos };
    });
  }

  const descripcion = typeof body.descripcion === 'string' ? body.descripcion.trim() : '';
  const fotos = normalizePhotoList(body.fotos);

  if (!descripcion) {
    throw new Error('Debe indicar una descripcion para la solicitud');
  }

  if (fotos.length === 0) {
    throw new Error('Debe indicar al menos una foto para la solicitud');
  }

  return [{ descripcion, fotos }];
}

async function loadSolicitudArticulos(
  pool: sql.ConnectionPool,
  solicitudId: number,
  fallbackDescripcion: string,
): Promise<SolicitudArticuloInput[]> {
  const articulosResult = await pool.request()
    .input('solicitud', solicitudId)
    .query(`
      SELECT identificador, orden, descripcion
      FROM solicitudArticulos
      WHERE solicitud = @solicitud
      ORDER BY orden, identificador
    `);

  if (articulosResult.recordset.length > 0) {
    const fotosResult = await pool.request()
      .input('solicitud', solicitudId)
      .query(`
        SELECT saf.articulo, saf.foto
        FROM solicitudArticuloFotos saf
        INNER JOIN solicitudArticulos sa ON sa.identificador = saf.articulo
        WHERE sa.solicitud = @solicitud
        ORDER BY sa.orden, saf.identificador
      `);

    return articulosResult.recordset.map((articulo: any) => ({
      descripcion: articulo.descripcion,
      fotos: fotosResult.recordset
        .filter((foto: any) => foto.articulo === articulo.identificador)
        .map((foto: any) => `data:image/jpeg;base64,${Buffer.from(foto.foto).toString('base64')}`),
    }));
  }

  const legacyFotos = await pool.request()
    .input('solicitud', solicitudId)
    .query('SELECT foto FROM solicitudFotos WHERE solicitud = @solicitud ORDER BY identificador');

  return [{
    descripcion: fallbackDescripcion,
    fotos: legacyFotos.recordset.map((foto: any) => `data:image/jpeg;base64,${Buffer.from(foto.foto).toString('base64')}`),
  }];
}

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

        IF OBJECT_ID('solicitudArticulos', 'U') IS NULL
        BEGIN
          CREATE TABLE solicitudArticulos (
            identificador INT NOT NULL IDENTITY,
            solicitud INT NOT NULL,
            orden INT NOT NULL,
            descripcion VARCHAR(1000) NOT NULL,
            CONSTRAINT pk_solicitudArticulos PRIMARY KEY (identificador),
            CONSTRAINT fk_solicitudArticulos_solicitudesVenta FOREIGN KEY (solicitud) REFERENCES solicitudesVenta(identificador)
          );
        END

        IF OBJECT_ID('solicitudArticuloFotos', 'U') IS NULL
        BEGIN
          CREATE TABLE solicitudArticuloFotos (
            identificador INT NOT NULL IDENTITY,
            articulo INT NOT NULL,
            foto VARBINARY(MAX) NOT NULL,
            CONSTRAINT pk_solicitudArticuloFotos PRIMARY KEY (identificador),
            CONSTRAINT fk_solicitudArticuloFotos_solicitudArticulos FOREIGN KEY (articulo) REFERENCES solicitudArticulos(identificador)
          );
        END

        IF OBJECT_ID('productoArticulos', 'U') IS NULL
        BEGIN
          CREATE TABLE productoArticulos (
            identificador INT NOT NULL IDENTITY,
            producto INT NOT NULL,
            orden INT NOT NULL,
            descripcion VARCHAR(1000) NOT NULL,
            CONSTRAINT pk_productoArticulos PRIMARY KEY (identificador),
            CONSTRAINT fk_productoArticulos_productos FOREIGN KEY (producto) REFERENCES productos(identificador)
          );
        END

        IF OBJECT_ID('productoArticuloFotos', 'U') IS NULL
        BEGIN
          CREATE TABLE productoArticuloFotos (
            identificador INT NOT NULL IDENTITY,
            articulo INT NOT NULL,
            foto VARBINARY(MAX) NOT NULL,
            CONSTRAINT pk_productoArticuloFotos PRIMARY KEY (identificador),
            CONSTRAINT fk_productoArticuloFotos_productoArticulos FOREIGN KEY (articulo) REFERENCES productoArticulos(identificador)
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

function getParamAsString(param: string | string[] | undefined): string | null {
  if (typeof param === 'string' && param.trim()) return param;
  if (Array.isArray(param) && typeof param[0] === 'string' && param[0].trim()) return param[0];
  return null;
}

function enrichSolicitudRow(row: any): any {
  const nextPolicy = getNextInsurancePolicyByCurrentNroPoliza(row.nroPoliza);
  const currentImporteSeguro = Number(row.importeSeguro || 0);

  return {
    ...row,
    puedeActualizarPoliza: !!nextPolicy,
    siguientePoliza: nextPolicy
      ? {
          nroPoliza: nextPolicy.nroPoliza,
          tipoPoliza: nextPolicy.tipoPoliza,
          importeSeguro: nextPolicy.importe,
          diferenciaSeguro: getInsurancePolicyUpgradeDifference(currentImporteSeguro, nextPolicy.importe),
        }
      : null,
  };
}

async function fetchSolicitudConCobertura(
  pool: sql.ConnectionPool,
  solicitudId: string,
  clienteId: number,
): Promise<any | null> {
  const result = await pool.request()
    .input('id', solicitudId)
    .input('cliente', clienteId)
    .query(`
      SELECT s.identificador, s.descripcion, s.datosHistoricos, s.estado,
             s.motivoRechazo, s.fechaSolicitud, s.valorBase, s.comisionPropuesta,
             s.aceptadoPorUsuario, s.gastosDevolucion, s.moneda, s.horaSubasta, s.esObraDisenador,
             s.nombreArtistaDisenador, s.fechaObjeto, s.historiaObjeto, s.productoId,
             sub.estado as estadoSubasta,
             pr.deposito as depositoId, d.nombre as depositoNombre, d.direccion as depositoDireccion,
             pr.seguro as nroPoliza, seg.compania as companiaSeguro, seg.tipoPoliza,
             seg.importe as importeSeguro, seg.valorBaseMin, seg.valorBaseMax
      FROM solicitudesVenta s
      LEFT JOIN productos pr ON pr.identificador = s.productoId
      LEFT JOIN itemsCatalogo ic ON ic.producto = pr.identificador
      LEFT JOIN catalogos c ON c.identificador = ic.catalogo
      LEFT JOIN subastas sub ON sub.identificador = c.subasta
      LEFT JOIN depositos d ON d.identificador = pr.deposito
      LEFT JOIN seguros seg ON seg.nroPoliza = pr.seguro
      WHERE s.identificador = @id AND s.cliente = @cliente
    `);

  if (result.recordset.length === 0) {
    return null;
  }

  return enrichSolicitudRow(result.recordset[0]);
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
      esObraDisenador,
      nombreArtistaDisenador,
      fechaObjeto,
      historiaObjeto,
      origenLicito,
      articulos,
      fotos,
    } = req.body;

    if (declaracionPropiedad !== 'si') {
      res.status(400).json({ success: false, error: 'Debe declarar que el bien le pertenece' });
      return;
    }

    const pool = await connectDB();

    const monedaFinal = moneda === 'USD' ? 'USD' : 'ARS';
    const esObraFinal = esObraDisenador === 'si' ? 'si' : 'no';
    // W9: hora por defecto interna; la empresa define el horario real de la subasta.
    const horaSubastaFinal = normalizeHoraSubasta();
    let articulosSolicitud: SolicitudArticuloInput[];
    try {
      articulosSolicitud = parseSolicitudArticulos({ descripcion, fotos, articulos });
    } catch (parseError) {
      res.status(400).json({
        success: false,
        error: parseError instanceof Error ? parseError.message : 'Articulos invalidos',
      });
      return;
    }

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
      .input('origenLicito', origenLicito === 'si' ? 'si' : 'no')
      .query(`
        INSERT INTO solicitudesVenta (
          cliente, descripcion, datosHistoricos, valorBase, declaracionPropiedad,
          moneda, horaSubasta, esObraDisenador, nombreArtistaDisenador, fechaObjeto, historiaObjeto, origenLicito
        )
        OUTPUT INSERTED.identificador
        VALUES (
          @cliente, @descripcion, @datosHistoricos, @valorBase, @declaracionPropiedad,
          @moneda, @horaSubasta, @esObraDisenador, @nombreArtistaDisenador, @fechaObjeto, @historiaObjeto, @origenLicito
        )
      `);

    const solicitudId = result.recordset[0].identificador;

    for (const [index, articulo] of articulosSolicitud.entries()) {
      const articuloResult = await pool.request()
        .input('solicitud', solicitudId)
        .input('orden', index + 1)
        .input('descripcion', articulo.descripcion)
        .query(`
          INSERT INTO solicitudArticulos (solicitud, orden, descripcion)
          OUTPUT INSERTED.identificador
          VALUES (@solicitud, @orden, @descripcion)
        `);

      const articuloId = articuloResult.recordset[0].identificador;

      for (const fotoBase64 of articulo.fotos) {
        const buffer = Buffer.from(fotoBase64, 'base64');
        await pool.request()
          .input('solicitud', solicitudId)
          .input('foto', sql.VarBinary(sql.MAX), buffer)
          .query('INSERT INTO solicitudFotos (solicitud, foto) VALUES (@solicitud, @foto)');

        await pool.request()
          .input('articulo', articuloId)
          .input('foto', sql.VarBinary(sql.MAX), buffer)
          .query('INSERT INTO solicitudArticuloFotos (articulo, foto) VALUES (@articulo, @foto)');
      }
    }

    // A9/W9: la solicitud queda 'pendiente'. La empresa la inspecciona y define
    // precio base/comision (PUT /api/admin/venta/solicitudes/:id/respuesta). El
    // usuario solo PROPONE; no crea la subasta ni se auto-acepta.
    res.status(201).json({
      success: true,
      data: { identificador: solicitudId, estado: 'pendiente' },
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
        SELECT s.identificador, s.descripcion, s.datosHistoricos, s.estado,
               s.motivoRechazo, s.fechaSolicitud, s.valorBase, s.comisionPropuesta,
               s.aceptadoPorUsuario, s.gastosDevolucion, s.moneda, s.horaSubasta, s.esObraDisenador,
               s.nombreArtistaDisenador, s.fechaObjeto, s.historiaObjeto, s.productoId,
               sub.estado as estadoSubasta,
               pr.deposito as depositoId, d.nombre as depositoNombre, d.direccion as depositoDireccion,
               pr.seguro as nroPoliza, seg.compania as companiaSeguro, seg.tipoPoliza,
               seg.importe as importeSeguro, seg.valorBaseMin, seg.valorBaseMax
        FROM solicitudesVenta s
        LEFT JOIN productos pr ON pr.identificador = s.productoId
        LEFT JOIN itemsCatalogo ic ON ic.producto = pr.identificador
        LEFT JOIN catalogos c ON c.identificador = ic.catalogo
        LEFT JOIN subastas sub ON sub.identificador = c.subasta
        LEFT JOIN depositos d ON d.identificador = pr.deposito
        LEFT JOIN seguros seg ON seg.nroPoliza = pr.seguro
        WHERE s.cliente = @cliente
        ORDER BY s.fechaSolicitud DESC
      `);

    res.json({ success: true, data: result.recordset.map(enrichSolicitudRow) });
  } catch (error) {
    console.error('Error getSolicitudes:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// GET /solicitudes-venta/:id
export async function getSolicitudDetalle(req: AuthRequest, res: Response): Promise<void> {
  try {
    await ensureVentaSchema();

    const id = getParamAsString(req.params.id);
    if (!id) {
      res.status(400).json({ success: false, error: 'Id de solicitud invalido' });
      return;
    }
    const pool = await connectDB();

    const solicitud = await fetchSolicitudConCobertura(pool, id, req.user!.id);

    if (!solicitud) {
      res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
      return;
    }

    res.json({ success: true, data: solicitud });
  } catch (error) {
    console.error('Error getSolicitudDetalle:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// GET /solicitudes-venta/:id/estado-subasta
export async function getEstadoSubastaSolicitud(req: AuthRequest, res: Response): Promise<void> {
  try {
    await ensureVentaSchema();

    const id = getParamAsString(req.params.id);
    if (!id) {
      res.status(400).json({ success: false, error: 'Id de solicitud invalido' });
      return;
    }
    const pool = await connectDB();
    const solicitud = await fetchSolicitudConCobertura(pool, id, req.user!.id);

    if (!solicitud) {
      res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
      return;
    }

    res.json({
      success: true,
      data: {
        identificador: solicitud.identificador,
        estadoSubasta: solicitud.estadoSubasta || null,
        deposito: solicitud.depositoNombre
          ? {
              identificador: solicitud.depositoId,
              nombre: solicitud.depositoNombre,
              direccion: solicitud.depositoDireccion,
            }
          : null,
        poliza: solicitud.nroPoliza
          ? {
              nroPoliza: solicitud.nroPoliza,
              compania: solicitud.companiaSeguro,
              tipoPoliza: solicitud.tipoPoliza,
              importeSeguro: solicitud.importeSeguro,
              valorBaseMin: solicitud.valorBaseMin,
              valorBaseMax: solicitud.valorBaseMax,
            }
          : null,
        puedeActualizarPoliza: solicitud.puedeActualizarPoliza,
        siguientePoliza: solicitud.siguientePoliza,
      },
    });
  } catch (error) {
    console.error('Error getEstadoSubastaSolicitud:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// POST /solicitudes-venta/:id/poliza/upgrade
export async function upgradePolizaSolicitud(req: AuthRequest, res: Response): Promise<void> {
  try {
    await ensureVentaSchema();

    const id = getParamAsString(req.params.id);
    if (!id) {
      res.status(400).json({ success: false, error: 'Id de solicitud invalido' });
      return;
    }
    const pool = await connectDB();

    const solicitud = await fetchSolicitudConCobertura(pool, id, req.user!.id);

    if (!solicitud || !solicitud.productoId) {
      res.status(404).json({ success: false, error: 'Solicitud no encontrada o sin producto asociado' });
      return;
    }

    const currentPolicyIndex = resolveInsurancePolicyByPriceBase(solicitud.valorBase || 0, solicitud.moneda).nroPoliza;
    const currentPolicy = solicitud.nroPoliza || currentPolicyIndex;
    const nextPolicy = getNextInsurancePolicyByCurrentNroPoliza(currentPolicy);

    if (!nextPolicy) {
      res.status(400).json({ success: false, error: 'La poliza ya se encuentra en su valor maximo' });
      return;
    }

    const currentImporte = Number(solicitud.importeSeguro || 0);
    const diferencia = getInsurancePolicyUpgradeDifference(currentImporte, nextPolicy.importe);

    // Determine currency to charge (use solicitud.moneda or default 'ARS')
    const monedaSubasta = solicitud.moneda === 'USD' ? 'USD' : 'ARS';

    // BUG-01: el medio de pago lo elige el usuario (body.medioPagoId). No se
    // puede auto-seleccionar uno cualquiera: hay que validar el seleccionado.
    const medioPagoId = req.body?.medioPagoId;
    if (medioPagoId === undefined || medioPagoId === null || `${medioPagoId}`.trim() === '') {
      res.status(400).json({ success: false, error: 'Debe seleccionar un medio de pago' });
      return;
    }

    // Validar que el medio pertenece al cliente y esta verificado/activo,
    // de forma analoga a confirm-payment en el socket.
    const medioRes = await pool.request()
      .input('medioId', medioPagoId)
      .input('cliente', req.user!.id)
      .query(`
        SELECT identificador, montoDisponible, moneda, tipo, internacional
        FROM mediosDePago
        WHERE identificador = @medioId AND cliente = @cliente
          AND verificado = 'si' AND activo = 'si'
      `);

    if (medioRes.recordset.length === 0) {
      res.status(400).json({ success: false, error: 'Medio de pago no valido' });
      return;
    }

    const medioElegido = medioRes.recordset[0];

    // El medio debe ser compatible con la moneda del cobro.
    if (medioElegido.moneda !== monedaSubasta) {
      res.status(400).json({ success: false, error: `El medio de pago debe estar en ${monedaSubasta}` });
      return;
    }

    // Saldo suficiente para cubrir la diferencia de premio.
    const disponible = Number(medioElegido.montoDisponible || 0);
    if (disponible < diferencia) {
      res.status(400).json({ success: false, error: 'Saldo insuficiente en el medio seleccionado' });
      return;
    }

    // Descontar la diferencia del medio elegido (mismo patron que confirm-payment).
    await pool.request()
      .input('medioId', medioElegido.identificador)
      .input('diferencia', diferencia)
      .query(`
        UPDATE mediosDePago SET montoDisponible = montoDisponible - @diferencia WHERE identificador = @medioId
      `);

    // Apply new policy to product
    await pool.request()
      .input('productoId', solicitud.productoId)
      .input('seguro', nextPolicy.nroPoliza)
      .query(`
        UPDATE productos
        SET seguro = @seguro
        WHERE identificador = @productoId
      `);

    res.json({
      success: true,
      data: {
        polizaAnterior: currentPolicy,
        polizaNueva: nextPolicy,
        diferenciaPremio: diferencia,
        medioUsado: { identificador: medioElegido.identificador, tipo: medioElegido.tipo, moneda: medioElegido.moneda },
        mensaje: `Poliza actualizada a ${nextPolicy.nroPoliza}. Diferencia descontada de medio ${medioElegido.identificador}: ${diferencia.toFixed(2)} ${monedaSubasta}`,
      },
    });
  } catch (error) {
    console.error('Error upgradePolizaSolicitud:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// PUT /solicitudes-venta/:id/respuesta — user accepts/rejects base value
export async function responderSolicitud(req: AuthRequest, res: Response): Promise<void> {
  try {
    await ensureVentaSchema();

    const id = getParamAsString(req.params.id);
    if (!id) {
      res.status(400).json({ success: false, error: 'Id de solicitud invalido' });
      return;
    }
    const { acepta } = req.body;

    const pool = await connectDB();

    const check = await pool.request()
      .input('id', id)
      .input('cliente', req.user!.id)
      .query(`
        SELECT identificador, estado, descripcion, datosHistoricos, valorBase, comisionPropuesta,
               moneda, horaSubasta, esObraDisenador, nombreArtistaDisenador, fechaObjeto, historiaObjeto
        FROM solicitudesVenta
        WHERE identificador = @id AND cliente = @cliente AND estado = 'aceptada'
      `);

    if (check.recordset.length === 0) {
      res.status(404).json({ success: false, error: 'Solicitud no encontrada o no esta aceptada por la empresa' });
      return;
    }

    // TPO §190: las cuentas a la vista deben declararse ANTES del inicio de la subasta.
    // La subasta se crea al aceptar las condiciones, por lo que exigimos que el usuario
    // ya tenga una cuenta declarada (donde recibir el dinero de la venta).
    if (acepta === 'si') {
      const cuenta = await pool.request()
        .input('duenio', req.user!.id)
        .query("SELECT COUNT(*) as count FROM cuentasAVista WHERE duenio = @duenio AND activa = 'si'");
      if (cuenta.recordset[0].count === 0) {
        res.status(400).json({
          success: false,
          error: 'Debe declarar una cuenta a la vista antes de que su bien entre en subasta.',
        });
        return;
      }
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
  const articulosSolicitud = await loadSolicitudArticulos(pool, Number(id), solicitud.descripcion);

      // Crear una subasta nueva por cada solicitud aceptada para que se refleje como nueva entrada.
      const precioBaseItem = solicitud.valorBase || 100.00;

      const polizaAsignada = resolveInsurancePolicyByPriceBase(precioBaseItem, solicitud.moneda);
      const depositoAsignado = resolveDepositByPriceBase(precioBaseItem, solicitud.moneda);

      await pool.request()
        .input('productoId', productoId)
        .input('seguro', polizaAsignada.nroPoliza)
        .input('deposito', depositoAsignado)
        .query(`
          UPDATE productos
          SET seguro = @seguro,
              deposito = @deposito
          WHERE identificador = @productoId
        `);

      await pool.request()
        .input('id', id)
        .input('productoId', productoId)
        .query(`
          UPDATE solicitudesVenta
          SET productoId = @productoId
          WHERE identificador = @id
        `);

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

      // Crear item de catálogo usando precio base y la comision definida por la EMPRESA.
      const comisionItem = Number.isFinite(Number(solicitud.comisionPropuesta)) && Number(solicitud.comisionPropuesta) >= 0
        ? Number(solicitud.comisionPropuesta)
        : +(precioBaseItem * 0.1).toFixed(2);
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

      for (const [index, articulo] of articulosSolicitud.entries()) {
        const articuloResult = await pool.request()
          .input('producto', productoId)
          .input('orden', index + 1)
          .input('descripcion', articulo.descripcion)
          .query(`
            INSERT INTO productoArticulos (producto, orden, descripcion)
            OUTPUT INSERTED.identificador
            VALUES (@producto, @orden, @descripcion)
          `);

        const productoArticuloId = articuloResult.recordset[0].identificador;

        for (const fotoBase64 of articulo.fotos) {
          const buffer = Buffer.from(fotoBase64.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
          await pool.request()
            .input('productoId', productoId)
            .input('foto', sql.VarBinary(sql.MAX), buffer)
            .query('INSERT INTO fotos (producto, foto) VALUES (@productoId, @foto)');

          await pool.request()
            .input('articulo', productoArticuloId)
            .input('foto', sql.VarBinary(sql.MAX), buffer)
            .query('INSERT INTO productoArticuloFotos (articulo, foto) VALUES (@articulo, @foto)');
        }
      }
      
      console.log(`[VENTA] Item de catalogo creado exitosamente`);
    } else {
      // TPO: si el usuario no acepta el valor base/comision, el bien se devuelve
      // CON CARGO. Sin tabla de tarifas de transporte, los gastos de devolucion se
      // estiman como 5% del valor base (simplificacion academica documentada).
      const base = Number(check.recordset[0].valorBase || 0);
      const gastosDevolucion = +(base * 0.05).toFixed(2);
      await pool.request()
        .input('id', id)
        .input('gastos', gastosDevolucion)
        .query(`
          UPDATE solicitudesVenta
          SET estado = 'devuelta', gastosDevolucion = @gastos
          WHERE identificador = @id
        `);

      await pool.request()
        .input('cliente', req.user!.id)
        .input('mensaje', `Rechazo las condiciones. El bien sera devuelto con un cargo de ${check.recordset[0].moneda || 'ARS'} ${gastosDevolucion.toFixed(2)} (gastos de devolucion).`)
        .query(`
          INSERT INTO notificaciones (cliente, tipo, titulo, mensaje)
          VALUES (@cliente, 'sistema', 'Devolucion con cargo', @mensaje)
        `);
    }

    const mensaje = acepta === 'si'
      ? 'Acepto las condiciones. Su bien sera incluido en la subasta.'
      : 'Rechazo las condiciones. Se procedera a la devolucion con cargo.';

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
