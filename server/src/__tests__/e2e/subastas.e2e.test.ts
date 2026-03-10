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

function generateToken(payload: object) {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '1h' });
}

const sampleSubastas = [
  { identificador: 1, fecha: '2026-04-01', hora: '10:00', estado: 'abierta', ubicacion: 'Sala A', categoria: 'comun', moneda: 'ARS', capacidadAsistentes: 50, subastadorNombre: 'Carlos', totalItems: 5 },
  { identificador: 2, fecha: '2026-04-02', hora: '14:00', estado: 'cerrada', ubicacion: 'Sala B', categoria: 'oro', moneda: 'USD', capacidadAsistentes: 20, subastadorNombre: 'Maria', totalItems: 3 },
];

describe('Subastas E2E', () => {
  beforeEach(() => {
    resetMocks();
  });

  // ─── GET /api/subastas ───

  describe('GET /api/subastas', () => {
    it('should list subastas with pagination', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: sampleSubastas });
      mockQuery.mockResolvedValueOnce({ recordset: [{ total: 2 }] });

      const res = await request(app).get('/api/subastas');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.subastas).toHaveLength(2);
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.page).toBe(1);
    });

    it('should filter by estado', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [sampleSubastas[0]] });
      mockQuery.mockResolvedValueOnce({ recordset: [{ total: 1 }] });

      const res = await request(app).get('/api/subastas?estado=abierta');

      expect(res.status).toBe(200);
      expect(res.body.data.subastas).toHaveLength(1);
      expect(mockInput).toHaveBeenCalledWith('estado', 'abierta');
    });

    it('should filter by categoria', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [sampleSubastas[1]] });
      mockQuery.mockResolvedValueOnce({ recordset: [{ total: 1 }] });

      const res = await request(app).get('/api/subastas?categoria=oro');

      expect(res.status).toBe(200);
      expect(res.body.data.subastas).toHaveLength(1);
      expect(mockInput).toHaveBeenCalledWith('categoria', 'oro');
    });

    it('should respect page and limit query params', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [] });
      mockQuery.mockResolvedValueOnce({ recordset: [{ total: 50 }] });

      const res = await request(app).get('/api/subastas?page=3&limit=10');

      expect(res.status).toBe(200);
      expect(res.body.data.page).toBe(3);
      expect(res.body.data.limit).toBe(10);
      // offset should be 20
      expect(mockInput).toHaveBeenCalledWith('offset', 20);
    });

    it('should return empty array when no subastas found', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [] });
      mockQuery.mockResolvedValueOnce({ recordset: [{ total: 0 }] });

      const res = await request(app).get('/api/subastas');

      expect(res.status).toBe(200);
      expect(res.body.data.subastas).toHaveLength(0);
      expect(res.body.data.total).toBe(0);
    });
  });

  // ─── GET /api/subastas/:id/catalogo ───

  describe('GET /api/subastas/:id/catalogo', () => {
    const catalogoItems = [
      { identificador: 10, subastado: 'no', descripcionCatalogo: 'Cuadro antiguo', duenioNombre: 'Pedro', fotoId: 1 },
    ];

    it('should return catalogo without prices when unauthenticated', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: catalogoItems });

      const res = await request(app).get('/api/subastas/1/catalogo');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('should return catalogo with prices when authenticated with sufficient category', async () => {
      const token = generateToken({ id: 42, email: 'a@a.com', categoria: 'oro', admitido: 'si' });

      // Subasta category check
      mockQuery.mockResolvedValueOnce({ recordset: [{ categoria: 'comun' }] });
      // Catalogo items
      mockQuery.mockResolvedValueOnce({ recordset: catalogoItems });

      const res = await request(app)
        .get('/api/subastas/1/catalogo')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 403 when user category is insufficient', async () => {
      const token = generateToken({ id: 42, email: 'a@a.com', categoria: 'comun', admitido: 'si' });

      mockQuery.mockResolvedValueOnce({ recordset: [{ categoria: 'oro' }] });

      const res = await request(app)
        .get('/api/subastas/1/catalogo')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('categoria no permite');
    });

    it('should return 404 when subasta not found (authenticated)', async () => {
      const token = generateToken({ id: 42, email: 'a@a.com', categoria: 'comun', admitido: 'si' });

      mockQuery.mockResolvedValueOnce({ recordset: [] });

      const res = await request(app)
        .get('/api/subastas/999/catalogo')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('no encontrada');
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/subastas/1/catalogo')
        .set('Authorization', 'Bearer bad-token');

      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/subastas/items/:id ───

  describe('GET /api/subastas/items/:id', () => {
    const itemDetail = {
      identificador: 10, subastado: 'no', productoId: 5,
      descripcionCatalogo: 'Cuadro', descripcionCompleta: 'Cuadro oleo siglo XIX',
      fechaProducto: '2020-01-01', disponible: 'si',
      duenioNombre: 'Pedro', catalogoDescripcion: 'Arte',
      subastaId: 1, subastaFecha: '2026-04-01', subastaHora: '10:00',
      subastaCat: 'comun', moneda: 'ARS',
    };

    it('should return item detail without prices when unauthenticated', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [itemDetail] });
      mockQuery.mockResolvedValueOnce({ recordset: [{ identificador: 100 }, { identificador: 101 }] });

      const res = await request(app).get('/api/subastas/items/10');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.identificador).toBe(10);
      expect(res.body.data.fotos).toEqual([100, 101]);
    });

    it('should return item detail with prices when authenticated', async () => {
      const token = generateToken({ id: 42, email: 'a@a.com', categoria: 'comun', admitido: 'si' });

      mockQuery.mockResolvedValueOnce({ recordset: [{ ...itemDetail, precioBase: 1000, comision: 10 }] });
      mockQuery.mockResolvedValueOnce({ recordset: [] });

      const res = await request(app)
        .get('/api/subastas/items/10')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.precioBase).toBe(1000);
    });

    it('should return 404 when item not found', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [] });

      const res = await request(app).get('/api/subastas/items/999');

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('no encontrado');
    });

    it('should return item with empty fotos array when no photos exist', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [itemDetail] });
      mockQuery.mockResolvedValueOnce({ recordset: [] });

      const res = await request(app).get('/api/subastas/items/10');

      expect(res.status).toBe(200);
      expect(res.body.data.fotos).toEqual([]);
    });
  });
});
