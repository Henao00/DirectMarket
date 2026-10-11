# DirectMarket - Documentacion Tecnica Completa

## 1. ARQUITECTURA DEL SISTEMA

### Justificacion de decisiones tecnologicas

| Capa         | Tecnologia        | Justificacion |
|--------------|-------------------|---------------|
| Backend      | Node.js + Express | Ecosistema maduro para APIs REST, soporte nativo de async/await para operaciones I/O, alto rendimiento para RNF-03 (500 usuarios concurrentes) |
| Base de datos | PostgreSQL + Sequelize | ACID compliance obligatorio para el escrow financiero (RF-06, RF-07), soporte de arrays nativo para imágenes y metodos de pago, UUID como clave primaria |
| Frontend     | React 18 + Vite   | Componentes reutilizables, estado reactivo, rendimiento con Virtual DOM |
| Estado global | Zustand          | Mas ligero que Redux para el alcance del proyecto, sin boilerplate excesivo |
| Validacion   | Zod + react-hook-form | Validacion tipada tanto en frontend como backend (RNF-06) |
| Autenticacion | JWT + bcrypt     | Sin estado de sesion en servidor (escala horizontalmente), bcrypt para hashing seguro de contrasenas |
| Emails       | Nodemailer        | Notificaciones transaccionales para CP-001, CP-008, CP-009, RF-10 |
| Testing      | Jest + Supertest  | Framework estandar de Node.js, mocks para aislamiento de unidades |

### Diagrama de arquitectura

```
[Cliente Browser]
     |  HTTPS
     v
[React SPA - Vite]
     |  REST API / JSON
     v
[Express.js API] -- Helmet + CORS + Rate Limiting
     |
     +-- [Middleware Auth JWT]
     |
     +-- [Routes /api]
     |         |
     |         +-- authService     (RF-01)
     |         +-- productService  (RF-02)
     |         +-- transactionSvc  (RF-03, RF-04, RF-06)
     |         +-- releaseCodeSvc  (RF-05, RF-07) <-- ESCROW CORE
     |         +-- disputeService  (RF-08, RF-09, RF-10)
     |         +-- emailService    (notificaciones)
     |
     v
[PostgreSQL]
     |
     +-- users
     +-- products
     +-- transactions
     +-- release_codes   <-- TABLA CRITICA del escrow
     +-- meetings
     +-- ratings
     +-- disputes
```

---

## 2. MODELO DE BASE DE DATOS

### Tabla: users
```sql
CREATE TABLE users (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                      VARCHAR(100) NOT NULL,
    email                     VARCHAR(255) NOT NULL UNIQUE,
    password_hash             VARCHAR(255) NOT NULL,  -- bcrypt, nunca texto plano
    role                      ENUM('buyer','seller','admin') DEFAULT 'buyer',
    failed_login_attempts     INTEGER DEFAULT 0,       -- CP-002: bloqueo tras 5 intentos
    locked_until              TIMESTAMP,               -- CP-002: bloqueado 15 minutos
    email_verified            BOOLEAN DEFAULT FALSE,   -- CP-001
    email_verification_token  VARCHAR(255),
    reputation_score          DECIMAL(3,2) DEFAULT 0,  -- RF-09
    total_ratings             INTEGER DEFAULT 0,
    created_at                TIMESTAMP,
    updated_at                TIMESTAMP
);
```

### Tabla: products
```sql
CREATE TABLE products (
    id                        UUID PRIMARY KEY,
    seller_id                 UUID REFERENCES users(id),
    title                     VARCHAR(200) NOT NULL,
    description               TEXT NOT NULL,
    price                     DECIMAL(12,2) NOT NULL CHECK (price > 0),  -- CP-003
    product_type              ENUM('physical','digital') NOT NULL,
    digital_file_url          VARCHAR(500),      -- CP-004: requerido si digital
    images                    TEXT[],            -- al menos una imagen obligatoria
    category                  VARCHAR(100),
    tags                      TEXT[],
    accepted_payment_methods  TEXT[],            -- RF-03
    status                    ENUM('active','sold','paused','removed'),
    stock                     INTEGER DEFAULT 1,
    created_at                TIMESTAMP,
    updated_at                TIMESTAMP
);
```

