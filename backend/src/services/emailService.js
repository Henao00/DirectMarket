/**
 * DirectMarket - Servicio de Email
 *
 * Envia notificaciones para todos los eventos del sistema.
 * CP-001: email de verificacion tras registro
 * CP-008: notificacion de bloqueo de codigo al comprador y administrador
 * CP-009: notificacion de disputa al administrador
 * RF-10: notificacion de resolucion a ambas partes
 *
 * Usa Nodemailer. En desarrollo puede configurarse con Mailtrap o similar.
 */

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Crear transporte de email
const createTransport = () => {
  if (process.env.NODE_ENV === 'test') {
    // En testing no enviar emails reales
    return { sendMail: async () => ({ messageId: 'test-id' }) };
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

const transporter = createTransport();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const FROM_ADDRESS = `DirectMarket <${process.env.SMTP_USER || 'noreply@directmarket.com'}>`;

/**
 * Envia email de verificacion de cuenta.
 * CP-001: resultado esperado incluye "envía correo de verificacion".
 */
const sendVerificationEmail = async (email, name, token) => {
  const verificationUrl = `${FRONTEND_URL}/verify-email?token=${token}`;

  try {
    await transporter.sendMail({
      from: FROM_ADDRESS,
      to: email,
      subject: 'DirectMarket - Verifica tu cuenta',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">Bienvenido a DirectMarket, ${name}</h2>
          <p>Gracias por registrarte. Haz clic en el boton para verificar tu correo electronico:</p>
          <a href="${verificationUrl}"
             style="display: inline-block; background: #4f46e5; color: white;
                    padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 16px 0;">
            Verificar cuenta
          </a>
          <p style="color: #666; font-size: 14px;">
            Si no creaste esta cuenta, ignora este mensaje.
          </p>
          <p style="color: #666; font-size: 12px;">
            O copia este enlace: ${verificationUrl}
          </p>
        </div>
      `
    });
    logger.info(`Email de verificacion enviado a: ${email}`);
  } catch (error) {
    logger.error(`Error enviando email de verificacion a ${email}:`, error);
    throw error;
  }
};

/**
 * Notifica al comprador y al administrador que el codigo fue bloqueado.
 * CP-008: notificar al comprador y al administrador sobre la anomalia.
 *
 * @param {string} email
 * @param {string} name
 * @param {string} transactionId
 * @param {boolean} isAdmin
 */
const sendReleaseCodeBlockedEmail = async (email, name, transactionId, isAdmin = false) => {
  const subject = isAdmin
    ? 'DirectMarket - ALERTA: Codigo de liberacion bloqueado'
    : 'DirectMarket - Alerta de seguridad en tu transaccion';

  const adminMessage = isAdmin
    ? `<p><strong>Accion requerida:</strong> Revisar la transaccion ${transactionId} en el panel de administracion.</p>`
    : '';

  try {
    await transporter.sendMail({
      from: FROM_ADDRESS,
      to: email,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Alerta de seguridad</h2>
          <p>Hola ${name},</p>
          <p>El codigo de liberacion para la transaccion <strong>${transactionId}</strong>
             ha sido bloqueado por demasiados intentos incorrectos.</p>
          ${adminMessage}
          <p>Si no reconoces esta actividad, contacta a soporte de DirectMarket de inmediato.</p>
        </div>
      `
    });
  } catch (error) {
    logger.error(`Error enviando alerta de bloqueo a ${email}:`, error);
    throw error;
  }
};

/**
 * Notifica al administrador sobre una nueva disputa.
 * CP-009: "notifica al administrador" sobre el ticket abierto.
 */
const sendDisputeNotification = async (adminEmail, disputeId, transactionId) => {
  const disputeUrl = `${FRONTEND_URL}/admin/disputes/${disputeId}`;

  try {
    await transporter.sendMail({
      from: FROM_ADDRESS,
      to: adminEmail,
      subject: 'DirectMarket - Nueva disputa requiere atencion',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d97706;">Nueva disputa abierta</h2>
          <p>Se ha abierto un ticket de disputa para la transaccion <strong>${transactionId}</strong>.</p>
          <p>El pago ha sido congelado hasta que se resuelva la disputa.</p>
          <a href="${disputeUrl}"
             style="display: inline-block; background: #4f46e5; color: white;
                    padding: 12px 24px; border-radius: 6px; text-decoration: none;">
            Ver disputa
          </a>
        </div>
      `
    });
  } catch (error) {
    logger.error('Error enviando notificacion de disputa:', error);
    throw error;
  }
};

/**
 * Notifica la resolucion de una disputa a ambas partes.
 * RF-10: "notificada por correo" a ambas partes.
 */
const sendDisputeResolution = async (email, name, resolution, notes) => {
  const isBuyerFavor = resolution === 'resolved_buyer';
  const resultText = isBuyerFavor
    ? 'La disputa fue resuelta a tu favor. El reembolso sera procesado.'
    : 'La disputa fue resuelta a favor del vendedor. El pago sera liberado.';

  try {
    await transporter.sendMail({
      from: FROM_ADDRESS,
      to: email,
      subject: 'DirectMarket - Resolucion de disputa',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">Resolucion de disputa</h2>
          <p>Hola ${name},</p>
          <p>${resultText}</p>
          ${notes ? `<p><strong>Notas del administrador:</strong> ${notes}</p>` : ''}
          <p style="color: #666; font-size: 14px;">
            Esta decision es final e irreversible.
          </p>
        </div>
      `
    });
  } catch (error) {
    logger.error(`Error enviando resolucion de disputa a ${email}:`, error);
    throw error;
  }
};

module.exports = {
  sendVerificationEmail,
  sendReleaseCodeBlockedEmail,
  sendDisputeNotification,
  sendDisputeResolution
};
