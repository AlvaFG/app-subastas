import { Router } from 'express';
import { createMulta, getMultas, pagarMulta } from '../controllers/multasController';
import { authGuard } from '../middleware/auth';

const router = Router();

router.use(authGuard);
router.get('/', getMultas);
router.post('/', createMulta);
router.put('/:id/pagar', pagarMulta);

export default router;