### Tabla: transactions
```sql
CREATE TABLE transactions (
    id                   UUID PRIMARY KEY,
    buyer_id             UUID REFERENCES users(id),
    seller_id            UUID REFERENCES users(id),
    product_id           UUID REFERENCES products(id),
    amount               DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    payment_method       ENUM('cash','virtual'),       -- RF-03
    status               ENUM(                         -- ciclo de vida del escrow
                           'pending_payment',
                           'escrow_held',              -- RF-06
                           'code_validated',
                           'completed',                -- RF-07
                           'disputed',                 -- RF-08
                           'refunded',
                           'cancelled'
                         ),
    payment_gateway_ref  VARCHAR(255),
    released_at          TIMESTAMP,
    created_at           TIMESTAMP,
    updated_at           TIMESTAMP
);
```

### Tabla: release_codes (TABLA CENTRAL DEL ESCROW)
```sql
CREATE TABLE release_codes (
    id                UUID PRIMARY KEY,
    transaction_id    UUID REFERENCES transactions(id) UNIQUE,
    code_hash         VARCHAR(255) NOT NULL,         -- bcrypt del codigo (nunca texto plano)
    expires_at        TIMESTAMP NOT NULL,            -- RNF-02: max 24 horas
    failed_attempts   INTEGER DEFAULT 0,             -- CP-008: contador de intentos
    is_blocked        BOOLEAN DEFAULT FALSE,         -- CP-008: bloqueado tras 3 intentos
    is_used           BOOLEAN DEFAULT FALSE,         -- RF-07: usado = pago liberado
    validated_at      TIMESTAMP,
    created_at        TIMESTAMP,
    updated_at        TIMESTAMP
);
```

### Tabla: meetings
```sql
CREATE TABLE meetings (
    id                    UUID PRIMARY KEY,
    transaction_id        UUID REFERENCES transactions(id),
    proposed_by           UUID REFERENCES users(id),
    meeting_date          TIMESTAMP NOT NULL,  -- CP-006: no puede ser en el pasado
    location_description  VARCHAR(500) NOT NULL,  -- RF-04: lugar obligatorio
    status                ENUM('proposed','confirmed','counter_proposed','cancelled'),
    notes                 TEXT,
    created_at            TIMESTAMP,
    updated_at            TIMESTAMP
);
```

### Tabla: ratings
```sql
CREATE TABLE ratings (
    id              UUID PRIMARY KEY,
    transaction_id  UUID REFERENCES transactions(id),
    rater_id        UUID REFERENCES users(id),
    rated_user_id   UUID REFERENCES users(id),
    score           INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),  -- CP-010
    comment         TEXT,
    rated_as        ENUM('seller','buyer'),
    created_at      TIMESTAMP,
    updated_at      TIMESTAMP,
    UNIQUE(transaction_id, rater_id, rated_as)  -- una calificacion por transaccion
);
```

### Tabla: disputes
```sql
CREATE TABLE disputes (
    id                UUID PRIMARY KEY,
    transaction_id    UUID REFERENCES transactions(id),
    opened_by         UUID REFERENCES users(id),
    resolved_by       UUID REFERENCES users(id),
    problem_type      ENUM('not_received','wrong_product','damaged_product','fraud','other'),
    description       TEXT NOT NULL,
    evidence_urls     TEXT[],
    status            ENUM('active','reviewing','resolved_buyer','resolved_seller'),
    resolution_notes  TEXT,
    resolved_at       TIMESTAMP,
    created_at        TIMESTAMP,
    updated_at        TIMESTAMP
);
```

---

## 3. FLUJO DEL SISTEMA DE ESCROW (Paso a Paso)

### Flujo de pago virtual con escrow

