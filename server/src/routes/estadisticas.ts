import { Router } from 'express';
import { getEstadisticas, getHistorialPujas, getMisCompras, getMisVentas } from '../controllers/estadisticasController';
import { authGuard } from '../middleware/auth';

const router = Router();
router.use(authGuard);

router.get('/estadisticas', getEstadisticas);
router.get('/historial-pujas', getHistorialPujas);
router.get('/mis-compras', getMisCompras);
router.get('/mis-ventas', getMisVentas);

export default router;
