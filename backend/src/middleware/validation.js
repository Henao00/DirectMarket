/**
 * DirectMarket - Middleware de Validacion de Entradas
 *
 * Todas las validaciones de entrada van aqui para centralizar
 * y garantizar que ningun dato invalido llega a los servicios.
 * RNF-06: validaciones backend obligatorias (no solo frontend).
 *
 * Trazabilidad:
 *   CP-001: validar datos de registro (email, password minimo 8 chars)
 *   CP-003: precio > 0
 *   CP-004: archivo digital requerido
 *   CP-006: fecha no en el pasado
 *   CP-010: calificacion entre 1 y 5
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware ejecutor: procesa los resultados de validacion y retorna
 * los errores si los hay, o llama next() si todo esta bien.
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Error de validacion en los datos enviados.',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// ---------------------------------------------------------------------------
// VALIDACIONES DE AUTENTICACION (RF-01)
// ---------------------------------------------------------------------------

const validateRegister = [
  body('name')
    .trim()
    .notEmpty().withMessage('El nombre es obligatorio.')
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres.'),

  body('email')
    .trim()
    .notEmpty().withMessage('El correo electronico es obligatorio.')
    .isEmail().withMessage('Formato de correo invalido.')
    .normalizeEmail(),

  // CP-001: contrasena minimo 8 caracteres
  body('password')
    .notEmpty().withMessage('La contrasena es obligatoria.')
    .isLength({ min: 8 }).withMessage('La contrasena debe tener minimo 8 caracteres.')
    .matches(/[A-Z]/).withMessage('La contrasena debe contener al menos una letra mayuscula.')
    .matches(/[0-9]/).withMessage('La contrasena debe contener al menos un numero.'),

  body('role')
    .optional()
    .isIn(['buyer', 'seller']).withMessage('Rol invalido. Use "buyer" o "seller".'),

  handleValidationErrors
];

const validateLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('El correo electronico es obligatorio.')
    .isEmail().withMessage('Formato de correo invalido.')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('La contrasena es obligatoria.'),

  handleValidationErrors
];

// ---------------------------------------------------------------------------
// VALIDACIONES DE PRODUCTOS (RF-02)
// ---------------------------------------------------------------------------

const validateCreateProduct = [
  body('title')
    .trim()
    .notEmpty().withMessage('El titulo del producto es obligatorio.')
    .isLength({ min: 3, max: 200 }).withMessage('El titulo debe tener entre 3 y 200 caracteres.'),

  body('description')
    .trim()
    .notEmpty().withMessage('La descripcion es obligatoria.'),

  // CP-003: precio mayor a $0
  body('price')
    .notEmpty().withMessage('El precio es obligatorio.')
    .isFloat({ min: 0.01 }).withMessage('El precio debe ser mayor a $0.'),

  body('product_type')
    .notEmpty().withMessage('El tipo de producto es obligatorio.')
    .isIn(['physical', 'digital']).withMessage('Tipo de producto invalido. Use "physical" o "digital".'),

  body('accepted_payment_methods')
    .optional()
    .isArray().withMessage('Los metodos de pago deben ser un arreglo.')
    .custom((methods) => {
      const valid = ['cash', 'virtual'];
      const invalid = methods.filter(m => !valid.includes(m));
      if (invalid.length > 0) {
        throw new Error(`Metodos de pago invalidos: ${invalid.join(', ')}`);
      }
      return true;
    }),

  handleValidationErrors
];

// ---------------------------------------------------------------------------
// VALIDACIONES DE TRANSACCIONES (RF-03)
// ---------------------------------------------------------------------------

const validateInitiateTransaction = [
  body('product_id')
    .notEmpty().withMessage('El ID del producto es obligatorio.')
    .isUUID().withMessage('ID de producto invalido.'),

  body('payment_method')
    .notEmpty().withMessage('La modalidad de pago es obligatoria.')
    .isIn(['cash', 'virtual']).withMessage('Modalidad de pago invalida. Use "cash" o "virtual".'),

  handleValidationErrors
];

// ---------------------------------------------------------------------------
// VALIDACIONES DE ENCUENTROS (RF-04)
// ---------------------------------------------------------------------------

const validateProposeMeeting = [
  body('meetingDate')
    .notEmpty().withMessage('La fecha del encuentro es obligatoria.')
    .isISO8601().withMessage('Formato de fecha invalido.')
    .custom((value) => {
      // CP-006: validacion en middleware, reforzada tambien en servicio
      if (new Date(value) <= new Date()) {
        throw new Error('La fecha del encuentro no puede ser en el pasado.');
      }
      return true;
    }),

  body('locationDescription')
    .trim()
    .notEmpty().withMessage('El lugar del encuentro es obligatorio.')
    .isLength({ min: 5, max: 500 }).withMessage('La descripcion del lugar debe tener entre 5 y 500 caracteres.'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Las notas no pueden superar 1000 caracteres.'),

  handleValidationErrors
];

// ---------------------------------------------------------------------------
// VALIDACIONES DEL CODIGO DE LIBERACION (RF-07)
// ---------------------------------------------------------------------------

const validateReleaseCode = [
  body('code')
    .notEmpty().withMessage('El codigo de liberacion es obligatorio.')
    .isLength({ min: 8, max: 8 }).withMessage('El codigo debe tener exactamente 8 caracteres.')
    .matches(/^[A-Z2-9]+$/).withMessage('Formato de codigo invalido.'),

  body('transaction_id')
    .notEmpty().withMessage('El ID de transaccion es obligatorio.')
    .isUUID().withMessage('ID de transaccion invalido.'),

  handleValidationErrors
];

// ---------------------------------------------------------------------------
// VALIDACIONES DE DISPUTAS (RF-08)
// ---------------------------------------------------------------------------

const validateOpenDispute = [
  body('problem_type')
    .notEmpty().withMessage('El tipo de problema es obligatorio.')
    .isIn(['not_received', 'wrong_product', 'damaged_product', 'fraud', 'other'])
    .withMessage('Tipo de problema invalido.'),

  body('description')
    .trim()
    .notEmpty().withMessage('La descripcion del problema es obligatoria.')
    .isLength({ min: 20, max: 2000 })
    .withMessage('La descripcion debe tener entre 20 y 2000 caracteres.'),

  body('evidence_urls')
    .optional()
    .isArray().withMessage('Las evidencias deben ser un arreglo de URLs.'),

  handleValidationErrors
];

// ---------------------------------------------------------------------------
// VALIDACIONES DE CALIFICACIONES (RF-09)
// ---------------------------------------------------------------------------

const validateCreateRating = [
  body('score')
    .notEmpty().withMessage('La calificacion es obligatoria.')
    // CP-010: rango 1-5, error 400 si fuera de rango
    .isInt({ min: 1, max: 5 }).withMessage('Calificacion fuera del rango permitido (1-5).'),

  body('rated_user_id')
    .notEmpty().withMessage('El ID del usuario a calificar es obligatorio.')
    .isUUID().withMessage('ID de usuario invalido.'),

  body('rated_as')
    .notEmpty().withMessage('El rol calificado es obligatorio.')
    .isIn(['seller', 'buyer']).withMessage('Valor invalido. Use "seller" o "buyer".'),

  body('comment')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('El comentario no puede superar 1000 caracteres.'),

  handleValidationErrors
];

// ---------------------------------------------------------------------------
// VALIDACIONES ADMIN (RF-10)
// ---------------------------------------------------------------------------

const validateResolveDispute = [
  body('resolution')
    .notEmpty().withMessage('La resolucion es obligatoria.')
    .isIn(['resolved_buyer', 'resolved_seller'])
    .withMessage('Resolucion invalida. Use "resolved_buyer" o "resolved_seller".'),

  body('resolution_notes')
    .trim()
    .notEmpty().withMessage('Las notas de resolucion son obligatorias.')
    .isLength({ min: 10, max: 2000 }).withMessage('Las notas deben tener entre 10 y 2000 caracteres.'),

  handleValidationErrors
];

module.exports = {
  validateRegister,
  validateLogin,
  validateCreateProduct,
  validateInitiateTransaction,
  validateProposeMeeting,
  validateReleaseCode,
  validateOpenDispute,
  validateCreateRating,
  validateResolveDispute
};
