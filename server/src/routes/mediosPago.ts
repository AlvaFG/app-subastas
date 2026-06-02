import { Router } from 'express';
import { body } from 'express-validator';
import { getMediosPago, createMedioPago, updateMedioPago, updateSaldoMedioPago, deleteMedioPago } from '../controllers/mediosPagoController';
import { authGuard } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authGuard);

router.get('/', getMediosPago);

router.post('/',
  body('tipo').isIn(['cuenta_bancaria', 'tarjeta_credito', 'cheque_certificado']).withMessage('Tipo invalido'),
  body('descripcion').notEmpty().withMessage('Descripcion requerida'),
  body('montoDisponible').optional().isFloat({ min: 0 }).withMessage('Monto invalido'),
  validate,
  createMedioPago,
);

// A6: la verificacion de medios la realiza la empresa via PUT /api/admin/medios-pago/:id/verificar
// (rol empleado/admin). El usuario ya no puede auto-verificar su propio medio.

router.put('/:id/saldo',
  body('monto').isFloat().withMessage('Monto invalido'),
  validate,
  updateSaldoMedioPago,
);

router.put('/:id',
  body('descripcion').notEmpty().withMessage('Descripcion requerida'),
  validate,
  updateMedioPago,
);

router.delete('/:id', deleteMedioPago);

export default router;
