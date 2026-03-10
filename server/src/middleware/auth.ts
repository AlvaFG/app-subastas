import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

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

export function categoryGuard(minCategory: string) {
  const order = ['comun', 'especial', 'plata', 'oro', 'platino'];

  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'No autenticado' });
      return;
    }

    const userLevel = order.indexOf(req.user.categoria);
    const requiredLevel = order.indexOf(minCategory);

    if (userLevel < requiredLevel) {
      res.status(403).json({ success: false, error: 'Categoria insuficiente' });
      return;
    }

    next();
  };
}
