/**
 * DirectMarket - Servicio de Autenticacion
 *
 * Trazabilidad:
 *   RF-01 : registro e inicio de sesion
 *   RNF-06: autenticacion segura con JWT y bcrypt
 *   CP-001: registro exitoso con datos validos -> email de verificacion
 *   CP-002: login con credenciales incorrectas -> bloqueo tras 5 intentos por 15 minutos
 *
 * Decisiones de diseno:
 *   - Las contrasenas se hashean con bcrypt (saltRounds=12 en produccion).
 *   - Los tokens JWT tienen expiracion configurada por variable de entorno.
 *   - El bloqueo de cuenta se implementa con un campo 'locked_until' en la BD.
 *     Esto es mas robusto que un contador en memoria, ya que sobrevive reinicios.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { User } = require('../models');
const { sendVerificationEmail } = require('./emailService');
const logger = require('../utils/logger');

const SALT_ROUNDS = process.env.NODE_ENV === 'production' ? 12 : 10;
const MAX_LOGIN_ATTEMPTS = parseInt(process.env.LOGIN_MAX_ATTEMPTS, 10) || 5;
const LOCK_MINUTES = parseInt(process.env.LOGIN_BLOCK_MINUTES, 10) || 15;

/**
 * Registra un nuevo usuario en el sistema.
 * Envía correo de verificacion tras el registro exitoso.
 *
 * Criterio Gherkin RF-01: "Registro con correo ya existente"
 * -> retorna error si el correo ya esta en uso.
 *
 * @param {Object} userData - { name, email, password, role }
 * @returns {Object} { userId, email }
 */
const registerUser = async ({ name, email, password, role = 'buyer' }) => {
  const normalizedEmail = email.toLowerCase().trim();

  // RF-01 Gherkin: "Este correo ya esta en uso."
  const existing = await User.findOne({ where: { email: normalizedEmail } });
  if (existing) {
    const error = new Error('Este correo ya esta en uso.');
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const verificationToken = uuidv4();

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password_hash: passwordHash,
    role,
    email_verified: false,
    email_verification_token: verificationToken
  });

  // CP-001: enviar correo de verificacion tras registro exitoso
  try {
    await sendVerificationEmail(user.email, user.name, verificationToken);
  } catch (emailError) {
    logger.error(`Error al enviar correo de verificacion a ${user.email}:`, emailError);
    // No interrumpir el registro si el email falla; el usuario puede reenviar.
  }

  logger.info(`Usuario registrado: ${user.id} (${user.email})`);

  return { userId: user.id, email: user.email };
};

/**
 * Autentica a un usuario y retorna un token JWT.
 *
 * CP-002: tras 5 intentos fallidos, bloquea la cuenta por 15 minutos.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Object} { token, user: { id, name, email, role } }
 */
const loginUser = async (email, password) => {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({ where: { email: normalizedEmail } });

  // Respuesta generica para no revelar si el correo existe o no
  if (!user) {
    const error = new Error('Credenciales incorrectas.');
    error.statusCode = 401;
    throw error;
  }

  // CP-002: verificar si la cuenta esta bloqueada
  if (user.locked_until && new Date() < user.locked_until) {
    const minutesLeft = Math.ceil((user.locked_until - new Date()) / 60000);
    const error = new Error(`Cuenta bloqueada. Intente nuevamente en ${minutesLeft} minuto(s).`);
    error.statusCode = 423;
    throw error;
  }

  // Si el bloqueo ya expiro, resetear el contador
  if (user.locked_until && new Date() >= user.locked_until) {
    await user.update({ failed_login_attempts: 0, locked_until: null });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    const newAttempts = user.failed_login_attempts + 1;

    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      // CP-002: bloquear cuenta por LOCK_MINUTES minutos
      const lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
      await user.update({ failed_login_attempts: newAttempts, locked_until: lockUntil });
      logger.warn(`Cuenta bloqueada por intentos fallidos: ${user.email}`);

      const error = new Error(`Demasiados intentos fallidos. Cuenta bloqueada por ${LOCK_MINUTES} minutos.`);
      error.statusCode = 423;
      throw error;
    }

    await user.update({ failed_login_attempts: newAttempts });
    logger.warn(`Login fallido ${newAttempts}/${MAX_LOGIN_ATTEMPTS} para: ${normalizedEmail}`);

    const error = new Error('Credenciales incorrectas.');
    error.statusCode = 401;
    throw error;
  }

  // Login exitoso: resetear contador de intentos
  await user.update({ failed_login_attempts: 0, locked_until: null });

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  logger.info(`Login exitoso: ${user.id} (${user.email})`);

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.email_verified,
      reputationScore: user.reputation_score,
      totalRatings: user.total_ratings
    }
  };
};

/**
 * Verifica el token de email y activa la cuenta del usuario.
 *
 * @param {string} token - Token de verificacion de email
 * @returns {boolean} true si la verificacion fue exitosa
 */
const verifyEmail = async (token) => {
  const user = await User.findOne({ where: { email_verification_token: token } });

  if (!user) {
    const error = new Error('Token de verificacion invalido o expirado.');
    error.statusCode = 400;
    throw error;
  }

  await user.update({
    email_verified: true,
    email_verification_token: null
  });

  logger.info(`Email verificado para usuario: ${user.id}`);
  return true;
};

module.exports = { registerUser, loginUser, verifyEmail };
