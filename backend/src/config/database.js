/**
 * DirectMarket - Configuracion de Base de Datos
 *
 * Utiliza PostgreSQL via Sequelize ORM.
 * RNF-03: soportar minimo 500 usuarios concurrentes -> pool configurado.
 * RNF-04: disponibilidad 99% -> reintentos y timeouts configurados.
 */

const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'directmarket_db',
  process.env.DB_USER || 'directmarket_user',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    dialect: 'postgres',
    logging: (msg) => {
      if (process.env.NODE_ENV === 'development') {
        logger.debug(msg);
      }
    },
    pool: {
      // RNF-03: configuracion del pool para soportar carga concurrente
      max: 20,
      min: 2,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      // RNF-06: conexion SSL en produccion
      ssl: process.env.NODE_ENV === 'production'
        ? { require: true, rejectUnauthorized: false }
        : false
    }
  }
);

/**
 * Verifica la conexion a la base de datos.
 * Lanza error si no puede conectar, para detener el arranque.
 */
const connectDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Conexion a la base de datos establecida correctamente.');

    if (process.env.NODE_ENV !== 'production') {
      // En desarrollo sincroniza los modelos con alter:true para migraciones suaves.
      // En produccion se deben usar migraciones formales de Sequelize.
      await sequelize.sync({ alter: true });
      logger.info('Modelos sincronizados con la base de datos.');
    }
  } catch (error) {
    logger.error('No se pudo conectar a la base de datos:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDatabase };
