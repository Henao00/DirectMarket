/**
 * DirectMarket - Servicio de Disputas y Calificaciones
 *
 * Trazabilidad:
 *   RF-08: reportar inconvenientes en la entrega
 *   RF-09: calificar al vendedor y comprador (CP-010: rango 1-5)
 *   RF-10: administrador interviene en disputas
 *   CP-009: reporte congela pago y abre ticket
 *   CP-010: calificacion fuera de rango retorna 400
 */

const { Dispute, Rating, Transaction, User } = require('../models');
const { sendDisputeNotification } = require('./emailService');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// DISPUTAS (RF-08, RF-10)
// ---------------------------------------------------------------------------

/**
 * Abre un ticket de disputa para una transaccion.
 * El estado de la transaccion cambia a 'disputed', congelando el pago.
 *
 * CP-009: congela la liberacion del pago y notifica al administrador.
 * Criterio Gherkin RF-08: "El sistema congela la liberacion del pago, abre ticket
 * de disputa y notifica al administrador."
 *
 * @param {string} transactionId
 * @param {string} openedBy - ID del comprador que reporta
 * @param {Object} disputeData - { problem_type, description, evidence_urls }
 * @returns {Dispute}
 */
const openDispute = async (transactionId, openedBy, disputeData) => {
  const { problem_type, description, evidence_urls = [] } = disputeData;

  const transaction = await Transaction.findByPk(transactionId);
  if (!transaction) {
    const error = new Error('Transaccion no encontrada.');
    error.statusCode = 404;
    throw error;
  }

  // Solo el comprador puede abrir una disputa
  if (transaction.buyer_id !== openedBy) {
    const error = new Error('Solo el comprador puede reportar un problema en la transaccion.');
    error.statusCode = 403;
    throw error;
  }

  // La transaccion debe estar activa (en escrow o completada recientemente)
  const disputeableStatuses = ['escrow_held', 'code_validated', 'completed'];
  if (!disputeableStatuses.includes(transaction.status)) {
    const error = new Error('No es posible abrir una disputa para esta transaccion en su estado actual.');
    error.statusCode = 400;
    throw error;
  }

  // Verificar que no exista ya una disputa activa
  const existingDispute = await Dispute.findOne({
    where: { transaction_id: transactionId, status: ['active', 'reviewing'] }
  });
  if (existingDispute) {
    const error = new Error('Ya existe una disputa activa para esta transaccion.');
    error.statusCode = 409;
    throw error;
  }

  // CP-009: congelar la liberacion del pago cambiando el estado
  await transaction.update({ status: 'disputed' });

  const dispute = await Dispute.create({
    transaction_id: transactionId,
    opened_by: openedBy,
    problem_type,
    description,
    evidence_urls,
    status: 'active'
  });

  // Notificar al administrador (CP-009, RF-10)
  try {
    const admin = await User.findOne({ where: { role: 'admin' } });
    if (admin) {
      await sendDisputeNotification(admin.email, dispute.id, transactionId);
    }
  } catch (emailError) {
    logger.error('Error enviando notificacion de disputa al admin:', emailError);
  }

  logger.info(`Disputa abierta: ${dispute.id} para transaccion ${transactionId}`);
  return dispute;
};

/**
 * Resuelve una disputa. Solo puede ser ejecutado por un administrador.
 *
 * RF-10: la resolucion es irreversible y se notifica a ambas partes.
 * Criterio Gherkin RF-10: "Admin resuelve disputa a favor del comprador"
 * -> reembolsa dinero al comprador y notifica.
 *
 * @param {string} disputeId
 * @param {string} adminId
 * @param {string} resolution - 'resolved_buyer' o 'resolved_seller'
 * @param {string} resolutionNotes
 * @returns {Dispute}
 */
const resolveDispute = async (disputeId, adminId, resolution, resolutionNotes) => {
  const admin = await User.findByPk(adminId);
  if (!admin || admin.role !== 'admin') {
    const error = new Error('Solo el administrador puede resolver disputas.');
    error.statusCode = 403;
    throw error;
  }

  const dispute = await Dispute.findByPk(disputeId, {
    include: [{ model: Transaction, as: 'transaction' }]
  });

  if (!dispute) {
    const error = new Error('Disputa no encontrada.');
    error.statusCode = 404;
    throw error;
  }

  if (!['active', 'reviewing'].includes(dispute.status)) {
    const error = new Error('Esta disputa ya fue resuelta.');
    error.statusCode = 409;
    throw error;
  }

  const validResolutions = ['resolved_buyer', 'resolved_seller'];
  if (!validResolutions.includes(resolution)) {
    const error = new Error('Resolucion invalida. Use "resolved_buyer" o "resolved_seller".');
    error.statusCode = 400;
    throw error;
  }

  // Actualizar estado de la transaccion segun resolucion
  const newTransactionStatus = resolution === 'resolved_buyer' ? 'refunded' : 'completed';
  await dispute.transaction.update({ status: newTransactionStatus });

  // RF-10: la resolucion es irreversible
  await dispute.update({
    status: resolution,
    resolved_by: adminId,
    resolution_notes: resolutionNotes,
    resolved_at: new Date()
  });

  // Notificar a ambas partes (RF-10: "notificada por correo")
  try {
    const [buyer, seller] = await Promise.all([
      User.findByPk(dispute.transaction.buyer_id),
      User.findByPk(dispute.transaction.seller_id)
    ]);
    const { sendDisputeResolution } = require('./emailService');
    if (buyer) await sendDisputeResolution(buyer.email, buyer.name, resolution, resolutionNotes);
    if (seller) await sendDisputeResolution(seller.email, seller.name, resolution, resolutionNotes);
  } catch (emailError) {
    logger.error('Error enviando notificacion de resolucion de disputa:', emailError);
  }

  logger.info(`Disputa ${disputeId} resuelta: ${resolution} por admin ${adminId}`);
  return dispute;
};

