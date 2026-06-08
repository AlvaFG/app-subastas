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

const token = jwt.sign(
  { id: 42, email: 'juan@test.com', categoria: 'comun', admitido: 'si' },
  process.env.JWT_SECRET!,
  { expiresIn: '1h' },
);

describe('Estadisticas / Transacciones E2E', () => {
  beforeEach(() => {
    resetMocks();
  });

  // ─── GET /api/usuarios/mis-compras ───

  describe('GET /api/usuarios/mis-compras', () => {
    it('401 sin token', async () => {
      const res = await request(app).get('/api/usuarios/mis-compras');
      expect(res.status).toBe(401);
    });

    it('lista las compras del usuario y calcula totalPagado (importe + envio)', async () => {
      mockQuery.mockResolvedValueOnce({
        recordset: [
          {
            identificador: 2, importe: '1100', comision: '10', costoEnvio: '33',
            seguroComprador: 'si', modoEntrega: 'envio', subasta: 12, subastaFecha: null,
            moneda: 'ARS', producto: 12, descripcionCompleta: 'Reloj', descripcionCatalogo: null,
            vendedorNombre: 'Luz',
          },
        ],
      });

      const res = await request(app)
        .get('/api/usuarios/mis-compras')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].totalPagado).toBe(1133);
      expect(res.body.data[0].vendedorNombre).toBe('Luz');
    });

    it('devuelve lista vacia cuando no hay compras', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [] });

      const res = await request(app)
        .get('/api/usuarios/mis-compras')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  // ─── GET /api/usuarios/mis-ventas ───

  describe('GET /api/usuarios/mis-ventas', () => {
    it('401 sin token', async () => {
      const res = await request(app).get('/api/usuarios/mis-ventas');
      expect(res.status).toBe(401);
    });

    it('lista las ventas del usuario y calcula totalRecibido (importe - comision)', async () => {
      mockQuery.mockResolvedValueOnce({
        recordset: [
          {
            identificador: 2, importe: '1100', comision: '10', modoEntrega: 'envio',
            subasta: 12, subastaFecha: null, moneda: 'ARS', producto: 12,
            descripcionCompleta: 'Reloj', descripcionCatalogo: null, compradorNombre: 'Franco',
          },
        ],
      });

      const res = await request(app)
        .get('/api/usuarios/mis-ventas')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].totalRecibido).toBe(1090);
      expect(res.body.data[0].compradorNombre).toBe('Franco');
    });
  });
});
