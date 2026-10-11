/**
 * DirectMarket - Servicio de Transacciones y Encuentros
 *
 * Trazabilidad:
 *   RF-03: elegir modalidad de pago (efectivo o virtual)
 *   RF-04: pactar lugar, fecha y hora para encuentro fisico
 *   RF-06: retener dinero hasta validacion del codigo
 *   CP-005: flujo de pago virtual habilitado correctamente
 *   CP-006: fecha de encuentro no puede ser en el pasado
 */

const { Transaction, Product, User, Meeting, ReleaseCode } = require('../models');
const { createReleaseCode } = require('./releaseCodeService');
const logger = require('../utils/logger');

/**
 * Inicia una transaccion de compra.
 * Crea la transaccion en estado 'pending_payment'.
 *
 * @param {string} buyerId
 * @param {string} productId
 * @param {string} paymentMethod - 'cash' o 'virtual'
 * @returns {Transaction}
 */
const initiateTransaction = async (buyerId, productId, paymentMethod) => {
  const product = await Product.findByPk(productId);

  if (!product || product.status !== 'active') {
    const error = new Error('Producto no disponible.');
    error.statusCode = 404;
    throw error;
  }

  if (product.seller_id === buyerId) {
    const error = new Error('No puedes comprar tu propio producto.');
    error.statusCode = 400;
    throw error;
  }

  // RF-03: verificar que el vendedor acepta la modalidad de pago elegida
  if (!product.accepted_payment_methods.includes(paymentMethod)) {
    const error = new Error(`El vendedor no acepta pagos en modalidad "${paymentMethod}".`);
    error.statusCode = 400;
    throw error;
  }

  if (product.stock < 1) {
    const error = new Error('Producto sin stock disponible.');
    error.statusCode = 400;
    throw error;
  }

  const transaction = await Transaction.create({
    buyer_id: buyerId,
    seller_id: product.seller_id,
    product_id: productId,
    amount: product.price,
    payment_method: paymentMethod,
    status: 'pending_payment'
  });

  logger.info(`Transaccion iniciada: ${transaction.id}, metodo: ${paymentMethod}`);
  return transaction;
};

/**
 * Confirma el pago virtual y activa el escrow.
 * Simula la confirmacion de la pasarela de pagos externa.
 * En produccion esta funcion seria llamada por el webhook de la pasarela.
 *
 * RF-06: el dinero queda retenido en escrow tras la confirmacion.
 * RF-05: se genera automaticamente el codigo de liberacion.
 *
 * @param {string} transactionId
 * @param {string} buyerId - Para verificar que el comprador es quien confirma
 * @param {string} gatewayRef - Referencia de la pasarela de pagos
 * @returns {Object} { transaction, releaseCode: { code, expiresAt } }
 */
const confirmVirtualPayment = async (transactionId, buyerId, gatewayRef) => {
  const transaction = await Transaction.findByPk(transactionId, {
    include: [{ model: Product, as: 'product' }]
  });

  if (!transaction) {
    const error = new Error('Transaccion no encontrada.');
    error.statusCode = 404;
    throw error;
  }

  if (transaction.buyer_id !== buyerId) {
    const error = new Error('No autorizado para confirmar esta transaccion.');
    error.statusCode = 403;
    throw error;
  }

  if (transaction.payment_method !== 'virtual') {
    const error = new Error('Esta transaccion no es de tipo pago virtual.');
    error.statusCode = 400;
    throw error;
  }

  if (transaction.status !== 'pending_payment') {
    const error = new Error('La transaccion ya fue procesada.');
    error.statusCode = 409;
    throw error;
  }

  // Actualizar estado a escrow_held: dinero retenido
  await transaction.update({
    status: 'escrow_held',
    payment_gateway_ref: gatewayRef
  });

  // Reducir stock del producto
  await transaction.product.update({ stock: transaction.product.stock - 1 });

  // RF-05: generar codigo de liberacion automaticamente
  const releaseCodeData = await createReleaseCode(transactionId);

  logger.info(`Pago virtual confirmado. Escrow activo. Transaccion: ${transactionId}`);

  return { transaction, releaseCode: releaseCodeData };
};

/**
 * Propone un encuentro fisico para una transaccion en efectivo.
 *
 * CP-006: la fecha del encuentro no puede ser en el pasado.
 * RF-04: lugar de encuentro es campo requerido.
 *
 * @param {string} transactionId
 * @param {string} proposedBy - UUID del usuario que propone (comprador o vendedor)
 * @param {Object} meetingData - { meetingDate, locationDescription, notes }
 * @returns {Meeting}
 */
