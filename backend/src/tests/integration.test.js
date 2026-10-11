/**
 * DirectMarket - Tests de Integracion (Supertest)
 *
 * Prueban el ciclo completo request/response de cada endpoint.
 * Verifican que las validaciones de middleware, autenticacion y
 * reglas de negocio respondan con los status codes y mensajes correctos.
 *
 * Estos tests complementan los tests unitarios de servicios.
 *
 * NOTA: Requieren que la BD este disponible. En CI usar la variable
 * DB_HOST apuntando a un contenedor PostgreSQL de test.
 *
 * Para ejecutar solo los unitarios sin BD: npm test
 * Para ejecutar con integracion: npm run test:integration
 */

const request = require('supertest');
const app     = require('../index');
const bcrypt  = require('bcryptjs');

// Mock completo de la BD para que los tests no requieran PostgreSQL real
jest.mock('../config/database', () => ({
  connectDatabase: jest.fn().mockResolvedValue(true),
  sequelize: {
    authenticate: jest.fn().mockResolvedValue(true),
    sync: jest.fn().mockResolvedValue(true),
    define: jest.fn()
  }
}));

jest.mock('../models', () => {
  const mockUser = {
    id: 'user-buyer-uuid',
    name: 'Juan Comprador',
    email: 'juan@test.com',
    role: 'buyer',
    email_verified: true,
    failed_login_attempts: 0,
    locked_until: null,
    reputation_score: 0,
    total_ratings: 0,
    update: jest.fn().mockResolvedValue(true)
  };

  return {
    User:        { findOne: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
    Product:     { findOne: jest.fn(), findByPk: jest.fn(), create: jest.fn(), findAndCountAll: jest.fn() },
    Transaction: { findOne: jest.fn(), findByPk: jest.fn(), create: jest.fn(), findAndCountAll: jest.fn() },
    ReleaseCode: { findOne: jest.fn(), create: jest.fn() },
    Meeting:     { create: jest.fn() },
    Rating:      { findOne: jest.fn(), findAll: jest.fn(), create: jest.fn() },
    Dispute:     { findOne: jest.fn(), findByPk: jest.fn(), create: jest.fn(), findAll: jest.fn() },
    _mockUser:   mockUser
  };
});

jest.mock('../services/emailService', () => ({
  sendVerificationEmail:      jest.fn().mockResolvedValue(true),
  sendReleaseCodeBlockedEmail: jest.fn().mockResolvedValue(true),
  sendDisputeNotification:    jest.fn().mockResolvedValue(true),
  sendDisputeResolution:      jest.fn().mockResolvedValue(true)
}));

const { User, Product, Transaction, ReleaseCode } = require('../models');
const jwt = require('jsonwebtoken');

// Helper para generar tokens de test
const makeToken = (userId, role = 'buyer') =>
  jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '1h' });

// Helper para mockear un usuario autenticado
const mockAuthUser = (overrides = {}) => {
  const base = {
    id: 'user-buyer-uuid',
    name: 'Test User',
    email: 'test@test.com',
    role: 'buyer',
    email_verified: true,
    locked_until: null,
    update: jest.fn().mockResolvedValue(true)
  };
  User.findByPk.mockResolvedValue({ ...base, ...overrides });
};

// =============================================================================
// TESTS DE AUTENTICACION (RF-01)
// =============================================================================

