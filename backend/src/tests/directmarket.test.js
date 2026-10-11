/**
 * DirectMarket - Suite Completa de Pruebas
 *
 * Implementa los casos de prueba CP-001 a CP-010 segun la documentacion.
 * Incluye todos los casos borde definidos.
 *
 * Trazabilidad:
 *   CP-001: RF-01 - Registro exitoso
 *   CP-002: RF-01 - Login con credenciales incorrectas / bloqueo 5 intentos
 *   CP-003: RF-02 - Publicacion con precio = 0
 *   CP-004: RF-02 - Producto digital sin archivo
 *   CP-005: RF-03 - Seleccion de modalidad de pago virtual
 *   CP-006: RF-04 - Encuentro con fecha pasada
 *   CP-007: RF-05/06 - Generacion de codigo unico de liberacion
 *   CP-008: RF-07 - Bloqueo tras 3 intentos incorrectos
 *   CP-009: RF-08 - Reporte de producto no recibido
 *   CP-010: RF-09 - Calificacion fuera del rango 1-5
 */

const { registerUser, loginUser } = require('../services/authService');
const { createProduct } = require('../services/productService');
const { initiateTransaction, confirmVirtualPayment, proposeMeeting } = require('../services/transactionService');
const { createReleaseCode, validateReleaseCode, getReleaseCodeStatus } = require('../services/releaseCodeService');
const { openDispute, createRating } = require('../services/disputeService');

// ---------------------------------------------------------------------------
// MOCKS - Evitar dependencias externas en pruebas unitarias
// ---------------------------------------------------------------------------

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

  const mockSeller = {
    id: 'user-seller-uuid',
    name: 'Maria Vendedora',
    email: 'maria@test.com',
    role: 'seller',
    email_verified: true,
    failed_login_attempts: 0,
    locked_until: null,
    update: jest.fn().mockResolvedValue(true)
  };

  const mockProduct = {
    id: 'product-uuid',
    seller_id: 'user-seller-uuid',
    title: 'Producto de prueba',
    price: 50.00,
    product_type: 'physical',
    status: 'active',
    stock: 5,
    accepted_payment_methods: ['cash', 'virtual'],
    update: jest.fn().mockResolvedValue(true)
  };

  const mockTransaction = {
    id: 'transaction-uuid',
    buyer_id: 'user-buyer-uuid',
    seller_id: 'user-seller-uuid',
    product_id: 'product-uuid',
    amount: 50.00,
    payment_method: 'virtual',
    status: 'escrow_held',
    product: mockProduct,
    update: jest.fn().mockResolvedValue(true)
  };

  const mockReleaseCode = {
    id: 'releasecode-uuid',
    transaction_id: 'transaction-uuid',
    code_hash: '$2a$10$mockhash',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    failed_attempts: 0,
    is_blocked: false,
    is_used: false,
    validated_at: null,
    transaction: mockTransaction,
    update: jest.fn().mockResolvedValue(true)
  };

  return {
    User: {
      findOne: jest.fn(),
      findByPk: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
      update: jest.fn()
    },
    Product: {
      findOne: jest.fn(),
      findByPk: jest.fn(),
      create: jest.fn(),
      findAndCountAll: jest.fn()
    },
    Transaction: {
      findOne: jest.fn(),
      findByPk: jest.fn(),
      create: jest.fn(),
      findAndCountAll: jest.fn()
    },
    ReleaseCode: {
      findOne: jest.fn(),
      findByPk: jest.fn(),
      create: jest.fn()
    },
    Meeting: {
      create: jest.fn()
    },
    Rating: {
      findOne: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn()
    },
    Dispute: {
      findOne: jest.fn(),
      findByPk: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn()
    },
    _mocks: { mockUser, mockSeller, mockProduct, mockTransaction, mockReleaseCode }
  };
});

jest.mock('../services/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendReleaseCodeBlockedEmail: jest.fn().mockResolvedValue(true),
  sendDisputeNotification: jest.fn().mockResolvedValue(true),
  sendDisputeResolution: jest.fn().mockResolvedValue(true)
}));

const bcrypt = require('bcryptjs');
const { User, Product, Transaction, ReleaseCode, Meeting, Rating, Dispute } = require('../models');

// ---------------------------------------------------------------------------
// CP-001: REGISTRO EXITOSO CON DATOS VALIDOS
// RF-01, Prioridad: Alta
// ---------------------------------------------------------------------------

