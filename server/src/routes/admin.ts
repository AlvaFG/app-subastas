import { Router } from 'express';
import { body } from 'express-validator';
import {
  listClientes, admitirCliente, rechazarCliente, asignarCategoria,
  listMediosPago, verificarMedioPago,
  listSolicitudes, inspeccionarSolicitud, responderSolicitudAdmin,
  crearMultaAdmin,
} from '../controllers/adminController';
import { authGuard, adminGuard } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

// Toda la capa admin requiere token de empleado con rol (A5/A6/A7/A9).
router.use(authGuard, adminGuard());

// Clientes
router.get('/clientes', listClientes);
router.patch('/clientes/:id/admitir',
  body('admitido').isIn(['si', 'no']).withMessage('admitido invalido'),
  validate,
  admitirCliente,
);
router.patch('/clientes/:id/categoria',
  body('categoria').isIn(['comun', 'especial', 'plata', 'oro', 'platino']).withMessage('Categoria invalida'),
  validate,
  asignarCategoria,
);
// Rechazo de solicitud: borra al cliente pendiente y le avisa por mail.
router.delete('/clientes/:id', rechazarCliente);

// Medios de pago
router.get('/medios-pago', listMediosPago);
router.put('/medios-pago/:id/verificar',
  body('verificado').isIn(['si', 'no']).withMessage('verificado invalido'),
  validate,
  verificarMedioPago,
);

// Solicitudes de venta
router.get('/venta/solicitudes', listSolicitudes);
router.put('/venta/solicitudes/:id/inspeccionar', inspeccionarSolicitud);
router.put('/venta/solicitudes/:id/respuesta',
  body('acepta').isIn(['si', 'no']).withMessage('Debe indicar si acepta o no'),
  validate,
  responderSolicitudAdmin,
);

// Multas (alta manual)
router.post('/multas',
  body('cliente').isInt().withMessage('cliente requerido'),
  body('subasta').isInt().withMessage('subasta requerida'),
  body('item').isInt().withMessage('item requerido'),
  body('importeOriginal').isFloat({ gt: 0 }).withMessage('importeOriginal invalido'),
  validate,
  crearMultaAdmin,
);

export default router;
