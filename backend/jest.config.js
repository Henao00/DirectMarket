/**
 * DirectMarket - Configuracion de Jest
 *
 * Configura el entorno de testing para Node.js.
 * Establece variables de entorno seguras para los tests.
 */

module.exports = {
  testEnvironment: 'node',

  // Solo ejecutar tests en el directorio src/tests
  testMatch: ['**/src/tests/**/*.test.js'],

  // Variables de entorno para el entorno de test
  testEnvironmentOptions: {},

  // Variables de entorno globales para todos los tests
  setupFiles: ['<rootDir>/src/tests/setup.js'],

  // Cobertura de codigo
  collectCoverageFrom: [
    'src/services/**/*.js',
    'src/middleware/**/*.js',
    'src/routes/**/*.js',
    '!src/tests/**'
  ],

  coverageThreshold: {
    global: {
      branches:  70,
      functions: 70,
      lines:     70,
      statements: 70
    }
  },

  // Timeout por test: 10 segundos (bcrypt puede tardar en entornos lentos)
  testTimeout: 10000,

  // Mostrar cada test individualmente
  verbose: true
};
