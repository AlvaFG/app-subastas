import request from 'supertest';
import jwt from 'jsonwebtoken';

// Mock connectDB before importing app
const mockQuery = jest.fn();
const mockInput = jest.fn().mockReturnThis();
const mockRequest = jest.fn(() => ({ input: mockInput, query: mockQuery }));
const mockPool = { request: mockRequest };

jest.mock('../../models/db', () => ({
  connectDB: jest.fn().mockResolvedValue(mockPool),
  closeDB: jest.fn(),
}));

jest.mock('../../socket/auctionHandler', () => ({
  setupAuctionSocket: jest.fn(),
}));

process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

import { app } from '../../index';

// ─── Test helpers ───

type Handler = { match: RegExp; result: any };

const rs = (rows: any[] = []) => ({ recordset: rows });
const insertId = (id: number) => rs([{ identificador: id }]);

// Every INSERT ... OUTPUT INSERTED.identificador the venta flow relies on.
// Routing by SQL text (instead of ordered mockResolvedValueOnce) keeps the
// tests robust against the cached ensureVentaSchema() call, whose ALTER/CREATE
// block runs once on the first request and would otherwise shift the order.
const INSERT_HANDLERS: Handler[] = [
  { match: /INSERT INTO solicitudesVenta/, result: insertId(500) },
  { match: /INSERT INTO solicitudArticulos\b/, result: insertId(901) },
  { match: /INSERT INTO productoArticulos\b/, result: insertId(1) },
  { match: /INSERT INTO productos\b/, result: insertId(800) },
  { match: /INSERT INTO subastas\b/, result: insertId(600) },
  { match: /INSERT INTO catalogos\b/, result: insertId(300) },
  { match: /INSERT INTO cuentasAVista/, result: insertId(7) },
];

/** Route mocked queries by SQL fragment; first match wins, else empty recordset. */
function routeDb(handlers: Handler[]): void {
  const all = [...handlers, ...INSERT_HANDLERS];
  mockQuery.mockImplementation((sqlText: string) => {
    for (const h of all) {
      if (h.match.test(sqlText)) return Promise.resolve(h.result);
    }
    return Promise.resolve(rs());
  });
}

function resetMocks() {
  mockQuery.mockReset();
  // Safe default so the cached ensureVentaSchema() promise can never reject.
  mockQuery.mockResolvedValue(rs());
  mockInput.mockReset().mockReturnThis();
  mockRequest.mockClear();
  mockRequest.mockImplementation(() => ({ input: mockInput, query: mockQuery }));
}

function clienteToken() {
  return jwt.sign(
    { id: 42, email: 'vendedor@test.com', categoria: 'comun', admitido: 'si' },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' },
  );
}

// An "aceptada por la empresa" solicitud row, as returned by responderSolicitud's lookup.
const solicitudAceptada = {
  identificador: 77,
  estado: 'aceptada',
  descripcion: 'Reloj de bolsillo antiguo',
  datosHistoricos: 'Siglo XIX',
  valorBase: 1000,
  comisionPropuesta: 100,
  moneda: 'ARS',
  horaSubasta: '10:00:00',
  esObraDisenador: 'no',
  nombreArtistaDisenador: null,
  fechaObjeto: null,
  historiaObjeto: null,
  nroPoliza: null,
  importeSeguro: 0,
};

