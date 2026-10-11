# DirectMarket

Plataforma web de compra y venta entre usuarios sin intermediarios comerciales.
El diferenciador principal es un sistema de pago hibrido con mecanismo escrow
mediante un codigo unico de liberacion de 8 caracteres.

---

## Inicio rapido

### Opcion A: Docker (recomendado)

```bash
# Clonar y entrar al proyecto
git clone <repositorio>
cd directmarket

# Levantar todos los servicios (PostgreSQL, backend, frontend, MailHog)
docker-compose up -d

# Verificar que todo este corriendo
docker-compose ps
```

Servicios disponibles:

| Servicio      | URL                          | Descripcion                  |
|---------------|------------------------------|------------------------------|
| Frontend      | http://localhost:3000        | Aplicacion React             |
| Backend API   | http://localhost:4000        | API Express                  |
| API Health    | http://localhost:4000/health | Estado del servidor          |
| MailHog       | http://localhost:8025        | Captura de emails en dev     |
| PostgreSQL    | localhost:5432               | Base de datos                |

### Opcion B: Manual

**Requisitos previos:**
- Node.js >= 18
- PostgreSQL >= 14
- npm >= 9

**Backend:**

```bash
cd backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# Crear la base de datos
createdb directmarket_db
psql directmarket_db < src/migrations/001_initial_schema.sql

# Iniciar en desarrollo
npm run dev
# Servidor en http://localhost:4000
```

**Frontend:**

```bash
cd frontend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# VITE_API_URL=http://localhost:4000/api

# Iniciar en desarrollo
npm run dev
# Aplicacion en http://localhost:3000
```

---

## Credenciales de administrador (seed)

Al ejecutar la migracion SQL se crea el usuario admin:

```
Email:     admin@directmarket.com
Password:  Admin1234!
```

**Cambiar esta contrasena inmediatamente en produccion.**

---

## Ejecutar tests

```bash
cd backend

# Tests unitarios (CP-001 a CP-010 + integracion)
npm test

# Con reporte de cobertura
npm run test:coverage

# Solo los tests unitarios de servicios
npx jest src/tests/directmarket.test.js --verbose

# Solo los tests de integracion de rutas
npx jest src/tests/integration.test.js --verbose
```

---

## Arquitectura del sistema

```
Cliente (React)
    |  HTTPS
    v
Express.js API  ── Helmet ── CORS ── Rate Limiting
    |
    ├─ /api/auth          RF-01  authService
    ├─ /api/products      RF-02  productService
    ├─ /api/transactions  RF-03..07  transactionService + releaseCodeService
    ├─ /api/ratings       RF-09  disputeService
    └─ /api/admin         RF-10  disputeService
    |
    v
PostgreSQL
    ├─ users
    ├─ products
    ├─ transactions
    ├─ release_codes  <-- NUCLEO DEL ESCROW
    ├─ meetings
    ├─ ratings
    └─ disputes
```

---

## Flujo del sistema escrow

```
1. Comprador selecciona producto y elige "pago virtual"
2. Comprador confirma el pago -> dinero entra a escrow
3. Sistema genera codigo alfanumerico de 8 caracteres (solo en memoria)
4. Codigo se almacena como hash bcrypt (nunca en texto plano en BD)
5. Codigo se muestra UNA SOLA VEZ al comprador autenticado
6. Comprador entrega el codigo al vendedor de forma presencial
7. Vendedor ingresa el codigo en el sistema
8. Sistema valida con bcrypt.compare():
   - Correcto -> pago liberado, transaccion completada
   - Incorrecto -> registra intento (max 3 antes de bloqueo)
   - Expirado  -> rechaza con mensaje especifico
   - Bloqueado -> notifica al comprador y al administrador
```

---

## Trazabilidad de requisitos