```
Comprador                    Sistema                         Vendedor
    |                           |                               |
    |-- selecciona producto --->|                               |
    |-- elige "pago virtual" -->|                               |
    |-- confirma compra ------->|                               |
    |                           |-- crea Transaction            |
    |                           |   status: pending_payment     |
    |                           |                               |
    |-- confirma pago ---------->|                               |
    |   (pasarela aprueba)       |                               |
    |                           |-- status: escrow_held         |
    |                           |-- genera codigo 8 chars       |
    |                           |-- almacena como HASH bcrypt   |
    |                           |-- expira en 24h (RNF-02)      |
    |<-- recibe codigo ---------||                               |
    |   (visible SOLO aqui)     |                               |
    |                           |                               |
    |     [encuentro fisico]     |                               |
    |-- entrega codigo al ----->|----------------------->|      |
    |   vendedor de forma        |                       |      |
    |   presencial               |                       |      |
    |                           |              ingresa codigo -->|
    |                           |<-- valida codigo (bcrypt) ----|
    |                           |                               |
    |                           |-- intentos >= 3? -----------> BLOQUEO
    |                           |   notifica admin y comprador  |
    |                           |                               |
    |                           |-- codigo expirado? ---------> RECHAZO
    |                           |   msg: "Solicite uno nuevo"   |
    |                           |                               |
    |                           |-- codigo correcto: ---------->|
    |                           |   status: completed           |
    |                           |   libera pago al vendedor     |
    |<-- notificacion -----------|                               |
    |                           |                               |
```

### Flujo de disputa (RF-08, RF-10)

```
1. Comprador detecta problema con el producto
2. Hace clic en "Reportar problema" (max 2 clics desde la transaccion - checklist item 12)
3. Sistema:
   a. Cambia transaction.status a 'disputed' (pago CONGELADO)
   b. Crea ticket de Dispute con status 'active'
   c. Notifica al administrador por email
4. Administrador revisa evidencias en el panel
5. Administrador emite resolucion:
   - 'resolved_buyer': reembolso al comprador
   - 'resolved_seller': pago liberado al vendedor
6. Sistema notifica a ambas partes (RF-10: irreversible, por correo)
```

---

## 4. TRAZABILIDAD DE REQUISITOS (RTM)

| RF      | Descripcion                     | Servicio Backend               | Ruta API                              | Pagina Frontend          | CP         |
|---------|--------------------------------|-------------------------------|---------------------------------------|--------------------------|------------|
| RF-01   | Registro e inicio de sesion    | authService                   | POST /auth/register, POST /auth/login | AuthPages.jsx             | CP-001, CP-002 |
| RF-02   | Publicar productos             | productService                | POST /products                        | ProductPages.jsx          | CP-003, CP-004 |
| RF-03   | Elegir modalidad de pago       | transactionService            | POST /transactions                    | ProductPages/PaymentPages | CP-005 |
| RF-04   | Pactar encuentro fisico        | transactionService            | POST /transactions/:id/meetings       | PaymentPages.jsx          | CP-006 |
| RF-05   | Generar codigo unico           | releaseCodeService            | POST .../confirm-payment              | PaymentPages.jsx          | CP-007 |
| RF-06   | Retener dinero en escrow       | transactionService            | POST .../confirm-payment              | PaymentPages.jsx          | CP-007 |
| RF-07   | Liberar pago con codigo        | releaseCodeService            | POST /transactions/validate-code      | PaymentPages.jsx          | CP-008 |
| RF-08   | Reportar inconvenientes        | disputeService                | POST /transactions/:id/dispute        | PaymentPages.jsx          | CP-009 |
| RF-09   | Calificar usuarios             | disputeService.createRating   | POST /ratings/:transactionId          | AdminAndRatingPages.jsx   | CP-010 |
| RF-10   | Admin interviene en disputas   | disputeService.resolveDispute | PUT /admin/disputes/:id/resolve       | AdminAndRatingPages.jsx   | CP-009, CP-010 |

---

## 5. CRITERIOS GHERKIN - IMPLEMENTACION

### RF-01 Escenario: Registro con correo ya existente
- **Implementado en**: authService.registerUser()
- **Linea**: `if (existing) throw new Error('Este correo ya esta en uso.')`
- **Status code**: 409 Conflict

### RF-05/06 Escenario: Codigo expira tras 24 horas
- **Implementado en**: releaseCodeService.validateReleaseCode()
- **Linea**: `if (new Date() > releaseCode.expires_at) return { message: 'Codigo expirado...' }`

### RF-07 Escenario: Bloqueo por intentos fallidos
- **Implementado en**: releaseCodeService.validateReleaseCode()
- **Linea**: `if (newAttempts >= MAX_ATTEMPTS) { is_blocked: true, notifyBlockedCode() }`

