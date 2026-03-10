import { Router } from 'express';
import { getEstadisticas, getHistorialPujas } from '../controllers/estadisticasController';
import { authGuard } from '../middleware/auth';

const router = Router();
router.use(authGuard);

router.get('/estadisticas', getEstadisticas);
router.get('/historial-pujas', getHistorialPujas);

export default router;
