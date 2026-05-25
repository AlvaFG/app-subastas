import { Router } from 'express';
import { body } from 'express-validator';
import { getSubastas, getCatalogo, getItemDetalle, placeBid } from '../controllers/subastasController';
import { authGuard, AuthRequest } from '../middleware/auth';
import { Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate';

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

// T305: Place bid via REST (wrapper for real-time place-bid)
router.post('/:id/bid',
  authGuard,
  body('itemId').isInt().withMessage('itemId requerido'),
  body('importe').isFloat({ gt: 0 }).withMessage('importe invalido'),
  validate,
  placeBid,
);

export default router;