### RF-09 Escenario: Intento de calificacion fuera de rango
- **Implementado en**: disputeService.createRating() + middleware validation.js
- **Linea**: `if (numericScore < 1 || numericScore > 5) throw 400`

### RF-10 Escenario: Admin resuelve disputa
- **Implementado en**: disputeService.resolveDispute()
- **Linea**: `await dispute.update({ status: resolution, resolved_by: adminId })`

---

## 6. SEGURIDAD IMPLEMENTADA (RNF-06)

| Amenaza               | Mitigacion implementada                                     |
|----------------------|-------------------------------------------------------------|
| Contrasenas en texto plano | bcrypt con saltRounds=12 en produccion               |
| Token robado         | JWT con expiracion + verificacion en cada request           |
| Fuerza bruta login   | Rate limit 20/15min + bloqueo de cuenta (CP-002)            |
| Inyeccion SQL        | Sequelize ORM con prepared statements automaticos           |
| XSS                  | Helmet headers + CSP configurado                            |
| CSRF                 | JWT stateless (no cookies de sesion)                        |
| Codigo filtrado      | Almacenado como hash bcrypt, texto plano solo en generacion |
| Acceso indebido      | Middleware authenticate + requireAdmin en rutas protegidas  |
| Payloads gigantes    | express.json({ limit: '10mb' })                             |
| Flood de requests    | Rate limiting global 100req/min + 20req/15min en auth       |

---

## 7. CASOS DE PRUEBA - RESUMEN DE COBERTURA

| CP     | RF     | Resultado Esperado                          | Implementado en Test     |
|--------|--------|---------------------------------------------|--------------------------|
| CP-001 | RF-01  | Cuenta creada + email de verificacion       | registerUser exitoso     |
| CP-001B| RF-01  | Correo ya en uso -> error 409               | correo duplicado         |
| CP-002 | RF-01  | Credenciales incorrectas -> 401             | login fallido            |
| CP-002B| RF-01  | 5 intentos fallidos -> bloqueo 15 min       | bloqueo de cuenta        |
| CP-003 | RF-02  | Precio = 0 -> error 400                     | precio cero y negativo   |
| CP-004 | RF-02  | Digital sin archivo -> error 400            | digital sin url          |
| CP-005 | RF-03  | Flujo virtual habilitado                    | pago virtual             |
| CP-006 | RF-04  | Fecha pasada -> error                       | fecha en pasado/presente |
| CP-007 | RF-05/6| Codigo 8 chars, expira 24h, unico           | generacion de codigo     |
| CP-007B| RF-05  | Solo comprador ve el codigo                 | acceso por vendedor -> 403 |
| CP-008 | RF-07  | 3er intento incorrecto -> bloqueo           | intentos fallidos 1/2/3  |
| CP-008B| RF-07  | Codigo bloqueado no acepta intentos         | codigo ya bloqueado      |
| CP-008C| RNF-02 | Codigo expirado -> mensaje especifico       | expiracion de codigo     |
| CP-009 | RF-08  | Disputa abre ticket + congela pago          | openDispute              |
| CP-009B| RF-08  | Solo comprador puede abrir disputa          | vendedor intenta -> 403  |
| CP-010 | RF-09  | Score=0 o 6 -> error 400                    | fuera de rango           |
| CP-010B| RF-09  | Score=1 y 5 aceptados                       | minimo y maximo validos  |
| CP-010C| RF-09  | Calificacion duplicada -> error 409         | intento duplicado        |
| Extra  | RF-07  | Codigo correcto libera pago (Gherkin)       | validacion exitosa       |
| Extra  | RF-07  | Codigo ya usado no puede reutilizarse       | reutilizacion bloqueada  |

---

## 8. INSTRUCCIONES DE INSTALACION

### Requisitos previos
- Node.js >= 18.0.0
- PostgreSQL >= 14
- npm >= 9

### Backend

```bash
# 1. Instalar dependencias
cd directmarket/backend
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores reales

# 3. Crear la base de datos en PostgreSQL
createdb directmarket_db
createuser directmarket_user --password

# 4. Ejecutar en desarrollo (sincroniza tablas automaticamente)
npm run dev

# 5. Ejecutar tests
npm test

# 6. Con cobertura
npm run test:coverage
```

### Frontend

