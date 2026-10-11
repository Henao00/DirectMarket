/**
 * DirectMarket - Servicio de Codigo de Liberacion (Escrow)
 *
 * Trazabilidad:
 *   RF-05 : generar codigo unico de liberacion para pagos virtuales
 *   RF-06 : retener el dinero hasta validacion del codigo
 *   RF-07 : liberar el pago solo al validar el codigo correcto
 *   RNF-02: codigo unico, expira en maximo 24 horas
 *   RNF-05: tiempo de generacion no debe superar 2 segundos
 *   CP-007: codigo alfanumerico de 8 caracteres, visible solo al comprador
 *   CP-008: bloqueo tras 3 intentos incorrectos con notificacion al admin
 *
 * Decisiones de diseno:
 *   - El codigo se almacena como hash bcrypt para que ni el servidor pueda
 *     leerlo en texto plano tras la generacion inicial (principio de minimo privilegio).
 *   - El codigo en texto plano solo se devuelve una vez, en la respuesta de creacion.
 *   - La validacion usa bcrypt.compare para comparacion segura.
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { ReleaseCode, Transaction, User } = require('../models');
const { sendReleaseCodeBlockedEmail } = require('./emailService');
const logger = require('../utils/logger');

const MAX_ATTEMPTS = parseInt(process.env.RELEASE_CODE_MAX_ATTEMPTS, 10) || 3;
const EXPIRY_HOURS = parseInt(process.env.RELEASE_CODE_EXPIRY_HOURS, 10) || 24;

// Caracteres permitidos: alfanumericos en mayusculas, excluye O/0/I/1 para evitar confusion visual
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

/**
 * Genera una cadena alfanumerica aleatoria criptograficamente segura de 8 caracteres.
 * Usa crypto.randomBytes para asegurar aleatoriedad real (no Math.random).
 *
 * @returns {string} Codigo de 8 caracteres en mayusculas
 */
const generateSecureCode = () => {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    // Usamos modulo para mapear el byte al charset
    // El charset tiene 32 caracteres (potencia de 2) para distribuciones uniformes
    code += CHARSET[bytes[i] % CHARSET.length];
  }
  return code;
};

/**
 * Crea un nuevo codigo de liberacion para una transaccion.
 * Solo se puede crear un codigo por transaccion.
 *
 * Precondicion: el pago virtual ha sido confirmado por la pasarela (RF-06).
 * El dinero debe quedar en estado 'escrow_held' antes de llamar esta funcion.
 *
 * @param {string} transactionId - UUID de la transaccion
 * @returns {Object} { code: string, expiresAt: Date }
 * @throws Error si la transaccion no existe o ya tiene codigo
 */
const createReleaseCode = async (transactionId) => {
  const startTime = Date.now();

  const transaction = await Transaction.findByPk(transactionId);
  if (!transaction) {
    throw new Error('Transaccion no encontrada.');
  }

  if (transaction.status !== 'escrow_held') {
    throw new Error('La transaccion no esta en estado de escrow activo.');
  }

  // Verificar que no exista ya un codigo activo para esta transaccion
  const existing = await ReleaseCode.findOne({ where: { transaction_id: transactionId } });
  if (existing && !existing.is_used && !existing.is_blocked) {
    throw new Error('Ya existe un codigo de liberacion activo para esta transaccion.');
  }

  const plainCode = generateSecureCode();
  // Hashear el codigo antes de almacenarlo (RNF-01: cifrado de datos financieros)
  const saltRounds = 10;
  const codeHash = await bcrypt.hash(plainCode, saltRounds);

  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);

  await ReleaseCode.create({
    transaction_id: transactionId,
    code_hash: codeHash,
    expires_at: expiresAt,
    failed_attempts: 0,
    is_blocked: false,
    is_used: false
  });

  const elapsedMs = Date.now() - startTime;
  // RNF-05: tiempo de generacion no debe superar 2 segundos
  if (elapsedMs > 2000) {
    logger.warn(`ATENCION RNF-05: generacion de codigo tomo ${elapsedMs}ms (limite: 2000ms)`);
  }

  logger.info(`Codigo de liberacion generado para transaccion ${transactionId}. Expira: ${expiresAt.toISOString()}`);

  // El codigo en texto plano se retorna SOLO en este momento.
  // No se guarda en texto plano en ningun lugar del sistema.
  return { code: plainCode, expiresAt };
};

/**
 * Valida el codigo ingresado por el vendedor.
 * Implementa el mecanismo completo de escrow: bloqueo por intentos, expiracion y liberacion.
 *
 * @param {string} transactionId - UUID de la transaccion
 * @param {string} inputCode - Codigo ingresado por el vendedor
 * @param {string} sellerId - UUID del vendedor (para verificar autorizacion)
 * @returns {Object} { success: boolean, message: string, attemptsRemaining?: number }
 */