const proposeMeeting = async (transactionId, proposedBy, meetingData) => {
  const { meetingDate, locationDescription, notes } = meetingData;

  const transaction = await Transaction.findByPk(transactionId);
  if (!transaction) {
    const error = new Error('Transaccion no encontrada.');
    error.statusCode = 404;
    throw error;
  }

  // Solo el comprador o vendedor de la transaccion puede proponer encuentro
  const isParticipant = transaction.buyer_id === proposedBy || transaction.seller_id === proposedBy;
  if (!isParticipant) {
    const error = new Error('No autorizado para gestionar esta transaccion.');
    error.statusCode = 403;
    throw error;
  }

  if (transaction.payment_method !== 'cash') {
    const error = new Error('Los encuentros fisicos solo aplican para pagos en efectivo.');
    error.statusCode = 400;
    throw error;
  }

  // CP-006: validacion de fecha -> no puede ser en el pasado
  const proposedDate = new Date(meetingDate);
  if (proposedDate <= new Date()) {
    const error = new Error('La fecha del encuentro no puede ser en el pasado.');
    error.statusCode = 400;
    error.field = 'meetingDate';
    throw error;
  }

  // RF-04: lugar de encuentro requerido
  if (!locationDescription || locationDescription.trim() === '') {
    const error = new Error('El lugar del encuentro es obligatorio.');
    error.statusCode = 400;
    error.field = 'locationDescription';
    throw error;
  }

  const meeting = await Meeting.create({
    transaction_id: transactionId,
    proposed_by: proposedBy,
    meeting_date: proposedDate,
    location_description: locationDescription.trim(),
    notes,
    status: 'proposed'
  });

  logger.info(`Encuentro propuesto para transaccion: ${transactionId}`);
  return meeting;
};

/**
 * Confirma o rechaza una propuesta de encuentro.
 *
 * @param {string} meetingId
 * @param {string} userId - Quien confirma (debe ser la otra parte)
 * @param {string} action - 'confirm' o 'reject'
 * @returns {Meeting}
 */
const respondToMeeting = async (meetingId, userId, action) => {
  const meeting = await Meeting.findByPk(meetingId, {
    include: [{ model: Transaction, as: 'transaction' }]
  });

  if (!meeting) {
    const error = new Error('Propuesta de encuentro no encontrada.');
    error.statusCode = 404;
    throw error;
  }

  // La respuesta debe venir de la parte que NO propuso
  if (meeting.proposed_by === userId) {
    const error = new Error('No puedes responder a tu propia propuesta de encuentro.');
    error.statusCode = 400;
    throw error;
  }

  const transaction = meeting.transaction;
  const isParticipant = transaction.buyer_id === userId || transaction.seller_id === userId;
  if (!isParticipant) {
    const error = new Error('No autorizado para responder a esta propuesta.');
    error.statusCode = 403;
    throw error;
  }

  const newStatus = action === 'confirm' ? 'confirmed' : 'cancelled';
  await meeting.update({ status: newStatus });

  return meeting;
};

/**
 * Obtiene el historial de transacciones de un usuario (compras o ventas).
 *
 * @param {string} userId
 * @param {string} role - 'buyer' o 'seller'
 * @param {number} page
 * @param {number} limit
 * @returns {Object} { transactions, total, page, totalPages }
 */
const getUserTransactions = async (userId, role = 'buyer', page = 1, limit = 20) => {
  const where = role === 'buyer'
    ? { buyer_id: userId }
    : { seller_id: userId };

  const offset = (page - 1) * limit;
  const { count, rows } = await Transaction.findAndCountAll({
    where,
    include: [
      { model: Product, as: 'product', attributes: ['id', 'title', 'price', 'images', 'product_type'] },
      { model: User, as: role === 'buyer' ? 'seller' : 'buyer', attributes: ['id', 'name', 'reputation_score'] }
    ],
    order: [['created_at', 'DESC']],
    limit,
    offset
  });

  return {
    transactions: rows,
    total: count,
    page,
    totalPages: Math.ceil(count / limit)
  };
};

module.exports = {
  initiateTransaction,
  confirmVirtualPayment,
  proposeMeeting,
  respondToMeeting,
  getUserTransactions
};
