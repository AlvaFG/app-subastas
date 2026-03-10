import { Router } from 'express';
import { body } from 'express-validator';
import {
  createSolicitud, getSolicitudes, getSolicitudDetalle, responderSolicitud,
  getCuentasVista, createCuentaVista,
} from '../controllers/ventaController';
import { authGuard } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(authGuard);

// Solicitudes de venta
router.get('/solicitudes', getSolicitudes);
router.get('/solicitudes/:id', getSolicitudDetalle);

router.post('/solicitudes',
  body('descripcion').notEmpty().withMessage('Descripcion requerida'),
  body('declaracionPropiedad').equals('si').withMessage('Debe declarar propiedad del bien'),
  validate,
  createSolicitud,
);

router.put('/solicitudes/:id/respuesta',
  body('acepta').isIn(['si', 'no']).withMessage('Debe indicar si acepta o no'),
  validate,
  responderSolicitud,
);

// Cuentas a la vista
router.get('/cuentas', getCuentasVista);

router.post('/cuentas',
  body('banco').notEmpty().withMessage('Banco requerido'),
  body('numeroCuenta').notEmpty().withMessage('Numero de cuenta requerido'),
  validate,
  createCuentaVista,
);

export default router;
