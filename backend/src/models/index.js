/**
 * DirectMarket - Modelos de Base de Datos
 *
 * Trazabilidad:
 *   - Modelo User      : RF-01, CU-Auth-01
 *   - Modelo Product   : RF-02, CU-Producto-01
 *   - Modelo Transaction: RF-03, RF-06, CU-Pago-01, CU-Escrow-01
 *   - Modelo ReleaseCode: RF-05, RF-07, CU-Codigo-01, CU-Liberacion-01, RNF-02
 *   - Modelo Rating    : RF-09, CU-Calificacion-01
 *   - Modelo Dispute   : RF-08, RF-10, CU-Reporte-01, CU-Admin-01
 *   - Modelo Meeting   : RF-04, CU-Encuentro-01
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// ---------------------------------------------------------------------------
// MODELO: User
// Cubre RF-01. Almacena autenticacion y perfil de usuario.
// ---------------------------------------------------------------------------
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'El nombre es obligatorio.' },
      len: { args: [2, 100], msg: 'El nombre debe tener entre 2 y 100 caracteres.' }
    }
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: { msg: 'Este correo ya esta en uso.' },
    validate: {
      isEmail: { msg: 'Formato de correo invalido.' }
    }
  },
  // Contrasena almacenada como hash bcrypt (nunca en texto plano)
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('buyer', 'seller', 'admin'),
    defaultValue: 'buyer'
  },
  // Control de intentos de login fallidos (CP-002: bloqueo tras 5 intentos)
  failed_login_attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  locked_until: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Verificacion de correo electronico
  email_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  email_verification_token: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  // Reputacion acumulada del usuario
  reputation_score: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0.00
  },
  total_ratings: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true
});

// ---------------------------------------------------------------------------
// MODELO: Product
// Cubre RF-02. Productos fisicos y digitales publicados por vendedores.
// ---------------------------------------------------------------------------
const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  seller_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'El titulo del producto es obligatorio.' },
      len: { args: [3, 200], msg: 'El titulo debe tener entre 3 y 200 caracteres.' }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'La descripcion es obligatoria.' }
    }
  },
  // CP-003: Precio debe ser mayor a $0
  price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    validate: {
      min: {
        args: [0.01],
        msg: 'El precio debe ser mayor a $0.'
      }
    }
  },
  // Tipo de producto: fisico o digital
  product_type: {
    type: DataTypes.ENUM('physical', 'digital'),
    allowNull: false
  },
  // CP-004: Archivo obligatorio para productos digitales
  digital_file_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  // Al menos una imagen obligatoria (validado en servicio)
  images: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  // Modalidades de pago que acepta el vendedor (RF-03)
  accepted_payment_methods: {
    type: DataTypes.ARRAY(DataTypes.ENUM('cash', 'virtual')),
    defaultValue: ['cash', 'virtual']
  },
  status: {
    type: DataTypes.ENUM('active', 'sold', 'paused', 'removed'),
    defaultValue: 'active'
  },
  stock: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: { args: [0], msg: 'El stock no puede ser negativo.' }
    }
  }
}, {
  tableName: 'products',
  timestamps: true,
  underscored: true
});

// ---------------------------------------------------------------------------
// MODELO: Transaction
// Cubre RF-03, RF-06. Registra cada compra y el estado del escrow.
// ---------------------------------------------------------------------------
const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  buyer_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  seller_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  product_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'products', key: 'id' }
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    validate: {
      min: { args: [0.01], msg: 'El monto debe ser mayor a $0.' }
    }
  },
  // RF-03: modalidad de pago elegida por el comprador
  payment_method: {
    type: DataTypes.ENUM('cash', 'virtual'),
    allowNull: false
  },
  // Estados del ciclo de vida de la transaccion
  // pending_payment  -> pago aun no realizado
  // escrow_held      -> dinero retenido en escrow (RF-06)
  // code_validated   -> codigo correcto ingresado
  // completed        -> pago liberado al vendedor (RF-07)
  // disputed         -> reporte de problema abierto (RF-08)
  // refunded         -> reembolso por resolucion admin (RF-10)
  // cancelled        -> transaccion cancelada
  status: {
    type: DataTypes.ENUM(
      'pending_payment',
      'escrow_held',
      'code_validated',
      'completed',
      'disputed',
      'refunded',
      'cancelled'
    ),
    defaultValue: 'pending_payment'
  },
  // Referencia de pago de la pasarela externa
  payment_gateway_ref: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  // Fecha en que el dinero fue liberado al vendedor
  released_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'transactions',
  timestamps: true,
  underscored: true
});

// ---------------------------------------------------------------------------
// MODELO: ReleaseCode
// Cubre RF-05, RF-07, RNF-02.
// Implementa el mecanismo escrow con codigo unico de 8 caracteres.
// ---------------------------------------------------------------------------
const ReleaseCode = sequelize.define('ReleaseCode', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  transaction_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: { model: 'transactions', key: 'id' }
  },
  // Codigo alfanumerico de exactamente 8 caracteres (CP-007, RNF-02)
  // Almacenado como hash para proteccion adicional
  code_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  // RNF-02: el codigo expira en maximo 24 horas
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  // CP-008: maximo 3 intentos fallidos antes de bloqueo
  failed_attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  is_blocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_used: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  // Registro de cuando fue validado exitosamente
  validated_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'release_codes',
  timestamps: true,
  underscored: true
});

// ---------------------------------------------------------------------------
// MODELO: Meeting
// Cubre RF-04. Coordina encuentros fisicos para pagos en efectivo.
// ---------------------------------------------------------------------------
const Meeting = sequelize.define('Meeting', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  transaction_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'transactions', key: 'id' }
  },
  proposed_by: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  // CP-006: la fecha no puede ser anterior a la fecha actual (validado en servicio)
  meeting_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  location_description: {
    type: DataTypes.STRING(500),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'El lugar del encuentro es obligatorio.' }
    }
  },
  status: {
    type: DataTypes.ENUM('proposed', 'confirmed', 'counter_proposed', 'cancelled'),
    defaultValue: 'proposed'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'meetings',
  timestamps: true,
  underscored: true
});

// ---------------------------------------------------------------------------
// MODELO: Rating
// Cubre RF-09. Calificaciones de 1 a 5 estrellas entre usuarios.
// ---------------------------------------------------------------------------
const Rating = sequelize.define('Rating', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  transaction_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'transactions', key: 'id' }
  },
  rater_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  rated_user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  // CP-010: rango valido 1-5. Valores fuera de rango retornan error 400.
  score: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: { args: [1], msg: 'Calificacion fuera del rango permitido (1-5).' },
      max: { args: [5], msg: 'Calificacion fuera del rango permitido (1-5).' }
    }
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Una calificacion por transaccion por usuario (unico e inmutable)
  rated_as: {
    type: DataTypes.ENUM('seller', 'buyer'),
    allowNull: false
  }
}, {
  tableName: 'ratings',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['transaction_id', 'rater_id', 'rated_as'],
      name: 'unique_rating_per_transaction'
    }
  ]
});

// ---------------------------------------------------------------------------
// MODELO: Dispute
// Cubre RF-08, RF-10. Tickets de disputa con intervencion del administrador.
// ---------------------------------------------------------------------------
const Dispute = sequelize.define('Dispute', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  transaction_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'transactions', key: 'id' }
  },
  opened_by: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  // RF-10: solo el administrador puede resolver disputas
  resolved_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' }
  },
  problem_type: {
    type: DataTypes.ENUM(
      'not_received',
      'wrong_product',
      'damaged_product',
      'fraud',
      'other'
    ),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'La descripcion del problema es obligatoria.' },
      len: { args: [20, 2000], msg: 'La descripcion debe tener entre 20 y 2000 caracteres.' }
    }
  },
  evidence_urls: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  // active   -> disputa abierta, pago congelado
  // reviewing -> admin revisando evidencia
  // resolved_buyer  -> resolucion a favor del comprador (reembolso)
  // resolved_seller -> resolucion a favor del vendedor (liberacion)
  status: {
    type: DataTypes.ENUM('active', 'reviewing', 'resolved_buyer', 'resolved_seller'),
    defaultValue: 'active'
  },
  resolution_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  resolved_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'disputes',
  timestamps: true,
  underscored: true
});

// ---------------------------------------------------------------------------
// ASOCIACIONES ENTRE MODELOS
// ---------------------------------------------------------------------------

User.hasMany(Product, { foreignKey: 'seller_id', as: 'products' });
Product.belongsTo(User, { foreignKey: 'seller_id', as: 'seller' });

User.hasMany(Transaction, { foreignKey: 'buyer_id', as: 'purchases' });
User.hasMany(Transaction, { foreignKey: 'seller_id', as: 'sales' });
Transaction.belongsTo(User, { foreignKey: 'buyer_id', as: 'buyer' });
Transaction.belongsTo(User, { foreignKey: 'seller_id', as: 'seller' });
Transaction.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Transaction.hasOne(ReleaseCode, { foreignKey: 'transaction_id', as: 'releaseCode' });
ReleaseCode.belongsTo(Transaction, { foreignKey: 'transaction_id', as: 'transaction' });

Transaction.hasOne(Meeting, { foreignKey: 'transaction_id', as: 'meeting' });
Meeting.belongsTo(Transaction, { foreignKey: 'transaction_id', as: 'transaction' });

Transaction.hasMany(Rating, { foreignKey: 'transaction_id', as: 'ratings' });
Rating.belongsTo(Transaction, { foreignKey: 'transaction_id', as: 'transaction' });
Rating.belongsTo(User, { foreignKey: 'rater_id', as: 'rater' });
Rating.belongsTo(User, { foreignKey: 'rated_user_id', as: 'ratedUser' });

Transaction.hasOne(Dispute, { foreignKey: 'transaction_id', as: 'dispute' });
Dispute.belongsTo(Transaction, { foreignKey: 'transaction_id', as: 'transaction' });
Dispute.belongsTo(User, { foreignKey: 'opened_by', as: 'reporter' });
Dispute.belongsTo(User, { foreignKey: 'resolved_by', as: 'resolver' });

module.exports = { User, Product, Transaction, ReleaseCode, Meeting, Rating, Dispute };