describe('CP-001: Registro exitoso con datos validos (RF-01)', () => {
  beforeEach(() => {
    User.findOne.mockResolvedValue(null); // correo no existe
    User.create.mockResolvedValue({
      id: 'new-user-uuid',
      email: 'nuevo@test.com',
      name: 'Usuario Nuevo'
    });
  });

  test('debe crear la cuenta y retornar userId y email', async () => {
    const result = await registerUser({
      name: 'Usuario Nuevo',
      email: 'nuevo@test.com',
      password: 'Password123'
    });

    expect(result).toHaveProperty('userId');
    expect(result).toHaveProperty('email');
    expect(User.create).toHaveBeenCalledTimes(1);
  });

  test('debe enviar correo de verificacion', async () => {
    const { sendVerificationEmail } = require('../services/emailService');
    await registerUser({
      name: 'Usuario Nuevo',
      email: 'nuevo@test.com',
      password: 'Password123'
    });

    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  test('CASO BORDE: correo ya en uso debe lanzar error 409', async () => {
    User.findOne.mockResolvedValue({ id: 'existing', email: 'existente@test.com' });

    await expect(registerUser({
      name: 'Otro Usuario',
      email: 'existente@test.com',
      password: 'Password123'
    })).rejects.toMatchObject({
      message: 'Este correo ya esta en uso.',
      statusCode: 409
    });
  });
});

// ---------------------------------------------------------------------------
// CP-002: LOGIN CON CREDENCIALES INCORRECTAS / BLOQUEO
// RF-01, Prioridad: Alta
// ---------------------------------------------------------------------------

describe('CP-002: Login con credenciales incorrectas (RF-01)', () => {
  const mockUserWithHash = async (attempts = 0, lockedUntil = null) => {
    const hash = await bcrypt.hash('CorrectPass123', 10);
    return {
      id: 'user-uuid',
      email: 'test@test.com',
      password_hash: hash,
      role: 'buyer',
      failed_login_attempts: attempts,
      locked_until: lockedUntil,
      update: jest.fn().mockResolvedValue(true)
    };
  };

  test('credenciales incorrectas -> mensaje de error y no concede acceso', async () => {
    User.findOne.mockResolvedValue(await mockUserWithHash(0));

    await expect(loginUser('test@test.com', 'WrongPass123'))
      .rejects.toMatchObject({ message: 'Credenciales incorrectas.', statusCode: 401 });
  });

  test('CASO BORDE: tras 5 intentos fallidos la cuenta se bloquea por 15 minutos', async () => {
    // 4 intentos previos, este es el 5to (el que bloquea)
    const user = await mockUserWithHash(4);
    User.findOne.mockResolvedValue(user);

    await expect(loginUser('test@test.com', 'WrongPass'))
      .rejects.toMatchObject({ statusCode: 423 });

    // Verificar que se guardo locked_until
    expect(user.update).toHaveBeenCalledWith(
      expect.objectContaining({ locked_until: expect.any(Date) })
    );
  });

  test('cuenta bloqueada: acceso denegado aunque contrasena sea correcta', async () => {
    const futureDate = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos en el futuro
    User.findOne.mockResolvedValue(await mockUserWithHash(5, futureDate));

    await expect(loginUser('test@test.com', 'CorrectPass123'))
      .rejects.toMatchObject({ statusCode: 423 });
  });

  test('login exitoso con credenciales correctas retorna token JWT', async () => {
    User.findOne.mockResolvedValue(await mockUserWithHash(0));

    const result = await loginUser('test@test.com', 'CorrectPass123');

    expect(result).toHaveProperty('token');
    expect(result.token).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// CP-003: PUBLICACION CON PRECIO CERO
// RF-02, Prioridad: Alta
// ---------------------------------------------------------------------------

describe('CP-003: Publicacion de producto con precio cero (RF-02)', () => {
  test('precio = 0 debe lanzar error 400', async () => {
    await expect(createProduct('seller-uuid', {
      title: 'Producto cero',
      description: 'Descripcion del producto',
      price: 0,
      product_type: 'physical',
      images: ['img.jpg']
    })).rejects.toMatchObject({
      message: 'El precio debe ser mayor a $0.',
      statusCode: 400
    });
  });

  test('precio negativo debe lanzar error 400', async () => {
    await expect(createProduct('seller-uuid', {
      title: 'Producto negativo',
      description: 'Descripcion',
      price: -10,
      product_type: 'physical',
      images: ['img.jpg']
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  test('precio positivo valido debe crear el producto correctamente', async () => {
    Product.create.mockResolvedValue({ id: 'new-product', price: 25.50 });

    const result = await createProduct('seller-uuid', {
      title: 'Producto valido',
      description: 'Descripcion del producto',
      price: 25.50,
      product_type: 'physical',
      images: ['img.jpg']
    });

    expect(result).toHaveProperty('id');
    expect(Product.create).toHaveBeenCalledWith(
      expect.objectContaining({ price: 25.50 })
    );
  });
});

// ---------------------------------------------------------------------------
// CP-004: PRODUCTO DIGITAL SIN ARCHIVO
// RF-02, Prioridad: Media
// ---------------------------------------------------------------------------

describe('CP-004: Publicacion de producto digital sin archivo (RF-02)', () => {
  test('producto digital sin digital_file_url debe lanzar error 400', async () => {
    await expect(createProduct('seller-uuid', {
      title: 'Ebook sin archivo',
      description: 'Descripcion',
      price: 15.00,
      product_type: 'digital',
      digital_file_url: null,
      images: ['img.jpg']
    })).rejects.toMatchObject({
      message: 'Debe adjuntar el archivo del producto digital.',
      statusCode: 400
    });
  });

  test('producto digital con archivo adjunto debe publicarse correctamente', async () => {
    Product.create.mockResolvedValue({ id: 'digital-product', product_type: 'digital' });

    const result = await createProduct('seller-uuid', {
      title: 'Ebook valido',
      description: 'Descripcion',
      price: 15.00,
      product_type: 'digital',
      digital_file_url: 'https://storage.directmarket.com/files/ebook.pdf',
      images: ['cover.jpg']
    });

    expect(result).toHaveProperty('id');
  });

  test('producto fisico sin archivo debe publicarse correctamente (digital_file_url no aplica)', async () => {
    Product.create.mockResolvedValue({ id: 'physical-product', product_type: 'physical' });

    const result = await createProduct('seller-uuid', {
      title: 'Silla',
      description: 'Silla de madera',
      price: 80.00,
      product_type: 'physical',
      images: ['silla.jpg']
    });

    expect(result).toHaveProperty('id');
  });
});

// ---------------------------------------------------------------------------
// CP-005: SELECCION DE MODALIDAD DE PAGO VIRTUAL
// RF-03, Prioridad: Alta
// ---------------------------------------------------------------------------

describe('CP-005: Seleccion de modalidad de pago virtual (RF-03)', () => {
  const { _mocks } = require('../models');

  beforeEach(() => {
    Product.findByPk.mockResolvedValue(_mocks.mockProduct);
    Transaction.create.mockResolvedValue(_mocks.mockTransaction);
  });

  test('pago virtual habilita el flujo escrow', async () => {
    const transaction = await initiateTransaction('user-buyer-uuid', 'product-uuid', 'virtual');

    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_method: 'virtual' })
    );
  });

  test('vendedor no puede comprar su propio producto', async () => {
    await expect(
      initiateTransaction('user-seller-uuid', 'product-uuid', 'virtual')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('metodo de pago no aceptado por vendedor retorna error', async () => {
    Product.findByPk.mockResolvedValue({
      ..._mocks.mockProduct,
      accepted_payment_methods: ['cash'] // solo efectivo
    });

    await expect(
      initiateTransaction('user-buyer-uuid', 'product-uuid', 'virtual')
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ---------------------------------------------------------------------------
// CP-006: ENCUENTRO CON FECHA PASADA
// RF-04, Prioridad: Alta
// ---------------------------------------------------------------------------

describe('CP-006: Pactar encuentro con fecha pasada (RF-04)', () => {
  const { _mocks } = require('../models');

  beforeEach(() => {
    Transaction.findByPk.mockResolvedValue({
      ..._mocks.mockTransaction,
      payment_method: 'cash',
      buyer_id: 'user-buyer-uuid'
    });
  });

  test('fecha en el pasado debe lanzar error 400', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // ayer

    await expect(proposeMeeting('transaction-uuid', 'user-buyer-uuid', {
      meetingDate: pastDate.toISOString(),
      locationDescription: 'Centro comercial'
    })).rejects.toMatchObject({
      message: 'La fecha del encuentro no puede ser en el pasado.',
      statusCode: 400
    });
  });

  test('fecha igual a ahora (mismo instante) debe rechazarse', async () => {
    const now = new Date();

    await expect(proposeMeeting('transaction-uuid', 'user-buyer-uuid', {
      meetingDate: now.toISOString(),
      locationDescription: 'Parque central'
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  test('fecha futura valida debe crear el encuentro', async () => {
    const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 horas
    Meeting.create.mockResolvedValue({ id: 'meeting-uuid', status: 'proposed' });

    const meeting = await proposeMeeting('transaction-uuid', 'user-buyer-uuid', {
      meetingDate: futureDate.toISOString(),
      locationDescription: 'Plaza mayor'
    });

    expect(meeting).toHaveProperty('id');
  });

  test('lugar de encuentro vacio debe lanzar error', async () => {
    const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await expect(proposeMeeting('transaction-uuid', 'user-buyer-uuid', {
      meetingDate: futureDate.toISOString(),
      locationDescription: ''
    })).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ---------------------------------------------------------------------------
// CP-007: GENERACION DE CODIGO UNICO DE LIBERACION
// RF-05, RF-06, Prioridad: Alta
// ---------------------------------------------------------------------------

describe('CP-007: Generacion de codigo unico de liberacion (RF-05, RF-06)', () => {
  const { _mocks } = require('../models');

  beforeEach(() => {
    Transaction.findByPk.mockResolvedValue({
      ..._mocks.mockTransaction,
      status: 'escrow_held'
    });
    ReleaseCode.findOne.mockResolvedValue(null); // no existe codigo previo
    ReleaseCode.create.mockResolvedValue(_mocks.mockReleaseCode);
  });

  test('debe generar codigo alfanumerico de exactamente 8 caracteres', async () => {
    const result = await createReleaseCode('transaction-uuid');

    expect(result.code).toHaveLength(8);
    // Solo caracteres alfanumericos mayusculas (sin O, 0, I, 1 para evitar confusion)
    expect(result.code).toMatch(/^[A-Z2-9]+$/);
  });

  test('debe asignar fecha de expiracion de 24 horas (RNF-02)', async () => {
    const result = await createReleaseCode('transaction-uuid');

    const expectedExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const diff = Math.abs(result.expiresAt - expectedExpiry);

    // Diferencia de menos de 5 segundos (tolerancia de ejecucion)
    expect(diff).toBeLessThan(5000);
  });

  test('dos llamadas generan codigos diferentes (unicidad)', async () => {
    // Simular segunda creacion con una transaccion diferente
    Transaction.findByPk.mockResolvedValueOnce({
      ..._mocks.mockTransaction,
      id: 'transaction-uuid-2',
      status: 'escrow_held'
    });

    const result1 = await createReleaseCode('transaction-uuid');
    const result2 = await createReleaseCode('transaction-uuid-2');

    expect(result1.code).not.toEqual(result2.code);
  });

  test('transaccion no en escrow_held debe lanzar error', async () => {
    Transaction.findByPk.mockResolvedValue({
      ..._mocks.mockTransaction,
      status: 'pending_payment'
    });

    await expect(createReleaseCode('transaction-uuid'))
      .rejects.toMatchObject({ message: expect.stringContaining('escrow') });
  });

  test('getReleaseCodeStatus solo accesible por el comprador autenticado (CP-007)', async () => {
    Transaction.findByPk.mockResolvedValue(_mocks.mockTransaction);
    ReleaseCode.findOne.mockResolvedValue(_mocks.mockReleaseCode);

    const status = await getReleaseCodeStatus('transaction-uuid', 'user-buyer-uuid');
    expect(status.hasCode).toBe(true);

    // El vendedor no puede ver el codigo
    await expect(
      getReleaseCodeStatus('transaction-uuid', 'user-seller-uuid')
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ---------------------------------------------------------------------------
// CP-008: CODIGO DE LIBERACION INCORRECTO 3 VECES
// RF-07, Prioridad: Alta
// ---------------------------------------------------------------------------

describe('CP-008: Bloqueo tras 3 intentos incorrectos (RF-07)', () => {
  const { _mocks } = require('../models');

  const buildReleaseCode = (attempts) => ({
    ..._mocks.mockReleaseCode,
    code_hash: '$2a$10$incorrecthash',
    failed_attempts: attempts,
    is_blocked: attempts >= 3,
    is_used: false,
    transaction: {
      ..._mocks.mockTransaction,
      seller_id: 'user-seller-uuid'
    }
  });

  test('codigo incorrecto retorna attemptsRemaining', async () => {
    ReleaseCode.findOne.mockResolvedValue(buildReleaseCode(0));

    const result = await validateReleaseCode('transaction-uuid', 'WRONGCO1', 'user-seller-uuid');

    expect(result.success).toBe(false);
    expect(result).toHaveProperty('attemptsRemaining', 2);
  });

  test('CASO BORDE: 3er intento incorrecto bloquea el proceso', async () => {
    const codeObj = buildReleaseCode(2); // ya tiene 2 intentos, este es el 3ro
    ReleaseCode.findOne.mockResolvedValue(codeObj);

    const result = await validateReleaseCode('transaction-uuid', 'WRONGCO1', 'user-seller-uuid');

    expect(result.success).toBe(false);
    expect(result.blocked).toBe(true);
    expect(codeObj.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_blocked: true })
    );
  });

  test('codigo bloqueado no acepta mas intentos', async () => {
    ReleaseCode.findOne.mockResolvedValue(buildReleaseCode(3)); // ya bloqueado

    const result = await validateReleaseCode('transaction-uuid', 'CUALQUIE', 'user-seller-uuid');

    expect(result.success).toBe(false);
    expect(result.message).toContain('bloqueado');
  });

  test('codigo expirado retorna mensaje especifico (RNF-02)', async () => {
    ReleaseCode.findOne.mockResolvedValue({
      ...buildReleaseCode(0),
      expires_at: new Date(Date.now() - 1000), // ya expiro
      is_blocked: false,
      is_used: false
    });

    const result = await validateReleaseCode('transaction-uuid', 'EXPIRDC1', 'user-seller-uuid');

    expect(result.success).toBe(false);
    expect(result.message).toContain('expirado');
  });
});

// ---------------------------------------------------------------------------
// CP-009: REPORTE DE PRODUCTO NO RECIBIDO
// RF-08, Prioridad: Alta
// ---------------------------------------------------------------------------

describe('CP-009: Reporte de producto no recibido (RF-08)', () => {
  const { _mocks } = require('../models');

  beforeEach(() => {
    Transaction.findByPk.mockResolvedValue({
      ..._mocks.mockTransaction,
      status: 'escrow_held'
    });
    Dispute.findOne.mockResolvedValue(null); // no existe disputa previa
    User.findOne.mockResolvedValue({ id: 'admin-uuid', role: 'admin', email: 'admin@dm.com' });
    Dispute.create.mockResolvedValue({
      id: 'dispute-uuid',
      status: 'active',
      problem_type: 'not_received'
    });
  });

  test('debe abrir ticket de disputa y congelar el pago', async () => {
    const dispute = await openDispute('transaction-uuid', 'user-buyer-uuid', {
      problem_type: 'not_received',
      description: 'El producto fue marcado como entregado pero no lo recibi en la fecha acordada.'
    });

    expect(dispute).toHaveProperty('id');
    expect(dispute.status).toBe('active');

    // Verificar que el estado de la transaccion fue cambiado a 'disputed'
    const transaction = await Transaction.findByPk('transaction-uuid');
    expect(transaction.update).toHaveBeenCalledWith({ status: 'disputed' });
  });

  test('debe notificar al administrador', async () => {
    const { sendDisputeNotification } = require('../services/emailService');
    sendDisputeNotification.mockClear();

    await openDispute('transaction-uuid', 'user-buyer-uuid', {
      problem_type: 'not_received',
      description: 'No recibi el producto despues de 3 dias de la fecha acordada.'
    });

    expect(sendDisputeNotification).toHaveBeenCalledTimes(1);
  });

  test('solo el comprador puede abrir una disputa', async () => {
    await expect(openDispute('transaction-uuid', 'user-seller-uuid', {
      problem_type: 'not_received',
      description: 'Descripcion de al menos 20 caracteres aqui.'
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  test('descripcion muy corta debe rechazarse', async () => {
    await expect(openDispute('transaction-uuid', 'user-buyer-uuid', {
      problem_type: 'not_received',
      description: 'Corta'
    })).rejects.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// CP-010: CALIFICACION FUERA DEL RANGO PERMITIDO
// RF-09, Prioridad: Media
// ---------------------------------------------------------------------------

describe('CP-010: Calificacion fuera del rango permitido (RF-09)', () => {
  const { _mocks } = require('../models');

  beforeEach(() => {
    Transaction.findByPk.mockResolvedValue({
      ..._mocks.mockTransaction,
      status: 'completed',
      buyer_id: 'user-buyer-uuid',
      seller_id: 'user-seller-uuid'
    });
    Rating.findOne.mockResolvedValue(null); // no existe calificacion previa
    Rating.findAll.mockResolvedValue([]);
    User.update.mockResolvedValue(true);
    Rating.create.mockResolvedValue({ id: 'rating-uuid', score: 4 });
  });

  test('CASO BORDE: calificacion 0 debe retornar error 400', async () => {
    await expect(createRating(
      'transaction-uuid', 'user-buyer-uuid', 'user-seller-uuid', 0, '', 'seller'
    )).rejects.toMatchObject({
      message: 'Calificacion fuera del rango permitido (1-5).',
      statusCode: 400
    });
  });

  test('CASO BORDE: calificacion 6 debe retornar error 400', async () => {
    await expect(createRating(
      'transaction-uuid', 'user-buyer-uuid', 'user-seller-uuid', 6, '', 'seller'
    )).rejects.toMatchObject({
      message: 'Calificacion fuera del rango permitido (1-5).',
      statusCode: 400
    });
  });

  test('calificacion 1 (minimo valido) debe procesarse correctamente', async () => {
    const result = await createRating(
      'transaction-uuid', 'user-buyer-uuid', 'user-seller-uuid', 1, 'Regular', 'seller'
    );
    expect(result).toHaveProperty('id');
  });

  test('calificacion 5 (maximo valido) debe procesarse correctamente', async () => {
    const result = await createRating(
      'transaction-uuid', 'user-buyer-uuid', 'user-seller-uuid', 5, 'Excelente', 'seller'
    );
    expect(result).toHaveProperty('id');
  });

  test('calificacion duplicada en la misma transaccion debe rechazarse', async () => {
    Rating.findOne.mockResolvedValue({ id: 'existing-rating' });

    await expect(createRating(
      'transaction-uuid', 'user-buyer-uuid', 'user-seller-uuid', 4, '', 'seller'
    )).rejects.toMatchObject({ statusCode: 409 });
  });

  test('calificacion en transaccion no completada debe rechazarse', async () => {
    Transaction.findByPk.mockResolvedValue({
      ..._mocks.mockTransaction,
      status: 'escrow_held' // no esta completada
    });

    await expect(createRating(
      'transaction-uuid', 'user-buyer-uuid', 'user-seller-uuid', 4, '', 'seller'
    )).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ---------------------------------------------------------------------------
// PRUEBAS ADICIONALES DE INTEGRIDAD DEL SISTEMA ESCROW
// ---------------------------------------------------------------------------

describe('Integridad del sistema escrow (RF-06, RF-07)', () => {
  const { _mocks } = require('../models');

  test('codigo correcto libera el pago y marca transaccion como completed (Gherkin RF-07)', async () => {
    const plainCode = 'VALIDCO8';
    const hash = await bcrypt.hash(plainCode, 10);

    ReleaseCode.findOne.mockResolvedValue({
      ..._mocks.mockReleaseCode,
      code_hash: hash,
      failed_attempts: 0,
      is_blocked: false,
      is_used: false,
      transaction: {
        ..._mocks.mockTransaction,
        seller_id: 'user-seller-uuid',
        status: 'escrow_held',
        update: jest.fn().mockResolvedValue(true)
      }
    });

    const result = await validateReleaseCode('transaction-uuid', plainCode, 'user-seller-uuid');

    expect(result.success).toBe(true);
    expect(result.message).toContain('liberado');
  });

  test('codigo ya utilizado no puede reutilizarse', async () => {
    ReleaseCode.findOne.mockResolvedValue({
      ..._mocks.mockReleaseCode,
      is_used: true,
      transaction: { seller_id: 'user-seller-uuid' }
    });

    const result = await validateReleaseCode('transaction-uuid', 'CUALQUIE', 'user-seller-uuid');

    expect(result.success).toBe(false);
    expect(result.message).toContain('ya fue utilizado');
  });
});
