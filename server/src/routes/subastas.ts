import { Router } from 'express';
import { getSubastas, getCatalogo, getItemDetalle } from '../controllers/subastasController';
import { authGuard, AuthRequest } from '../middleware/auth';
import { Request, Response, NextFunction } from 'express';

const router = Router();

// Middleware opcional: intenta parsear JWT pero no falla si no hay
function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return authGuard(req as AuthRequest, res, next);
  }
  next();
}

// T302: Lista de subastas (publica)
router.get('/', getSubastas);

// T304: Catalogo de una subasta (precio solo si autenticado)
router.get('/:id/catalogo', optionalAuth, getCatalogo);

// T306: Detalle de un item (precio solo si autenticado)
router.get('/items/:id', optionalAuth, getItemDetalle);

export default router;