describe('POST /api/auth/register', () => {
  beforeEach(() => jest.clearAllMocks());

  test('CP-001: registro exitoso retorna 201 con userId', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({ id: 'new-uuid', email: 'nuevo@test.com', name: 'Nuevo' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Nuevo Usuario', email: 'nuevo@test.com', password: 'Password123' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('userId');
  });

  test('CP-001 borde: correo duplicado retorna 409', async () => {
    User.findOne.mockResolvedValue({ id: 'existing', email: 'existente@test.com' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Otro', email: 'existente@test.com', password: 'Password123' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/ya est/i);
  });

  test('validacion: email invalido retorna 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test', email: 'no-es-email', password: 'Password123' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  test('validacion: contrasena sin mayusculas retorna 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test', email: 'test@test.com', password: 'sinmayusculas1' });

    expect(res.status).toBe(400);
  });

  test('validacion: contrasena menor a 8 caracteres retorna 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test', email: 'test@test.com', password: 'Ab1' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => jest.clearAllMocks());

  test('CP-002: credenciales incorrectas retorna 401', async () => {
    const hash = await bcrypt.hash('CorrectPass1', 10);
    User.findOne.mockResolvedValue({
      id: 'u1', email: 'test@test.com', password_hash: hash,
      role: 'buyer', failed_login_attempts: 0, locked_until: null,
      update: jest.fn().mockResolvedValue(true)
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'WrongPass1' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/credenciales/i);
  });

  test('CP-002 borde: cuenta bloqueada retorna 423', async () => {
    User.findOne.mockResolvedValue({
      id: 'u1', email: 'test@test.com',
      password_hash: '$2a$10$fake',
      role: 'buyer', failed_login_attempts: 5,
      locked_until: new Date(Date.now() + 10 * 60 * 1000),
      update: jest.fn().mockResolvedValue(true)
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'AnyPass1' });

    expect(res.status).toBe(423);
    expect(res.body.message).toMatch(/bloqueada/i);
  });

  test('login exitoso retorna token JWT', async () => {
    const hash = await bcrypt.hash('CorrectPass1', 10);
    User.findOne.mockResolvedValue({
      id: 'u1', name: 'Test', email: 'test@test.com', password_hash: hash,
      role: 'buyer', email_verified: true, failed_login_attempts: 0, locked_until: null,
      reputation_score: 0, total_ratings: 0,
      update: jest.fn().mockResolvedValue(true)
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'CorrectPass1' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.token).toBeTruthy();
  });
});

// =============================================================================
// TESTS DE PRODUCTOS (RF-02)
// =============================================================================

describe('POST /api/products', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser({ email_verified: true });
  });

  const token = () => makeToken('user-buyer-uuid', 'buyer');

  test('CP-003: precio = 0 retorna 400', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        title: 'Test', description: 'Desc', price: 0,
        product_type: 'physical', images: ['img.jpg']
      });

    expect(res.status).toBe(400);
    expect(res.body.message || JSON.stringify(res.body.errors)).toMatch(/precio|price/i);
  });

  test('CP-003 borde: precio negativo retorna 400', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        title: 'Test', description: 'Desc', price: -5,
        product_type: 'physical', images: ['img.jpg']
      });

    expect(res.status).toBe(400);
  });

  test('sin token retorna 401', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ title: 'Test', price: 10, product_type: 'physical' });

    expect(res.status).toBe(401);
  });
});

// =============================================================================
// TESTS DEL SISTEMA ESCROW (RF-05, RF-07)
// =============================================================================

describe('POST /api/transactions/validate-code', () => {
  beforeEach(() => jest.clearAllMocks());

  test('codigo con menos de 8 caracteres retorna 400', async () => {
    mockAuthUser();
    const res = await request(app)
      .post('/api/transactions/validate-code')
      .set('Authorization', `Bearer ${makeToken('user-seller-uuid', 'seller')}`)
      .send({ transaction_id: 'valid-uuid-1234-5678-9012-345678901234', code: 'CORTO' });

    expect(res.status).toBe(400);
  });

  test('codigo con mas de 8 caracteres retorna 400', async () => {
    mockAuthUser();
    const res = await request(app)
      .post('/api/transactions/validate-code')
      .set('Authorization', `Bearer ${makeToken('user-seller-uuid', 'seller')}`)
      .send({ transaction_id: 'valid-uuid-1234-5678-9012-345678901234', code: 'TOOLONGCODE' });

    expect(res.status).toBe(400);
  });

  test('transaction_id invalido (no UUID) retorna 400', async () => {
    mockAuthUser();
    const res = await request(app)
      .post('/api/transactions/validate-code')
      .set('Authorization', `Bearer ${makeToken('user-seller-uuid', 'seller')}`)
      .send({ transaction_id: 'no-es-uuid', code: 'VALIDCO8' });

    expect(res.status).toBe(400);
  });
});

// =============================================================================
// TESTS DE DISPUTAS (RF-08)
// =============================================================================

describe('POST /api/transactions/:id/dispute', () => {
  beforeEach(() => jest.clearAllMocks());

  test('descripcion demasiado corta retorna 400', async () => {
    mockAuthUser();
    const res = await request(app)
      .post('/api/transactions/valid-tx-uuid-1234-5678/dispute')
      .set('Authorization', `Bearer ${makeToken('user-buyer-uuid')}`)
      .send({ problem_type: 'not_received', description: 'Corta' });

    expect(res.status).toBe(400);
  });

  test('tipo de problema invalido retorna 400', async () => {
    mockAuthUser();
    const res = await request(app)
      .post('/api/transactions/valid-tx-uuid-1234-5678/dispute')
      .set('Authorization', `Bearer ${makeToken('user-buyer-uuid')}`)
      .send({
        problem_type: 'tipo_inventado',
        description: 'Descripcion con suficientes caracteres para pasar la validacion minima.'
      });

    expect(res.status).toBe(400);
  });

  test('sin autenticacion retorna 401', async () => {
    const res = await request(app)
      .post('/api/transactions/valid-tx-uuid-1234-5678/dispute')
      .send({ problem_type: 'not_received', description: 'Texto suficientemente largo.' });

    expect(res.status).toBe(401);
  });
});

