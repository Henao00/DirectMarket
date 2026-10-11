/**
 * DirectMarket - Utilidades del Frontend
 *
 * Funciones de formato, validacion y constantes compartidas
 * en todo el cliente. Sin dependencias externas.
 */

// ---------------------------------------------------------------------------
// FORMATEADORES
// ---------------------------------------------------------------------------

/**
 * Formatea un valor numerico como precio en pesos colombianos.
 * Ej: 1500.5 -> "$1.500"
 *
 * @param {number} amount
 * @returns {string}
 */
export const formatPrice = (amount) => {
  if (amount === null || amount === undefined) return '$0';
  return `$${parseFloat(amount).toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
};

/**
 * Formatea una fecha ISO a formato legible en espanol.
 * Ej: "2025-01-15T10:30:00Z" -> "15 de enero de 2025"
 *
 * @param {string|Date} dateStr
 * @returns {string}
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
};

/**
 * Formatea una fecha ISO a formato corto.
 * Ej: "2025-01-15T10:30:00Z" -> "15/01/2025 10:30"
 *
 * @param {string|Date} dateStr
 * @returns {string}
 */
export const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

/**
 * Calcula el tiempo relativo desde una fecha.
 * Ej: "hace 2 horas", "hace 3 dias"
 *
 * @param {string|Date} dateStr
 * @returns {string}
 */
export const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '-';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours   = Math.floor(diff / 3600000);
  const days    = Math.floor(diff / 86400000);

  if (minutes < 1)  return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
  if (hours < 24)   return `hace ${hours} hora${hours > 1 ? 's' : ''}`;
  if (days < 30)    return `hace ${days} dia${days > 1 ? 's' : ''}`;
  return formatDate(dateStr);
};

/**
 * Trunca un texto a una longitud maxima con elipsis.
 *
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
export const truncate = (text, maxLength = 100) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '...';
};

/**
 * Obtiene las iniciales de un nombre para avatares.
 * Ej: "Maria Garcia" -> "MG"
 *
 * @param {string} name
 * @returns {string}
 */
export const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
};

// ---------------------------------------------------------------------------
// VALIDADORES
// ---------------------------------------------------------------------------

/**
 * Valida que una fecha no sea en el pasado.
 * CP-006: la fecha del encuentro no puede ser en el pasado.
 *
 * @param {string|Date} date
 * @returns {boolean}
 */
export const isDateInFuture = (date) => {
  return new Date(date) > new Date();
};

/**
 * Valida que una calificacion este en el rango 1-5.
 * CP-010: calificacion fuera de rango -> error 400.
 *
 * @param {number} score
 * @returns {boolean}
 */
export const isValidRatingScore = (score) => {
  const n = parseInt(score, 10);
  return !isNaN(n) && n >= 1 && n <= 5;
};

/**
 * Valida formato de codigo de liberacion: 8 caracteres alfanumericos.
 * CP-007: codigo alfanumerico de exactamente 8 caracteres.
 *
 * @param {string} code
 * @returns {boolean}
 */
export const isValidReleaseCode = (code) => {
  return /^[A-Z2-9]{8}$/.test(code);
};

// ---------------------------------------------------------------------------
// CONSTANTES DE LA APLICACION
// ---------------------------------------------------------------------------

/**
 * Labels de estado de transaccion para la UI.
 * Referencia: ciclo de vida del escrow (RF-06, RF-07, RF-08).
 */
export const TRANSACTION_STATUS_LABELS = {
  pending_payment: 'Pago pendiente',
  escrow_held:     'En escrow',
  code_validated:  'Codigo validado',
  completed:       'Completada',
  disputed:        'En disputa',
  refunded:        'Reembolsada',
  cancelled:       'Cancelada'
};

/**
 * Labels de tipo de problema para disputas (RF-08).
 */
export const PROBLEM_TYPE_LABELS = {
  not_received:    'Producto no recibido',
  wrong_product:   'Producto incorrecto',
  damaged_product: 'Producto danado',
  fraud:           'Posible fraude',
  other:           'Otro problema'
};

/**
 * Labels de modalidad de pago (RF-03).
 */
export const PAYMENT_METHOD_LABELS = {
  cash:    'Efectivo',
  virtual: 'Pago virtual (Escrow)'
};

/**
 * Labels de tipo de producto (RF-02).
 */
export const PRODUCT_TYPE_LABELS = {
  physical: 'Producto fisico',
  digital:  'Producto digital'
};

/**
 * Reglas de negocio del sistema escrow.
 * Centralizadas aqui para que el frontend pueda mostrarlas
 * consistentemente al usuario.
 *
 * NOTA: Los valores reales se aplican en el backend.
 * Estos son solo para display en la UI.
 */
export const ESCROW_RULES = {
  CODE_LENGTH:        8,
  CODE_EXPIRY_HOURS:  24,
  MAX_ATTEMPTS:       3
};
