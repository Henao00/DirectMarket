/**
 * DirectMarket - Setup global de tests Jest
 *
 * Se ejecuta antes de cada archivo de test.
 * Establece las variables de entorno necesarias para los servicios.
 */

// Variables de entorno para el entorno de test
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-solo-para-testing-no-usar-en-produccion';
process.env.JWT_EXPIRES_IN = '1h';
process.env.RELEASE_CODE_MAX_ATTEMPTS = '3';
process.env.RELEASE_CODE_EXPIRY_HOURS = '24';
process.env.LOGIN_MAX_ATTEMPTS = '5';
process.env.LOGIN_BLOCK_MINUTES = '15';
process.env.FRONTEND_URL = 'http://localhost:3000';

// Silenciar el logger de Winston durante los tests para mantener la salida limpia
jest.mock('../utils/logger', () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));