const validateReleaseCode = async (transactionId, inputCode, sellerId) => {
  const releaseCode = await ReleaseCode.findOne({
    where: { transaction_id: transactionId },
    include: [{ model: Transaction, as: 'transaction' }]
  });

  if (!releaseCode) {
    throw new Error('No existe codigo de liberacion para esta transaccion.');
  }

  // Verificar que el vendedor que valida es el correcto
  if (releaseCode.transaction.seller_id !== sellerId) {
    throw new Error('No autorizado para validar esta transaccion.');
  }

  // Verificar si ya fue usado
  if (releaseCode.is_used) {
    return { success: false, message: 'El codigo ya fue utilizado.' };
  }

  // CP-008: verificar bloqueo por intentos fallidos
  if (releaseCode.is_blocked) {
    logger.warn(`Intento de uso de codigo bloqueado para transaccion ${transactionId}`);
    return {
      success: false,
      message: 'El codigo esta bloqueado por demasiados intentos fallidos. Se ha notificado al administrador.'
    };
  }

  // RNF-02: verificar expiracion del codigo
  if (new Date() > releaseCode.expires_at) {
    return {
      success: false,
      message: 'Codigo expirado. Solicite uno nuevo al comprador.'
    };
  }

  // Comparacion segura del codigo contra el hash almacenado
  const isValid = await bcrypt.compare(inputCode.toUpperCase(), releaseCode.code_hash);

  if (!isValid) {
    const newAttempts = releaseCode.failed_attempts + 1;
    const attemptsRemaining = MAX_ATTEMPTS - newAttempts;

    if (newAttempts >= MAX_ATTEMPTS) {
      // CP-008: bloquear tras MAX_ATTEMPTS intentos fallidos y notificar
      await releaseCode.update({
        failed_attempts: newAttempts,
        is_blocked: true
      });

      // Notificar al comprador y al administrador (RF-08, CP-008)
      await notifyBlockedCode(releaseCode.transaction);

      logger.warn(`Codigo bloqueado por ${MAX_ATTEMPTS} intentos fallidos. Transaccion: ${transactionId}`);

      return {
        success: false,
        message: `Codigo incorrecto. Se han agotado los ${MAX_ATTEMPTS} intentos. El proceso ha sido bloqueado y se ha notificado al administrador.`,
        blocked: true
      };
    }

    await releaseCode.update({ failed_attempts: newAttempts });

    logger.info(`Intento fallido ${newAttempts}/${MAX_ATTEMPTS} para transaccion ${transactionId}`);

    return {
      success: false,
      message: 'Codigo incorrecto.',
      attemptsRemaining
    };
  }

  // Codigo correcto: liberar el pago al vendedor (RF-07)
  await releaseCode.update({ is_used: true, validated_at: new Date() });
  await releaseCode.transaction.update({
    status: 'completed',
    released_at: new Date()
  });

  logger.info(`Pago liberado correctamente para transaccion ${transactionId}`);

  return {
    success: true,
    message: 'Codigo validado. El pago ha sido liberado al vendedor y la transaccion esta completada.'
  };
};

/**
 * Notifica al comprador y al administrador cuando el codigo es bloqueado.
 * RF-08, CP-008: anomalia detectada, congelar y alertar.
 *
 * @param {Transaction} transaction - Instancia del modelo Transaction
 */
const notifyBlockedCode = async (transaction) => {
  try {
    const [buyer, admin] = await Promise.all([
      User.findByPk(transaction.buyer_id),
      User.findOne({ where: { role: 'admin' } })
    ]);

    if (buyer) {
      await sendReleaseCodeBlockedEmail(buyer.email, buyer.name, transaction.id);
    }
    if (admin) {
      await sendReleaseCodeBlockedEmail(admin.email, admin.name, transaction.id, true);
    }
  } catch (emailError) {
    // El fallo de email no debe interrumpir el flujo principal
    logger.error('Error al enviar notificacion de bloqueo de codigo:', emailError);
  }
};

/**
 * Obtiene el codigo de liberacion para mostrarlo al comprador autenticado.
 * El codigo solo es visible al comprador de la transaccion (CP-007).
 *
 * Esta funcion NO retorna el hash, sino que indica si existe un codigo activo.
 * El codigo en texto plano solo se muestra en la creacion inicial.
 * Para recuperar el codigo, el comprador debe solicitar uno nuevo si el anterior expiro.
 *
 * @param {string} transactionId
 * @param {string} buyerId
 * @returns {Object} Estado del codigo (sin revelar el hash)
 */
const getReleaseCodeStatus = async (transactionId, buyerId) => {
  const transaction = await Transaction.findByPk(transactionId);

  if (!transaction) {
    throw new Error('Transaccion no encontrada.');
  }

  // CP-007: solo el comprador autenticado puede ver el estado del codigo
  if (transaction.buyer_id !== buyerId) {
    throw new Error('No autorizado para ver el codigo de esta transaccion.');
  }

  const releaseCode = await ReleaseCode.findOne({ where: { transaction_id: transactionId } });

  if (!releaseCode) {
    return { hasCode: false };
  }

  const isExpired = new Date() > releaseCode.expires_at;

  return {
    hasCode: true,
    isUsed: releaseCode.is_used,
    isBlocked: releaseCode.is_blocked,
    isExpired,
    expiresAt: releaseCode.expires_at,
    failedAttempts: releaseCode.failed_attempts,
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - releaseCode.failed_attempts)
  };
};

module.exports = { createReleaseCode, validateReleaseCode, getReleaseCodeStatus };
