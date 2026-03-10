import { Router } from 'express';
import { createMulta, getMultas } from '../controllers/multasController';
import { authGuard } from '../middleware/auth';

const router = Router();

router.use(authGuard);
router.get('/', getMultas);
router.post('/', createMulta);

export default router;
