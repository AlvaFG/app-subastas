import { Router } from 'express';
import { getNotificaciones, marcarLeida, getUnreadCount } from '../controllers/notificacionesController';
import { authGuard } from '../middleware/auth';

const router = Router();
router.use(authGuard);

router.get('/', getNotificaciones);
router.get('/count', getUnreadCount);
router.put('/:id/leer', marcarLeida);

export default router;
