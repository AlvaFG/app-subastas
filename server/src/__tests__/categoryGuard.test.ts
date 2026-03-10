import { Response, NextFunction } from 'express';
import { categoryGuard, AuthRequest } from '../middleware/auth';

const mockResponse = (): Response => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('categoryGuard', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = jest.fn();
  });

  it('should return 401 when req.user is not set', () => {
    const guard = categoryGuard('comun');
    const req = {} as AuthRequest;
    const res = mockResponse();

    guard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'No autenticado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow same category access', () => {
    const guard = categoryGuard('plata');
    const req = { user: { id: 1, email: 'a@b.com', categoria: 'plata', admitido: 'si' } } as AuthRequest;
    const res = mockResponse();

    guard(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should allow higher category to access lower category resource', () => {
    const guard = categoryGuard('comun');
    const req = { user: { id: 1, email: 'a@b.com', categoria: 'platino', admitido: 'si' } } as AuthRequest;
    const res = mockResponse();

    guard(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should deny lower category access to higher category resource', () => {
    const guard = categoryGuard('oro');
    const req = { user: { id: 1, email: 'a@b.com', categoria: 'comun', admitido: 'si' } } as AuthRequest;
    const res = mockResponse();

    guard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Categoria insuficiente' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should respect the full hierarchy: comun < especial < plata < oro < platino', () => {
    const categories = ['comun', 'especial', 'plata', 'oro', 'platino'];

    for (let i = 0; i < categories.length; i++) {
      for (let j = 0; j < categories.length; j++) {
        const guard = categoryGuard(categories[i]!);
        const req = { user: { id: 1, email: 'a@b.com', categoria: categories[j]!, admitido: 'si' } } as AuthRequest;
        const res = mockResponse();
        const n = jest.fn();

        guard(req, res, n);

        if (j >= i) {
          expect(n).toHaveBeenCalled();
        } else {
          expect(res.status).toHaveBeenCalledWith(403);
        }
      }
    }
  });

  it('should allow especial to access comun', () => {
    const guard = categoryGuard('comun');
    const req = { user: { id: 1, email: 'a@b.com', categoria: 'especial', admitido: 'si' } } as AuthRequest;
    const res = mockResponse();

    guard(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should deny especial from accessing plata', () => {
    const guard = categoryGuard('plata');
    const req = { user: { id: 1, email: 'a@b.com', categoria: 'especial', admitido: 'si' } } as AuthRequest;
    const res = mockResponse();

    guard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should allow oro to access plata', () => {
    const guard = categoryGuard('plata');
    const req = { user: { id: 1, email: 'a@b.com', categoria: 'oro', admitido: 'si' } } as AuthRequest;
    const res = mockResponse();

    guard(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
