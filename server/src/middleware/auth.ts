import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { CATEGORY_ORDER, getCategoryLevel } from '../utils/category';

dotenv.config();

export interface AuthPayload {
  id: number;
  email: string;
  categoria: string;
  admitido: string;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export function authGuard(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Token no proporcionado' });
    return;
  }

  const token = header.split(' ')[1] as string;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as unknown as AuthPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Token invalido o expirado' });
  }
}

// BSEC-09: Auth opcional para rutas publicas. Si hay token valido setea req.user;
// si no hay token o el token es invalido, continua como anonimo SIN responder 401.
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = header.split(' ')[1] as string;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as unknown as AuthPayload;
    req.user = decoded;
  } catch {
    // Token invalido en ruta publica: continuar como anonimo.
    req.user = undefined;
  }
  next();
}

export function categoryGuard(minCategory: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'No autenticado' });
      return;
    }

    // BSEC-10: validar que la categoria del token sea una categoria conocida.
    const userLevel = getCategoryLevel(req.user.categoria);
    if (userLevel < 0 || !CATEGORY_ORDER.includes(req.user.categoria as typeof CATEGORY_ORDER[number])) {
      res.status(403).json({ success: false, error: 'Categoria invalida' });
      return;
    }

    const requiredLevel = getCategoryLevel(minCategory);

    if (userLevel < requiredLevel) {
      res.status(403).json({ success: false, error: 'Categoria insuficiente' });
      return;
    }

    next();
  };
}
