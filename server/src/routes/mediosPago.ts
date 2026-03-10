import { Router } from 'express';
import { body } from 'express-validator';
import { getMediosPago, createMedioPago, updateMedioPago, deleteMedioPago } from '../controllers/mediosPagoController';
import { authGuard } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authGuard);

router.get('/', getMediosPago);

router.post('/',
  body('tipo').isIn(['cuenta_bancaria', 'tarjeta_credito', 'cheque_certificado']).withMessage('Tipo invalido'),
  body('descripcion').notEmpty().withMessage('Descripcion requerida'),
  validate,
  createMedioPago,
);

router.put('/:id',
  body('descripcion').notEmpty().withMessage('Descripcion requerida'),
  validate,
  updateMedioPago,
);

router.delete('/:id', deleteMedioPago);

export default router;
