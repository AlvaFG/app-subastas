import request from 'supertest';
import jwt from 'jsonwebtoken';

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

function resetMocks() {
  mockQuery.mockReset();
  mockInput.mockReset().mockReturnThis();
  mockRequest.mockClear();
  mockRequest.mockImplementation(() => ({ input: mockInput, query: mockQuery }));
}

const userPayload = { id: 42, email: 'juan@test.com', categoria: 'comun', admitido: 'si' };
const token = jwt.sign(userPayload, process.env.JWT_SECRET!, { expiresIn: '1h' });

describe('MediosPago E2E', () => {
  beforeEach(() => {
    resetMocks();
  });

  // ─── GET /api/medios-pago ───

  describe('GET /api/medios-pago', () => {
    it('should return list of payment methods', async () => {
      const medios = [
        { identificador: 1, tipo: 'cuenta_bancaria', descripcion: 'Santander', activo: 'si' },
        { identificador: 2, tipo: 'tarjeta_credito', descripcion: 'Visa', activo: 'si' },
      ];
      mockQuery.mockResolvedValueOnce({ recordset: medios });

      const res = await request(app)
        .get('/api/medios-pago')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return empty array when no payment methods', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [] });

      const res = await request(app)
        .get('/api/medios-pago')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/medios-pago');
      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/medios-pago')
        .set('Authorization', 'Bearer invalid');

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/medios-pago ───

  describe('POST /api/medios-pago', () => {
    it('should create cuenta bancaria', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [{ identificador: 10 }] });

      const res = await request(app)
        .post('/api/medios-pago')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tipo: 'cuenta_bancaria',
          descripcion: 'Cuenta Santander',
          banco: 'Santander',
          numeroCuenta: '123456',
          cbu: '0000000000000000000001',
          moneda: 'ARS',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.identificador).toBe(10);
    });

    it('should create tarjeta de credito', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [{ identificador: 11 }] });

      const res = await request(app)
        .post('/api/medios-pago')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tipo: 'tarjeta_credito',
          descripcion: 'Visa Gold',
          ultimosDigitos: '4321',
          internacional: 'si',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.identificador).toBe(11);
    });

    it('should create cheque certificado', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [{ identificador: 12 }] });

      const res = await request(app)
        .post('/api/medios-pago')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tipo: 'cheque_certificado',
          descripcion: 'Cheque Galicia',
          banco: 'Galicia',
          montoCheque: 50000,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.identificador).toBe(12);
    });

    it('should return 400 with invalid tipo', async () => {
      const res = await request(app)
        .post('/api/medios-pago')
        .set('Authorization', `Bearer ${token}`)
        .send({ tipo: 'bitcoin', descripcion: 'Wallet' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when descripcion is missing', async () => {
      const res = await request(app)
        .post('/api/medios-pago')
        .set('Authorization', `Bearer ${token}`)
        .send({ tipo: 'cuenta_bancaria' });

      expect(res.status).toBe(400);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/medios-pago')
        .send({ tipo: 'cuenta_bancaria', descripcion: 'Test' });

      expect(res.status).toBe(401);
    });
  });

  // ─── PUT /api/medios-pago/:id ───

  describe('PUT /api/medios-pago/:id', () => {
    it('should update payment method successfully', async () => {
      // Ownership check
      mockQuery.mockResolvedValueOnce({ recordset: [{ identificador: 10 }] });
      // Update
      mockQuery.mockResolvedValueOnce({ recordset: [] });

      const res = await request(app)
        .put('/api/medios-pago/10')
        .set('Authorization', `Bearer ${token}`)
        .send({ descripcion: 'Cuenta actualizada', banco: 'BBVA' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mensaje).toContain('actualizado');
    });

    it('should return 404 when payment method not found or not owned', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [] });

      const res = await request(app)
        .put('/api/medios-pago/999')
        .set('Authorization', `Bearer ${token}`)
        .send({ descripcion: 'Test' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('no encontrado');
    });

    it('should return 400 when descripcion is missing', async () => {
      const res = await request(app)
        .put('/api/medios-pago/10')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .put('/api/medios-pago/10')
        .send({ descripcion: 'Test' });

      expect(res.status).toBe(401);
    });
  });

  // ─── DELETE /api/medios-pago/:id ───

  describe('DELETE /api/medios-pago/:id', () => {
    it('should soft delete payment method successfully', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [{ identificador: 10 }] });
      mockQuery.mockResolvedValueOnce({ recordset: [] });

      const res = await request(app)
        .delete('/api/medios-pago/10')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mensaje).toContain('eliminado');
    });

    it('should return 404 when payment method not found or not owned', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [] });

      const res = await request(app)
        .delete('/api/medios-pago/999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('no encontrado');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).delete('/api/medios-pago/10');
      expect(res.status).toBe(401);
    });

    it('should return 401 with expired token', async () => {
      const expiredToken = jwt.sign(userPayload, process.env.JWT_SECRET!, { expiresIn: '0s' });
      // Small delay to ensure expiry
      await new Promise((r) => setTimeout(r, 50));

      const res = await request(app)
        .delete('/api/medios-pago/10')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });
  });
});
