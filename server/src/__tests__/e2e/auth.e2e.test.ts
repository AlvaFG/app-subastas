import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

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

// Set env vars before importing app
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

import { app } from '../../index';

function resetMocks() {
  mockQuery.mockReset();
  mockInput.mockReset().mockReturnThis();
  mockRequest.mockClear();
  mockRequest.mockImplementation(() => ({ input: mockInput, query: mockQuery }));
}

function generateToken(payload: object, secret = process.env.JWT_SECRET!) {
  return jwt.sign(payload, secret, { expiresIn: '1h' });
}

describe('Auth E2E', () => {
  beforeEach(() => {
    resetMocks();
  });

  // ─── POST /api/auth/register/step1 ───

  describe('POST /api/auth/register/step1', () => {
    const validBody = {
      documento: '12345678',
      nombre: 'Juan Perez',
      direccion: 'Calle 123',
      numeroPais: 1,
    };

    it('should register step1 successfully', async () => {
      // First query: check existing → none found
      mockQuery.mockResolvedValueOnce({ recordset: [] });
      // Second query: insert persona
      mockQuery.mockResolvedValueOnce({ recordset: [{ identificador: 42 }] });
      // Third query: insert cliente
      mockQuery.mockResolvedValueOnce({ recordset: [] });

      const res = await request(app)
        .post('/api/auth/register/step1')
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.identificador).toBe(42);
    });

    it('should return 400 when documento already exists', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [{ identificador: 1 }] });

      const res = await request(app)
        .post('/api/auth/register/step1')
        .send(validBody);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('ya esta registrado');
    });

    it('should return 400 when documento is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register/step1')
        .send({ nombre: 'Juan', direccion: 'Calle', numeroPais: 1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when nombre is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register/step1')
        .send({ documento: '123', direccion: 'Calle', numeroPais: 1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when numeroPais is not an integer', async () => {
      const res = await request(app)
        .post('/api/auth/register/step1')
        .send({ documento: '123', nombre: 'Juan', direccion: 'Calle', numeroPais: 'abc' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── POST /api/auth/register/step2 ───

  describe('POST /api/auth/register/step2', () => {
    const validBody = {
      identificador: 42,
      email: 'juan@test.com',
      clave: 'Password123',
    };

    it('should complete step2 successfully', async () => {
      mockQuery.mockResolvedValueOnce({
        recordset: [{ identificador: 42, admitido: 'si', email: null }],
      });
      mockQuery.mockResolvedValueOnce({ recordset: [] });

      const res = await request(app)
        .post('/api/auth/register/step2')
        .send(validBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mensaje).toContain('Registro completado');
    });

    it('should return 404 when cliente not found', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [] });

      const res = await request(app)
        .post('/api/auth/register/step2')
        .send(validBody);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('no encontrado');
    });

    it('should return 403 when cliente not yet admitido', async () => {
      mockQuery.mockResolvedValueOnce({
        recordset: [{ identificador: 42, admitido: 'no', email: null }],
      });

      const res = await request(app)
        .post('/api/auth/register/step2')
        .send(validBody);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('no ha sido admitido');
    });

    it('should return 400 when registration already completed', async () => {
      mockQuery.mockResolvedValueOnce({
        recordset: [{ identificador: 42, admitido: 'si', email: 'existing@test.com' }],
      });

      const res = await request(app)
        .post('/api/auth/register/step2')
        .send(validBody);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ya fue completado');
    });

    it('should return 400 when email is invalid', async () => {
      const res = await request(app)
        .post('/api/auth/register/step2')
        .send({ identificador: 42, email: 'not-an-email', clave: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── POST /api/auth/login ───

  describe('POST /api/auth/login', () => {
    const validBody = { email: 'juan@test.com', clave: 'password123' };

    it('should login successfully', async () => {
      const claveHash = await bcrypt.hash('password123', 10);

      // User query
      mockQuery.mockResolvedValueOnce({
        recordset: [{
          identificador: 42,
          email: 'juan@test.com',
          claveHash,
          categoria: 'comun',
          admitido: 'si',
          nombre: 'Juan',
          estado: 'activo',
        }],
      });
      // Multas check
      mockQuery.mockResolvedValueOnce({ recordset: [{ count: 0 }] });
      // Insert session
      mockQuery.mockResolvedValueOnce({ recordset: [] });

      const res = await request(app)
        .post('/api/auth/login')
        .send(validBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.email).toBe('juan@test.com');
    });

    it('should return 401 when user not found', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [] });

      const res = await request(app)
        .post('/api/auth/login')
        .send(validBody);

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Credenciales invalidas');
    });

    it('should return 401 when password is wrong', async () => {
      const claveHash = await bcrypt.hash('otraclave', 10);

      mockQuery.mockResolvedValueOnce({
        recordset: [{
          identificador: 42, email: 'juan@test.com', claveHash,
          categoria: 'comun', admitido: 'si', nombre: 'Juan', estado: 'activo',
        }],
      });
      mockQuery.mockResolvedValueOnce({ recordset: [{ count: 0 }] });

      const res = await request(app)
        .post('/api/auth/login')
        .send(validBody);

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Credenciales invalidas');
    });

    it('should return 403 when account is blocked (inactivo)', async () => {
      mockQuery.mockResolvedValueOnce({
        recordset: [{
          identificador: 42, email: 'juan@test.com', claveHash: 'x',
          categoria: 'comun', admitido: 'si', nombre: 'Juan', estado: 'inactivo',
        }],
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send(validBody);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('bloqueada');
    });

    it('should return 403 when user has multas derivadas a justicia', async () => {
      const claveHash = await bcrypt.hash('password123', 10);

      mockQuery.mockResolvedValueOnce({
        recordset: [{
          identificador: 42, email: 'juan@test.com', claveHash,
          categoria: 'comun', admitido: 'si', nombre: 'Juan', estado: 'activo',
        }],
      });
      mockQuery.mockResolvedValueOnce({ recordset: [{ count: 2 }] });

      const res = await request(app)
        .post('/api/auth/login')
        .send(validBody);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('suspendida');
    });
  });

  // ─── GET /api/auth/me ───

  describe('GET /api/auth/me', () => {
    it('should return user data with valid token', async () => {
      const token = generateToken({ id: 42, email: 'juan@test.com', categoria: 'comun', admitido: 'si' });

      mockQuery.mockResolvedValueOnce({
        recordset: [{
          identificador: 42, documento: '123', nombre: 'Juan',
          direccion: 'Calle', email: 'juan@test.com', categoria: 'comun',
          admitido: 'si', numeroPais: 1, paisNombre: 'Argentina',
        }],
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.nombre).toBe('Juan');
    });

    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 when user not found in db', async () => {
      const token = generateToken({ id: 999, email: 'x@x.com', categoria: 'comun', admitido: 'si' });
      mockQuery.mockResolvedValueOnce({ recordset: [] });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('no encontrado');
    });
  });

  // ─── POST /api/auth/refresh ───

  describe('POST /api/auth/refresh', () => {
    it('should return new access token with valid refresh token', async () => {
      const payload = { id: 42, email: 'juan@test.com', categoria: 'comun', admitido: 'si' };
      const refreshTk = jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      mockQuery.mockResolvedValueOnce({
        recordset: [{
          cliente: 42, fechaExpiracion: futureDate.toISOString(),
          email: 'juan@test.com', categoria: 'comun', admitido: 'si',
        }],
      });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: refreshTk });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('should return 401 when refresh token not found in db', async () => {
      const refreshTk = jwt.sign({ id: 42 }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });
      mockQuery.mockResolvedValueOnce({ recordset: [] });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: refreshTk });

      expect(res.status).toBe(401);
    });

    it('should return 401 when refresh token is expired in db', async () => {
      const refreshTk = jwt.sign({ id: 42 }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });
      const pastDate = new Date('2020-01-01');

      mockQuery.mockResolvedValueOnce({
        recordset: [{
          cliente: 42, fechaExpiracion: pastDate.toISOString(),
          email: 'juan@test.com', categoria: 'comun', admitido: 'si',
        }],
      });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: refreshTk });

      expect(res.status).toBe(401);
    });

    it('should return 401 with a completely invalid token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'garbage-token' });

      // Will fail at jwt.verify or db lookup
      expect(res.status).toBe(401);
    });

    it('should return 400 when refreshToken field is missing', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