describe('Venta (flujo vendedor) E2E', () => {
  beforeEach(() => {
    resetMocks();
  });

  // ─── Auth guard: todas las rutas /api/venta requieren token ───

  describe('Auth guard', () => {
    it('POST /api/venta/solicitudes sin token -> 401', async () => {
      const res = await request(app).post('/api/venta/solicitudes').send({});
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/venta/solicitudes sin token -> 401', async () => {
      const res = await request(app).get('/api/venta/solicitudes');
      expect(res.status).toBe(401);
    });

    it('GET /api/venta/cuentas sin token -> 401', async () => {
      const res = await request(app).get('/api/venta/cuentas');
      expect(res.status).toBe(401);
    });

    it('token invalido -> 401', async () => {
      const res = await request(app)
        .get('/api/venta/solicitudes')
        .set('Authorization', 'Bearer basura');
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/venta/solicitudes (crear solicitud de venta) ───

  describe('POST /api/venta/solicitudes', () => {
    const token = clienteToken();
    const validBody = {
      descripcion: 'Reloj de bolsillo antiguo',
      valorBase: 1000,
      moneda: 'ARS',
      declaracionPropiedad: 'si',
      fotos: ['data:image/png;base64,AAA'],
    };

    it('crea la solicitud y queda pendiente -> 201', async () => {
      routeDb([]);

      const res = await request(app)
        .post('/api/venta/solicitudes')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.identificador).toBe(500);
      expect(res.body.data.estado).toBe('pendiente');
    });

    it('400 cuando falta descripcion', async () => {
      const res = await request(app)
        .post('/api/venta/solicitudes')
        .set('Authorization', `Bearer ${token}`)
        .send({ declaracionPropiedad: 'si', fotos: ['data:image/png;base64,AAA'] });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('400 cuando no declara propiedad del bien', async () => {
      const res = await request(app)
        .post('/api/venta/solicitudes')
        .set('Authorization', `Bearer ${token}`)
        .send({ descripcion: 'Reloj', fotos: ['data:image/png;base64,AAA'] });

      expect(res.status).toBe(400);
    });

    it('400 cuando la moneda es invalida', async () => {
      const res = await request(app)
        .post('/api/venta/solicitudes')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validBody, moneda: 'EUR' });

      expect(res.status).toBe(400);
    });

    it('400 cuando valorBase es negativo', async () => {
      const res = await request(app)
        .post('/api/venta/solicitudes')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validBody, valorBase: -50 });

      expect(res.status).toBe(400);
    });

    it('400 cuando no se adjunta ninguna foto', async () => {
      // Pasa los validators de ruta (descripcion + declaracion) pero el
      // controller exige al menos una foto.
      routeDb([]);

      const res = await request(app)
        .post('/api/venta/solicitudes')
        .set('Authorization', `Bearer ${token}`)
        .send({ descripcion: 'Reloj', declaracionPropiedad: 'si' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/foto/i);
    });
  });

  // ─── PUT /api/venta/solicitudes/:id/respuesta (aceptar/rechazar condiciones) ───

  describe('PUT /api/venta/solicitudes/:id/respuesta', () => {
    const token = clienteToken();

    it('400 cuando acepta no es si/no', async () => {
      const res = await request(app)
        .put('/api/venta/solicitudes/77/respuesta')
        .set('Authorization', `Bearer ${token}`)
        .send({ acepta: 'quizas' });

      expect(res.status).toBe(400);
    });

    it('404 cuando la solicitud no esta aceptada por la empresa', async () => {
      routeDb([{ match: /FROM solicitudesVenta/, result: rs([]) }]);

      const res = await request(app)
        .put('/api/venta/solicitudes/77/respuesta')
        .set('Authorization', `Bearer ${token}`)
        .send({ acepta: 'si' });

      expect(res.status).toBe(404);
    });

    it('400 al aceptar sin una cuenta a la vista declarada', async () => {
      routeDb([
        { match: /FROM solicitudesVenta/, result: rs([solicitudAceptada]) },
        { match: /COUNT\(\*\) as count FROM cuentasAVista/, result: rs([{ count: 0 }]) },
      ]);

      const res = await request(app)
        .put('/api/venta/solicitudes/77/respuesta')
        .set('Authorization', `Bearer ${token}`)
        .send({ acepta: 'si' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cuenta a la vista/i);
    });

    it('acepta condiciones con cuenta declarada -> 200 y genera la subasta', async () => {
      routeDb([
        { match: /FROM solicitudesVenta/, result: rs([solicitudAceptada]) },
        { match: /COUNT\(\*\) as count FROM cuentasAVista/, result: rs([{ count: 1 }]) },
        { match: /FROM duenios/, result: rs([{ identificador: 42 }]) },
        { match: /FROM solicitudArticulos/, result: rs([]) },
        { match: /FROM solicitudFotos/, result: rs([]) },
        { match: /FROM catalogos/, result: rs([]) },
      ]);

      const res = await request(app)
        .put('/api/venta/solicitudes/77/respuesta')
        .set('Authorization', `Bearer ${token}`)
        .send({ acepta: 'si' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mensaje).toMatch(/Acepto/i);
      // Se debe haber creado el producto, la subasta y el catalogo.
      const inserted = mockQuery.mock.calls.map((c) => c[0]).join('\n');
      expect(inserted).toMatch(/INSERT INTO productos/);
      expect(inserted).toMatch(/INSERT INTO subastas/);
      expect(inserted).toMatch(/INSERT INTO itemsCatalogo/);
    });

    it('rechaza condiciones -> 200 y devolucion con cargo', async () => {
      routeDb([
        { match: /FROM solicitudesVenta/, result: rs([solicitudAceptada]) },
      ]);

      const res = await request(app)
        .put('/api/venta/solicitudes/77/respuesta')
        .set('Authorization', `Bearer ${token}`)
        .send({ acepta: 'no' });

      expect(res.status).toBe(200);
      expect(res.body.data.mensaje).toMatch(/devoluci/i);
      const queries = mockQuery.mock.calls.map((c) => c[0]).join('\n');
      // El bien se marca devuelta y se notifica al cliente.
      expect(queries).toMatch(/SET estado = 'devuelta'/);
      expect(queries).toMatch(/INSERT INTO notificaciones/);
    });
  });

  // ─── GET /api/venta/solicitudes ───

  describe('GET /api/venta/solicitudes', () => {
    it('lista las solicitudes del cliente -> 200', async () => {
      routeDb([
        { match: /FROM solicitudesVenta/, result: rs([solicitudAceptada]) },
      ]);

      const res = await request(app)
        .get('/api/venta/solicitudes')
        .set('Authorization', `Bearer ${clienteToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].puedeActualizarPoliza).toBe(false);
    });
  });

  // ─── Cuentas a la vista ───

  describe('Cuentas a la vista', () => {
    const token = clienteToken();

    it('POST /api/venta/cuentas crea una cuenta -> 201', async () => {
      routeDb([]);

      const res = await request(app)
        .post('/api/venta/cuentas')
        .set('Authorization', `Bearer ${token}`)
        .send({ banco: 'Galicia', numeroCuenta: '123-456', cbu: '0070123', moneda: 'ARS' });

      expect(res.status).toBe(201);
      expect(res.body.data.identificador).toBe(7);
    });

    it('POST /api/venta/cuentas 400 sin banco', async () => {
      const res = await request(app)
        .post('/api/venta/cuentas')
        .set('Authorization', `Bearer ${token}`)
        .send({ numeroCuenta: '123-456' });

      expect(res.status).toBe(400);
    });

    it('GET /api/venta/cuentas lista las cuentas activas -> 200', async () => {
      routeDb([
        {
          match: /FROM cuentasAVista/,
          result: rs([{ identificador: 7, banco: 'Galicia', numeroCuenta: '123-456', activa: 'si' }]),
        },
      ]);

      const res = await request(app)
        .get('/api/venta/cuentas')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].banco).toBe('Galicia');
    });

    it('POST /api/venta/cuentas crea el duenio si no existe', async () => {
      // FROM duenios devuelve vacio -> el controller debe insertarlo antes de la cuenta.
      routeDb([{ match: /FROM duenios/, result: rs([]) }]);

      const res = await request(app)
        .post('/api/venta/cuentas')
        .set('Authorization', `Bearer ${token}`)
        .send({ banco: 'Galicia', numeroCuenta: '123-456' });

      expect(res.status).toBe(201);
      const queries = mockQuery.mock.calls.map((c) => c[0]).join('\n');
      expect(queries).toMatch(/INSERT INTO duenios/);
      expect(queries).toMatch(/INSERT INTO cuentasAVista/);
    });

    it('DELETE /api/venta/cuentas/:id da de baja la cuenta -> 200', async () => {
      mockQuery.mockResolvedValue({ recordset: [], rowsAffected: [1] });

      const res = await request(app)
        .delete('/api/venta/cuentas/7')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const queries = mockQuery.mock.calls.map((c) => c[0]).join('\n');
      expect(queries).toMatch(/SET activa = 'no'/);
    });

    it('DELETE /api/venta/cuentas/:id 404 si no existe o no es propia', async () => {
      mockQuery.mockResolvedValue({ recordset: [], rowsAffected: [0] });

      const res = await request(app)
        .delete('/api/venta/cuentas/999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
