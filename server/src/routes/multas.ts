import { Router } from 'express';
import { getMultas, pagarMulta } from '../controllers/multasController';
import { authGuard } from '../middleware/auth';

const router = Router();

router.use(authGuard);
router.get('/', getMultas);
// A7: las multas las genera el sistema (socket confirm-payment) o la empresa
// (POST /api/admin/multas). El usuario NO puede crear multas manualmente.
router.put('/:id/pagar', pagarMulta);

export default router;