| RF    | Descripcion                    | Endpoint                            | Test      |
|-------|-------------------------------|-------------------------------------|-----------|
| RF-01 | Registro e inicio de sesion   | POST /auth/register, /auth/login    | CP-001/002 |
| RF-02 | Publicar productos            | POST /products                      | CP-003/004 |
| RF-03 | Seleccionar modalidad de pago | POST /transactions                  | CP-005    |
| RF-04 | Pactar encuentro fisico       | POST /transactions/:id/meetings     | CP-006    |
| RF-05 | Generar codigo de liberacion  | POST /transactions/:id/confirm-payment | CP-007 |
| RF-06 | Retener dinero en escrow      | POST /transactions/:id/confirm-payment | CP-007 |
| RF-07 | Liberar pago con codigo       | POST /transactions/validate-code    | CP-008    |
| RF-08 | Reportar inconvenientes       | POST /transactions/:id/dispute      | CP-009    |
| RF-09 | Calificar usuarios            | POST /ratings/:transactionId        | CP-010    |
| RF-10 | Admin resuelve disputas       | PUT /admin/disputes/:id/resolve     | CP-009/010 |

---

## Variables de entorno del backend

| Variable                    | Default  | Descripcion                            |
|-----------------------------|----------|----------------------------------------|
| PORT                        | 4000     | Puerto del servidor                    |
| DB_HOST                     | localhost | Host de PostgreSQL                    |
| DB_NAME                     | directmarket_db | Nombre de la BD              |
| JWT_SECRET                  | (requerido) | Secreto para firmar tokens JWT     |
| RELEASE_CODE_EXPIRY_HOURS   | 24       | RNF-02: horas de vida del codigo       |
| RELEASE_CODE_MAX_ATTEMPTS   | 3        | CP-008: intentos antes de bloqueo      |
| LOGIN_MAX_ATTEMPTS          | 5        | CP-002: intentos antes de bloquear cuenta |
| LOGIN_BLOCK_MINUTES         | 15       | CP-002: minutos de bloqueo de cuenta   |

---

## Estructura del proyecto

```
directmarket/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── jest.config.js
│   ├── .env.example
│   └── src/
│       ├── index.js                    Servidor Express
│       ├── config/database.js          Conexion PostgreSQL
│       ├── migrations/
│       │   └── 001_initial_schema.sql  Esquema completo de BD
│       ├── models/index.js             Modelos Sequelize
│       ├── routes/index.js             Endpoints RF-01 a RF-10
│       ├── middleware/
│       │   ├── auth.js                 JWT, requireAdmin
│       │   └── validation.js           express-validator
│       ├── services/
│       │   ├── authService.js          RF-01
│       │   ├── productService.js       RF-02
│       │   ├── transactionService.js   RF-03, RF-04, RF-06
│       │   ├── releaseCodeService.js   RF-05, RF-07 (ESCROW CORE)
│       │   ├── disputeService.js       RF-08, RF-09, RF-10
│       │   └── emailService.js         Notificaciones
│       ├── utils/logger.js             Winston
│       └── tests/
│           ├── setup.js                Variables de entorno de test
│           ├── directmarket.test.js    CP-001 a CP-010 (unitarios)
│           └── integration.test.js     Tests de rutas (integracion)
└── frontend/
    ├── Dockerfile
    ├── Dockerfile.dev
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    ├── .env.example
    └── src/
        ├── main.jsx                    Montaje React
        ├── App.jsx                     Enrutamiento + guardas
        ├── store/authStore.js          Estado global Zustand
        ├── services/api.js             Capa HTTP axios
        ├── styles/globals.css          Design tokens Tailwind
        ├── components/common/
        │   ├── index.jsx               Button, Input, Modal, StarRating...
        │   └── Navbar.jsx              Navegacion principal
        └── pages/
            ├── AuthPages.jsx           frm_registro, frm_login
            ├── ProductPages.jsx        frm_publicar, listado, detalle
            ├── PaymentPages.jsx        frm_checkout, frm_codigo, frm_encuentro
            └── AdminAndRatingPages.jsx frm_panel_admin, frm_calificar
```

---

## Seguridad implementada

- Contrasenas: bcrypt con saltRounds=12 en produccion
- Tokens: JWT con expiracion configurable
- Rate limiting: 20 req/15min en auth, 100 req/min general
- Bloqueo de cuenta: tras 5 intentos fallidos de login (CP-002)
- Escrow: codigo almacenado como hash bcrypt, texto plano solo en RAM
- Headers: Helmet (XSS, HSTS, CSP, clickjacking)
- CORS: solo origen del frontend configurado
- Validacion doble: middleware backend + Zod frontend
- Roles: middleware requireAdmin en todas las rutas de administracion
- SQL injection: Sequelize ORM con prepared statements automaticos

---

## Licencia

Proyecto educativo - DirectMarket.
