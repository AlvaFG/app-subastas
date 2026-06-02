import { Router } from 'express';
import { body } from 'express-validator';
import {
  createSolicitud, getSolicitudes, getSolicitudDetalle, getEstadoSubastaSolicitud, responderSolicitud,
  upgradePolizaSolicitud,
  getCuentasVista, createCuentaVista,
} from '../controllers/ventaController';
import { authGuard } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(authGuard);

// Solicitudes de venta
router.get('/solicitudes', getSolicitudes);
router.get('/solicitudes/:id', getSolicitudDetalle);
router.get('/solicitudes/:id/estado-subasta', getEstadoSubastaSolicitud);

router.post('/solicitudes',
  body('descripcion').notEmpty().withMessage('Descripcion requerida'),
  body('valorBase').optional().isFloat({ min: 0.01 }).withMessage('Precio base debe ser un numero positivo'),
  body('moneda').optional().isIn(['ARS', 'USD']).withMessage('Moneda invalida'),
  // W9: el usuario NO define la hora de subasta (la fija la empresa). No se acepta horaSubasta.
  body('esObraDisenador').optional().isIn(['si', 'no']).withMessage('Valor invalido para obra/disenador'),
  body('nombreArtistaDisenador').optional({ values: 'null' }).isString(),
  body('historiaObjeto').optional({ values: 'null' }).isString(),
  body('articulos').optional().isArray({ min: 1 }).withMessage('Articulos invalidos'),
  body('fotos').optional().isArray({ min: 1 }),
  body('declaracionPropiedad').equals('si').withMessage('Debe declarar propiedad del bien'),
  validate,
  createSolicitud,
);

router.put('/solicitudes/:id/respuesta',
  body('acepta').isIn(['si', 'no']).withMessage('Debe indicar si acepta o no'),
  validate,
  responderSolicitud,
);

router.post('/solicitudes/:id/poliza/upgrade', upgradePolizaSolicitud);

// Cuentas a la vista
router.get('/cuentas', getCuentasVista);

router.post('/cuentas',
  body('banco').notEmpty().withMessage('Banco requerido'),
  body('numeroCuenta').notEmpty().withMessage('Numero de cuenta requerido'),
  validate,
  createCuentaVista,
);

export default router;
