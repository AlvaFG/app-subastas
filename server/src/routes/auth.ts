import { Router } from 'express';
import { body } from 'express-validator';
import { registerStep1, registerStep2, login, refreshToken, getMe } from '../controllers/authController';
import { authGuard } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

// T202: Registro Etapa 1
router.post('/register/step1',
  body('documento').notEmpty().withMessage('Documento requerido'),
  body('nombre').notEmpty().withMessage('Nombre requerido'),
  body('direccion').notEmpty().withMessage('Direccion requerida'),
  body('numeroPais').isInt().withMessage('Pais requerido'),
  validate,
  registerStep1,
);

// T204: Registro Etapa 2
router.post('/register/step2',
  body('identificador').isInt().withMessage('Identificador requerido'),
  body('email').isEmail().withMessage('Email invalido'),
  body('clave').isLength({ min: 8 }).withMessage('La clave debe tener al menos 8 caracteres')
    .matches(/[A-Z]/).withMessage('La clave debe contener al menos una mayuscula')
    .matches(/[0-9]/).withMessage('La clave debe contener al menos un numero'),
  validate,
  registerStep2,
);

// T205: Login
router.post('/login',
  body('email').isEmail().withMessage('Email invalido'),
  body('clave').notEmpty().withMessage('Clave requerida'),
  validate,
  login,
);

// Refresh token
router.post('/refresh',
  body('refreshToken').notEmpty().withMessage('Refresh token requerido'),
  validate,
  refreshToken,
);

// Get current user
router.get('/me', authGuard, getMe);

export default router;
