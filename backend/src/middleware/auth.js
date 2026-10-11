/**
 * DirectMarket - Middleware de Autenticacion JWT
 *
 * RNF-06: autenticacion segura mediante JWT.
 * Todos los endpoints protegidos deben pasar por este middleware.
 */

const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');

/**
 * Verifica el token JWT en el encabezado Authorization.
 * Agrega req.user con los datos del usuario autenticado.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticacion requerido.'
      });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expirado. Inicia sesion nuevamente.' });
      }
      return res.status(401).json({ success: false, message: 'Token invalido.' });
    }

    const user = await User.findByPk(decoded.userId, {
      attributes: ['id', 'name', 'email', 'role', 'email_verified', 'locked_until']
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Usuario no encontrado.' });
    }

    // Verificar si la cuenta esta bloqueada
    if (user.locked_until && new Date() < user.locked_until) {
      return res.status(423).json({ success: false, message: 'Cuenta bloqueada temporalmente.' });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Error en middleware de autenticacion:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
};

/**
 * Verifica que el usuario autenticado tenga rol de administrador.
 * Debe usarse despues del middleware authenticate.
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acceso restringido al administrador.'
    });
  }
  next();
};

/**
 * Verifica que el email del usuario haya sido verificado.
 * Para operaciones criticas como publicar productos o iniciar compras.
 */
const requireEmailVerified = (req, res, next) => {
  if (!req.user || !req.user.email_verified) {
    return res.status(403).json({
      success: false,
      message: 'Debes verificar tu correo electronico para realizar esta accion.'
    });
  }
  next();
};

module.exports = { authenticate, requireAdmin, requireEmailVerified };
