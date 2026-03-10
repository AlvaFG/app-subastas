import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authGuard, AuthRequest } from '../middleware/auth';

jest.mock('jsonwebtoken');

const mockResponse = (): Response => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext: NextFunction = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret';
});

describe('authGuard', () => {
  it('should return 401 when no authorization header is present', () => {
    const req = { headers: {} } as AuthRequest;
    const res = mockResponse();

    authGuard(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Token no proporcionado' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when authorization header does not start with Bearer', () => {
    const req = { headers: { authorization: 'Basic abc123' } } as AuthRequest;
    const res = mockResponse();

    authGuard(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Token no proporcionado' });
  });

  it('should return 401 when authorization header is just "Bearer" with no token', () => {
    const req = { headers: { authorization: 'Token xyz' } } as AuthRequest;
    const res = mockResponse();

    authGuard(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should call next and set req.user when token is valid', () => {
    const payload = { id: 1, email: 'test@test.com', categoria: 'comun', admitido: 'si' };
    (jwt.verify as jest.Mock).mockReturnValue(payload);

    const req = { headers: { authorization: 'Bearer valid-token' } } as AuthRequest;
    const res = mockResponse();

    authGuard(req, res, mockNext);

    expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
    expect(req.user).toEqual(payload);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should return 401 when token is expired', () => {
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('jwt expired');
    });

    const req = { headers: { authorization: 'Bearer expired-token' } } as AuthRequest;
    const res = mockResponse();

    authGuard(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Token invalido o expirado' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when token is malformed', () => {
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('jwt malformed');
    });

    const req = { headers: { authorization: 'Bearer malformed.token' } } as AuthRequest;
    const res = mockResponse();

    authGuard(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Token invalido o expirado' });
  });

  it('should return 401 when token has invalid signature', () => {
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('invalid signature');
    });

    const req = { headers: { authorization: 'Bearer tampered-token' } } as AuthRequest;
    const res = mockResponse();

    authGuard(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should extract the correct token from the Bearer header', () => {
    const payload = { id: 2, email: 'a@b.com', categoria: 'oro', admitido: 'si' };
    (jwt.verify as jest.Mock).mockReturnValue(payload);

    const req = { headers: { authorization: 'Bearer my.jwt.token' } } as AuthRequest;
    const res = mockResponse();

    authGuard(req, res, mockNext);

    expect(jwt.verify).toHaveBeenCalledWith('my.jwt.token', 'test-secret');
  });
});
