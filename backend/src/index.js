/**
 * DirectMarket - Punto de Entrada del Servidor Express
 *
 * Configura todos los middlewares de seguridad, CORS, logging y monta las rutas.
 * RNF-06: HTTPS, Helmet, CORS restrictivo, rate limiting
 */

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const { connectDatabase } = require('./config/database');
const routes = require('./routes');
const logger = require('./utils/logger');

const app = express();

// ---------------------------------------------------------------------------
// MIDDLEWARES DE SEGURIDAD
// ---------------------------------------------------------------------------

// Helmet: configura headers HTTP seguros (XSS, clickjacking, HSTS, etc.)
// RNF-06: estandares de seguridad web
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"]
    }
  }
}));

// CORS: solo permite el origen del frontend configurado
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',');
app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origen (ej: herramientas de testing)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origen no permitido por CORS.'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parseo de JSON con limite de tamano para prevenir ataques de payload grande
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging de solicitudes HTTP
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) }
  }));
}

// ---------------------------------------------------------------------------
// RUTAS
// ---------------------------------------------------------------------------

app.use('/api', routes);

// Health check para monitoreo (RNF-04: disponibilidad 99%)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// ---------------------------------------------------------------------------
// MANEJO GLOBAL DE ERRORES
// ---------------------------------------------------------------------------

// 404 para rutas no existentes
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint no encontrado.' });
});

// Manejador global de errores no capturados
app.use((err, req, res, next) => {
  logger.error('Error no manejado:', err);

  // No exponer detalles internos en produccion
  const message = process.env.NODE_ENV === 'production'
    ? 'Error interno del servidor.'
    : err.message;

  res.status(err.statusCode || 500).json({ success: false, message });
});

// ---------------------------------------------------------------------------
// INICIO DEL SERVIDOR
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT, 10) || 4000;

const startServer = async () => {
  await connectDatabase();

  app.listen(PORT, () => {
    logger.info(`DirectMarket API iniciada en puerto ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });
};

// Solo iniciar si no estamos en modo test (Jest importa este archivo)
if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    logger.error('Error al iniciar el servidor:', err);
    process.exit(1);
  });
}

module.exports = app;