// =============================================================================
// TESTS DE CALIFICACIONES (RF-09)
// =============================================================================

describe('POST /api/ratings/:transactionId', () => {
  beforeEach(() => jest.clearAllMocks());

  test('CP-010: score = 0 retorna 400', async () => {
    mockAuthUser();
    const res = await request(app)
      .post('/api/ratings/valid-tx-uuid-1234-5678')
      .set('Authorization', `Bearer ${makeToken('user-buyer-uuid')}`)
      .send({ score: 0, rated_user_id: 'valid-user-uuid-1234', rated_as: 'seller' });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/1-5|rango/i);
  });

  test('CP-010: score = 6 retorna 400', async () => {
    mockAuthUser();
    const res = await request(app)
      .post('/api/ratings/valid-tx-uuid-1234-5678')
      .set('Authorization', `Bearer ${makeToken('user-buyer-uuid')}`)
      .send({ score: 6, rated_user_id: 'valid-user-uuid-1234', rated_as: 'seller' });

    expect(res.status).toBe(400);
  });

  test('rated_as invalido retorna 400', async () => {
    mockAuthUser();
    const res = await request(app)
      .post('/api/ratings/valid-tx-uuid-1234-5678')
      .set('Authorization', `Bearer ${makeToken('user-buyer-uuid')}`)
      .send({ score: 4, rated_user_id: 'valid-user-uuid-1234', rated_as: 'admin' });

    expect(res.status).toBe(400);
  });
});

// =============================================================================
// TESTS DE ADMINISTRADOR (RF-10)
// =============================================================================

describe('PUT /api/admin/disputes/:id/resolve', () => {
  beforeEach(() => jest.clearAllMocks());

  test('usuario no-admin recibe 403', async () => {
    mockAuthUser({ role: 'buyer' });
    const res = await request(app)
      .put('/api/admin/disputes/valid-dispute-uuid-1234/resolve')
      .set('Authorization', `Bearer ${makeToken('user-buyer-uuid', 'buyer')}`)
      .send({ resolution: 'resolved_buyer', resolution_notes: 'Notas de resolucion.' });

    expect(res.status).toBe(403);
  });

  test('resolucion invalida retorna 400', async () => {
    mockAuthUser({ role: 'admin' });
    const res = await request(app)
      .put('/api/admin/disputes/valid-dispute-uuid-1234/resolve')
      .set('Authorization', `Bearer ${makeToken('admin-uuid', 'admin')}`)
      .send({ resolution: 'opcion_invalida', resolution_notes: 'Notas validas aqui.' });

    expect(res.status).toBe(400);
  });

  test('notas demasiado cortas retorna 400', async () => {
    mockAuthUser({ role: 'admin' });
    const res = await request(app)
      .put('/api/admin/disputes/valid-dispute-uuid-1234/resolve')
      .set('Authorization', `Bearer ${makeToken('admin-uuid', 'admin')}`)
      .send({ resolution: 'resolved_buyer', resolution_notes: 'Corto' });

    expect(res.status).toBe(400);
  });
});

// =============================================================================
// TESTS DE ENCUENTROS FISICOS (RF-04)
// =============================================================================

describe('POST /api/transactions/:id/meetings', () => {
  beforeEach(() => jest.clearAllMocks());

  test('CP-006: fecha en el pasado retorna 400', async () => {
    mockAuthUser();
    const pastDate = new Date(Date.now() - 86400000).toISOString();

    const res = await request(app)
      .post('/api/transactions/valid-tx-uuid-1234-5678/meetings')
      .set('Authorization', `Bearer ${makeToken('user-buyer-uuid')}`)
      .send({ meetingDate: pastDate, locationDescription: 'Centro comercial' });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/pasado/i);
  });

  test('lugar vacio retorna 400', async () => {
    mockAuthUser();
    const futureDate = new Date(Date.now() + 86400000).toISOString();

    const res = await request(app)
      .post('/api/transactions/valid-tx-uuid-1234-5678/meetings')
      .set('Authorization', `Bearer ${makeToken('user-buyer-uuid')}`)
      .send({ meetingDate: futureDate, locationDescription: '' });

    expect(res.status).toBe(400);
  });
});

// =============================================================================
// HEALTH CHECK
// =============================================================================

describe('GET /health', () => {
  test('retorna 200 con status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
