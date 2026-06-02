import { Router } from 'express';
import { getSubastas, getCatalogo, getItemDetalle } from '../controllers/subastasController';
import { optionalAuth } from '../middleware/auth';

const router = Router();

// T302: Lista de subastas (publica)
router.get('/', getSubastas);

// T304: Catalogo de una subasta (precio solo si autenticado)
router.get('/:id/catalogo', optionalAuth, getCatalogo);

// T306: Detalle de un item (precio solo si autenticado)
router.get('/items/:id', optionalAuth, getItemDetalle);

export default router;
