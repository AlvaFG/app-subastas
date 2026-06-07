import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

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

// El mail de admision no debe tocar SMTP en los tests.
const mockSendAdmissionEmail = jest.fn().mockResolvedValue(true);
jest.mock('../../services/email', () => ({
  sendAdmissionEmail: (...args: unknown[]) => mockSendAdmissionEmail(...args),
}));

process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

import { app } from '../../index';

function resetMocks() {
  mockQuery.mockReset();
  mockInput.mockReset().mockReturnThis();
  mockRequest.mockClear();
  mockRequest.mockImplementation(() => ({ input: mockInput, query: mockQuery }));
  mockSendAdmissionEmail.mockClear();
}

const adminToken = jwt.sign({ id: 1, email: 'admin@subastas.com', rol: 'admin' }, process.env.JWT_SECRET!, { expiresIn: '1h' });
const clientToken = jwt.sign({ id: 42, email: 'c@test.com', categoria: 'comun', admitido: 'si' }, process.env.JWT_SECRET!, { expiresIn: '1h' });

describe('Admin layer E2E', () => {
  beforeEach(() => { resetMocks(); });

  // ─── adminGuard ───
  describe('adminGuard', () => {
    it('401 sin token', async () => {
      const res = await request(app).get('/api/admin/clientes');
      expect(res.status).toBe(401);
    });

    it('403 con token de cliente (sin rol)', async () => {
      const res = await request(app).get('/api/admin/clientes').set('Authorization', `Bearer ${clientToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('administrativo');
    });

    it('200 con token de empleado', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [{ identificador: 42, nombre: 'Ana', admitido: 'no', categoria: 'comun' }] });
      const res = await request(app).get('/api/admin/clientes').query({ admitido: 'no' }).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  // ─── Admision de clientes ───
  describe('PATCH /api/admin/clientes/:id/admitir', () => {
    it('admite, asigna categoria y envia el mail de admision', async () => {
      // 1) UPDATE admision
      mockQuery.mockResolvedValueOnce({ rowsAffected: [1], recordset: [] });
      // 2) SELECT datos del cliente (email + claveHash null + nombre)
      mockQuery.mockResolvedValueOnce({ recordset: [{ email: 'ana@test.com', claveHash: null, nombre: 'Ana' }] });
      // 3) UPDATE token de activacion
      mockQuery.mockResolvedValueOnce({ recordset: [] });
      // 4) INSERT notificacion
      mockQuery.mockResolvedValueOnce({ recordset: [] });

      const res = await request(app)
        .patch('/api/admin/clientes/42/admitir')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admitido: 'si', categoria: 'plata' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockSendAdmissionEmail).toHaveBeenCalledTimes(1);
    });

    it('400 con categoria invalida', async () => {
      const res = await request(app)
        .patch('/api/admin/clientes/42/admitir')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admitido: 'si', categoria: 'oroplata' });
      expect(res.status).toBe(400);
    });

    it('404 si el cliente no existe', async () => {
      mockQuery.mockResolvedValueOnce({ rowsAffected: [0], recordset: [] });
      const res = await request(app)
        .patch('/api/admin/clientes/999/admitir')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admitido: 'si' });
      expect(res.status).toBe(404);
    });
  });

  // ─── Verificacion de medios (empresa) ───
  describe('PUT /api/admin/medios-pago/:id/verificar', () => {
    it('verifica un medio de cualquier cliente', async () => {
      mockQuery.mockResolvedValueOnce({ rowsAffected: [1], recordset: [] });
      const res = await request(app)
        .put('/api/admin/medios-pago/5/verificar')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ verificado: 'si' });
      expect(res.status).toBe(200);
    });
  });

  // ─── Respuesta de la empresa a una solicitud ───
  describe('PUT /api/admin/venta/solicitudes/:id/respuesta', () => {
    it('acepta definiendo precio base y comision', async () => {
      mockQuery
        .mockResolvedValueOnce({ recordset: [{ identificador: 3, cliente: 42, estado: 'pendiente' }] }) // check
        .mockResolvedValueOnce({ recordset: [] }) // update solicitud
        .mockResolvedValueOnce({ recordset: [] }); // notificacion
      const res = await request(app)
        .put('/api/admin/venta/solicitudes/3/respuesta')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ acepta: 'si', valorBase: 10000, comision: 1000 });
      expect(res.status).toBe(200);
    });

    it('400 si acepta sin precio base', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [{ identificador: 3, cliente: 42, estado: 'pendiente' }] });
      const res = await request(app)
        .put('/api/admin/venta/solicitudes/3/respuesta')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ acepta: 'si' });
      expect(res.status).toBe(400);
    });
  });

  // ─── Alta manual de multa ───
  describe('POST /api/admin/multas', () => {
    it('crea multa del 10%', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [] }).mockResolvedValueOnce({ recordset: [] });
      const res = await request(app)
        .post('/api/admin/multas')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cliente: 42, subasta: 1, item: 7, importeOriginal: 5000 });
      expect(res.status).toBe(201);
      expect(res.body.data.importeMulta).toBe(500);
    });
  });

  // ─── Login admin ───
  describe('POST /api/auth/admin/login', () => {
    it('login de empleado emite token con rol', async () => {
      const claveHash = await bcrypt.hash('Admin1234', 10);
      mockQuery.mockResolvedValueOnce({
        recordset: [{ identificador: 1, email: 'admin@subastas.com', claveHash, rol: 'admin', nombre: 'Admin', estado: 'activo' }],
      });
      const res = await request(app)
        .post('/api/auth/admin/login')
        .send({ email: 'admin@subastas.com', clave: 'Admin1234' });
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.rol).toBe('admin');
    });

    it('401 con credenciales invalidas', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [] });
      const res = await request(app)
        .post('/api/auth/admin/login')
        .send({ email: 'admin@subastas.com', clave: 'mala' });
      expect(res.status).toBe(401);
    });
  });

  // ─── Agujeros de autorizacion cerrados ───
  describe('rutas removidas (A6/A7)', () => {
    it('POST /api/multas ya no existe (404)', async () => {
      const res = await request(app)
        .post('/api/multas')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ subasta: 1, item: 1, importeOriginal: 100 });
      expect(res.status).toBe(404);
    });

    it('PUT /api/medios-pago/:id/verificar ya no existe para el usuario (404)', async () => {
      const res = await request(app)
        .put('/api/medios-pago/5/verificar')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ verificado: 'si' });
      expect(res.status).toBe(404);
    });
  });
});