```bash
cd directmarket/frontend
npm install
cp .env.example .env  # VITE_API_URL=http://localhost:4000/api
npm run dev
```

### Variables de entorno del frontend

```
VITE_API_URL=http://localhost:4000/api
```

---

## 9. MEJORAS UX/UI IMPLEMENTADAS (Sobre los mockups)

### Mejoras aplicadas vs mockups originales

| Aspecto              | Mockup original         | Mejora implementada                                  |
|----------------------|------------------------|------------------------------------------------------|
| Tipografia           | Sin especificacion     | Inter variable, 14px+ garantizado (checklist item 4) |
| Contraste            | No especificado        | Sistema de colores brand/neutral con ratio >= 4.5:1 (item 6) |
| Area de clic         | No especificada        | Todos los botones min 44x44px (item 5, WCAG 2.1)     |
| Codigo de liberacion | Texto plano en pantalla | Fuente monoespaciada, fondo diferenciado, boton copiar, countdown |
| Estados de carga     | No en mockup           | Skeletons, spinners, estados vacios con calls-to-action |
| Retroalimentacion    | Basica                 | Alerts contextuales por tipo (success/warning/danger/info) |
| Intentos del codigo  | No en mockup           | Contador visible de intentos restantes (CP-008)       |
| Responsive           | Solo desktop           | Grid adaptativo, menu hamburguesa para movil          |
| Accesibilidad        | Sin mencionar          | aria-labels, roles ARIA, focus rings visibles         |
| Cierre de sesion     | En algun lugar         | Visible en navbar en todo momento (checklist item 10) |
| Indicador HTTPS      | Mencionado en checklist | SecureBadge en paginas de pago (checklist item 11)    |
| Reporte de problema  | Form separado          | Accesible en 2 clics desde la transaccion (item 12)  |

---

## 10. ESTRUCTURA DE ARCHIVOS

```
directmarket/
├── backend/
│   ├── src/
│   │   ├── index.js                    # Entrada del servidor Express
│   │   ├── config/
│   │   │   └── database.js             # Configuracion PostgreSQL/Sequelize
│   │   ├── models/
│   │   │   └── index.js                # Todos los modelos y asociaciones
│   │   ├── routes/
│   │   │   └── index.js                # Todos los endpoints RF-01 a RF-10
│   │   ├── middleware/
│   │   │   ├── auth.js                 # JWT authenticate, requireAdmin
│   │   │   └── validation.js           # express-validator para todos los endpoints
│   │   ├── services/
│   │   │   ├── authService.js          # RF-01, CP-001, CP-002
│   │   │   ├── productService.js       # RF-02, CP-003, CP-004
│   │   │   ├── transactionService.js   # RF-03, RF-04, RF-06
│   │   │   ├── releaseCodeService.js   # RF-05, RF-07, CP-007, CP-008 (CORE ESCROW)
│   │   │   ├── disputeService.js       # RF-08, RF-09, RF-10, CP-009, CP-010
│   │   │   └── emailService.js         # Notificaciones para todos los eventos
│   │   ├── utils/
│   │   │   └── logger.js               # Winston logging
│   │   └── tests/
│   │       └── directmarket.test.js    # CP-001 a CP-010 completos
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.jsx                     # Enrutamiento + guardas de auth
    │   ├── store/
    │   │   └── authStore.js            # Estado global Zustand
    │   ├── services/
    │   │   └── api.js                  # Capa API completa con axios
    │   ├── components/
    │   │   └── common/
    │   │       ├── index.jsx           # Button, Input, Alert, Modal, StarRating, etc.
    │   │       └── Navbar.jsx          # Navegacion con cierre de sesion (item 10)
    │   ├── pages/
    │   │   ├── AuthPages.jsx           # frm_registro, frm_login (RF-01)
    │   │   ├── ProductPages.jsx        # frm_publicar_producto (RF-02)
    │   │   ├── PaymentPages.jsx        # frm_checkout, frm_codigo_liberacion,
    │   │   │                           # frm_ingresar_codigo, frm_pactar_encuentro
    │   │   └── AdminAndRatingPages.jsx # frm_panel_admin, frm_calificar_usuario
    │   └── styles/
    │       └── globals.css             # Design tokens y clases de utilidad
    ├── tailwind.config.js
    └── package.json
```