/**
 * Lista todas las disputas activas. Solo para administradores.
 *
 * @param {string} adminId
 * @param {Object} filters - { status }
 * @returns {Array<Dispute>}
 */
const listDisputes = async (adminId, filters = {}) => {
  const admin = await User.findByPk(adminId);
  if (!admin || admin.role !== 'admin') {
    const error = new Error('Acceso restringido al administrador.');
    error.statusCode = 403;
    throw error;
  }

  const where = {};
  if (filters.status) where.status = filters.status;

  return Dispute.findAll({
    where,
    include: [
      { model: Transaction, as: 'transaction' },
      { model: User, as: 'reporter', attributes: ['id', 'name', 'email'] }
    ],
    order: [['created_at', 'DESC']]
  });
};

// ---------------------------------------------------------------------------
// CALIFICACIONES (RF-09)
// ---------------------------------------------------------------------------

/**
 * Registra una calificacion tras una transaccion completada.
 *
 * CP-010: rango valido 1-5. Valores fuera de rango -> error 400.
 * Criterio Gherkin RF-09: "Solo una calificacion por transaccion. Publica e inmutable."
 *
 * @param {string} transactionId
 * @param {string} raterId - Quien califica
 * @param {string} ratedUserId - A quien se califica
 * @param {number} score - 1 a 5
 * @param {string} comment
 * @param {string} ratedAs - 'seller' o 'buyer'
 * @returns {Rating}
 */
const createRating = async (transactionId, raterId, ratedUserId, score, comment, ratedAs) => {
  // CP-010: validacion explícita del rango (ademas del modelo)
  const numericScore = parseInt(score, 10);
  if (isNaN(numericScore) || numericScore < 1 || numericScore > 5) {
    const error = new Error('Calificacion fuera del rango permitido (1-5).');
    error.statusCode = 400;
    throw error;
  }

  const transaction = await Transaction.findByPk(transactionId);
  if (!transaction) {
    const error = new Error('Transaccion no encontrada.');
    error.statusCode = 404;
    throw error;
  }

  // Solo se puede calificar tras completar la transaccion
  if (transaction.status !== 'completed') {
    const error = new Error('Solo puedes calificar transacciones completadas.');
    error.statusCode = 400;
    throw error;
  }

  // Verificar que quien califica es parte de la transaccion
  const isParticipant = transaction.buyer_id === raterId || transaction.seller_id === raterId;
  if (!isParticipant) {
    const error = new Error('No eres parte de esta transaccion.');
    error.statusCode = 403;
    throw error;
  }

  // CP-010, RF-09: una sola calificacion por transaccion por rol (inmutable)
  const existing = await Rating.findOne({
    where: { transaction_id: transactionId, rater_id: raterId, rated_as: ratedAs }
  });
  if (existing) {
    const error = new Error('Ya calificaste a este usuario en esta transaccion.');
    error.statusCode = 409;
    throw error;
  }

  const rating = await Rating.create({
    transaction_id: transactionId,
    rater_id: raterId,
    rated_user_id: ratedUserId,
    score: numericScore,
    comment,
    rated_as: ratedAs
  });

  // Actualizar la reputacion acumulada del usuario calificado
  await updateUserReputation(ratedUserId);

  logger.info(`Calificacion registrada: ${score}/5 para usuario ${ratedUserId} en transaccion ${transactionId}`);
  return rating;
};

/**
 * Recalcula y actualiza la reputacion acumulada de un usuario.
 * Se llama despues de cada nueva calificacion recibida.
 *
 * @param {string} userId
 */
const updateUserReputation = async (userId) => {
  const ratings = await Rating.findAll({ where: { rated_user_id: userId } });

  if (ratings.length === 0) return;

  const total = ratings.reduce((sum, r) => sum + r.score, 0);
  const average = (total / ratings.length).toFixed(2);

  await User.update(
    { reputation_score: parseFloat(average), total_ratings: ratings.length },
    { where: { id: userId } }
  );
};

module.exports = { openDispute, resolveDispute, listDisputes, createRating };
