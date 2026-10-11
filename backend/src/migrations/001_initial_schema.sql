-- =============================================================================
-- DirectMarket - Migracion SQL Completa
-- Schema de base de datos para PostgreSQL >= 14
--
-- Trazabilidad:
--   users          : RF-01, CP-001, CP-002
--   products       : RF-02, CP-003, CP-004
--   transactions   : RF-03, RF-06
--   release_codes  : RF-05, RF-07, RNF-02, CP-007, CP-008
--   meetings       : RF-04, CP-006
--   ratings        : RF-09, CP-010
--   disputes       : RF-08, RF-10, CP-009
-- =============================================================================

-- Habilitar la extension para UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TABLA: users
-- RF-01: registro e inicio de sesion
-- CP-001: email unico, contrasena hasheada
-- CP-002: campos de bloqueo por intentos fallidos
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    name                      VARCHAR(100)  NOT NULL,
    email                     VARCHAR(255)  NOT NULL,
    password_hash             VARCHAR(255)  NOT NULL,
    role                      VARCHAR(20)   NOT NULL DEFAULT 'buyer'
                              CHECK (role IN ('buyer', 'seller', 'admin')),
    -- CP-002: bloqueo de cuenta por intentos fallidos de login
    failed_login_attempts     INTEGER       NOT NULL DEFAULT 0,
    locked_until              TIMESTAMPTZ,
    -- CP-001: verificacion de correo electronico
    email_verified            BOOLEAN       NOT NULL DEFAULT FALSE,
    email_verification_token  VARCHAR(255),
    -- RF-09: reputacion acumulada
    reputation_score          DECIMAL(3,2)  NOT NULL DEFAULT 0.00,
    total_ratings             INTEGER       NOT NULL DEFAULT 0,
    created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);

-- =============================================================================
-- TABLA: products
-- RF-02: publicar productos fisicos o digitales
-- CP-003: precio > 0
-- CP-004: digital_file_url para productos digitales
-- =============================================================================
CREATE TABLE IF NOT EXISTS products (
    id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id                UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title                    VARCHAR(200)  NOT NULL,
    description              TEXT          NOT NULL,
    -- CP-003: precio estrictamente mayor a cero
    price                    DECIMAL(12,2) NOT NULL CHECK (price > 0),
    product_type             VARCHAR(20)   NOT NULL
                             CHECK (product_type IN ('physical', 'digital')),
    -- CP-004: obligatorio cuando product_type = 'digital' (validado en servicio)
    digital_file_url         VARCHAR(500),
    -- Al menos una imagen obligatoria (validado en servicio)
    images                   TEXT[]        NOT NULL DEFAULT '{}',
    category                 VARCHAR(100),
    tags                     TEXT[]        NOT NULL DEFAULT '{}',
    -- RF-03: modalidades de pago aceptadas por el vendedor
    accepted_payment_methods TEXT[]        NOT NULL DEFAULT '{"cash","virtual"}',
    status                   VARCHAR(20)   NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'sold', 'paused', 'removed')),
    stock                    INTEGER       NOT NULL DEFAULT 1 CHECK (stock >= 0),
    created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_seller_id    ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_status       ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);
-- Indice de texto completo para busqueda
CREATE INDEX IF NOT EXISTS idx_products_search ON products USING gin(to_tsvector('spanish', title || ' ' || description));

-- =============================================================================
-- TABLA: transactions
-- RF-03: modalidad de pago elegida por el comprador
-- RF-06: estado del escrow
-- =============================================================================
CREATE TABLE IF NOT EXISTS transactions (
    id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id              UUID          NOT NULL REFERENCES users(id),
    seller_id             UUID          NOT NULL REFERENCES users(id),
    product_id            UUID          NOT NULL REFERENCES products(id),
    amount                DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    -- RF-03: modalidad de pago
    payment_method        VARCHAR(20)   NOT NULL CHECK (payment_method IN ('cash', 'virtual')),
    -- Ciclo de vida del escrow:
    --   pending_payment  -> antes de confirmar el pago
    --   escrow_held      -> dinero retenido (RF-06)
    --   code_validated   -> codigo ingresado correctamente
    --   completed        -> pago liberado al vendedor (RF-07)
    --   disputed         -> disputa abierta, pago congelado (RF-08)
    --   refunded         -> reembolso por resolucion admin (RF-10)
    --   cancelled        -> cancelada
    status                VARCHAR(30)   NOT NULL DEFAULT 'pending_payment'
                          CHECK (status IN (
                            'pending_payment', 'escrow_held', 'code_validated',
                            'completed', 'disputed', 'refunded', 'cancelled'
                          )),
    payment_gateway_ref   VARCHAR(255),
    released_at           TIMESTAMPTZ,
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_buyer_id  ON transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_seller_id ON transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status    ON transactions(status);

-- =============================================================================
-- TABLA: release_codes
-- TABLA CENTRAL DEL SISTEMA ESCROW
--
-- RF-05: codigo unico de liberacion para pagos virtuales
-- RF-07: liberar el pago solo al validar el codigo correcto
-- RNF-02: codigo unico, expira en maximo 24 horas
-- CP-007: codigo alfanumerico de 8 caracteres (almacenado como hash)
-- CP-008: maximo 3 intentos antes de bloqueo
-- =============================================================================
CREATE TABLE IF NOT EXISTS release_codes (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Una transaccion tiene exactamente un codigo activo
    transaction_id  UUID        NOT NULL REFERENCES transactions(id) UNIQUE,
    -- El codigo se almacena como hash bcrypt, NUNCA en texto plano (RNF-01)
    -- El texto plano solo existe en memoria durante la generacion
    code_hash       VARCHAR(255) NOT NULL,
    -- RNF-02: el codigo expira en maximo 24 horas desde su creacion
    expires_at      TIMESTAMPTZ NOT NULL,
    -- CP-008: contador de intentos fallidos
    failed_attempts INTEGER     NOT NULL DEFAULT 0,
    -- CP-008: bloqueado despues de MAX_ATTEMPTS intentos fallidos
    is_blocked      BOOLEAN     NOT NULL DEFAULT FALSE,
    -- RF-07: marcado como usado cuando el pago es liberado exitosamente
    is_used         BOOLEAN     NOT NULL DEFAULT FALSE,
    validated_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_release_codes_transaction_id ON release_codes(transaction_id);

-- =============================================================================
-- TABLA: meetings
-- RF-04: coordinar encuentros fisicos para pagos en efectivo
-- CP-006: la fecha no puede ser anterior a la fecha actual
-- =============================================================================
CREATE TABLE IF NOT EXISTS meetings (
    id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id        UUID         NOT NULL REFERENCES transactions(id),
    proposed_by           UUID         NOT NULL REFERENCES users(id),
    -- CP-006: validado en el servicio (no puede ser en el pasado)
    meeting_date          TIMESTAMPTZ  NOT NULL,
    -- RF-04: lugar de encuentro obligatorio
    location_description  VARCHAR(500) NOT NULL,
    status                VARCHAR(20)  NOT NULL DEFAULT 'proposed'
                          CHECK (status IN ('proposed', 'confirmed', 'counter_proposed', 'cancelled')),
    notes                 TEXT,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_transaction_id ON meetings(transaction_id);

-- =============================================================================
-- TABLA: ratings
-- RF-09: calificaciones entre usuarios despues de transacciones completadas
-- CP-010: rango valido 1-5
-- =============================================================================
CREATE TABLE IF NOT EXISTS ratings (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id  UUID        NOT NULL REFERENCES transactions(id),
    rater_id        UUID        NOT NULL REFERENCES users(id),
    rated_user_id   UUID        NOT NULL REFERENCES users(id),
    -- CP-010: rango valido 1 a 5 estrellas (fuera de rango retorna error 400)
    score           INTEGER     NOT NULL CHECK (score >= 1 AND score <= 5),
    comment         TEXT,
    rated_as        VARCHAR(10) NOT NULL CHECK (rated_as IN ('seller', 'buyer')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Una sola calificacion por transaccion por rol (publica e inmutable)
    CONSTRAINT unique_rating_per_transaction UNIQUE (transaction_id, rater_id, rated_as)
);

CREATE INDEX IF NOT EXISTS idx_ratings_rated_user_id ON ratings(rated_user_id);

-- =============================================================================
-- TABLA: disputes
-- RF-08: reportar inconvenientes en la entrega
-- RF-10: administrador interviene en disputas
-- CP-009: abre ticket y congela el pago
-- =============================================================================
CREATE TABLE IF NOT EXISTS disputes (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id   UUID        NOT NULL REFERENCES transactions(id),
    opened_by        UUID        NOT NULL REFERENCES users(id),
    -- RF-10: solo el administrador puede resolver disputas
    resolved_by      UUID        REFERENCES users(id),
    problem_type     VARCHAR(30) NOT NULL
                     CHECK (problem_type IN (
                       'not_received', 'wrong_product', 'damaged_product', 'fraud', 'other'
                     )),
    description      TEXT        NOT NULL,
    evidence_urls    TEXT[]      NOT NULL DEFAULT '{}',
    -- Estados del ticket de disputa
    status           VARCHAR(25) NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'reviewing', 'resolved_buyer', 'resolved_seller')),
    -- RF-10: notas del administrador al resolver (obligatorias)
    resolution_notes TEXT,
    resolved_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disputes_transaction_id ON disputes(transaction_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status         ON disputes(status);

-- =============================================================================
-- FUNCION: actualizar updated_at automaticamente
-- Evita olvidar el campo updated_at en cada UPDATE
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar el trigger a todas las tablas
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['users','products','transactions','release_codes','meetings','ratings','disputes']
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated_at
             BEFORE UPDATE ON %s
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
            t, t
        );
    END LOOP;
END;
$$;

-- =============================================================================
-- SEED: usuario administrador inicial
-- Contrasena: Admin1234! (bcrypt hash - cambiar en produccion)
-- =============================================================================
INSERT INTO users (name, email, password_hash, role, email_verified)
VALUES (
    'Administrador DirectMarket',
    'admin@directmarket.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCLWA7dVAjblPlA.PtL3vZS',
    'admin',
    TRUE
)
ON CONFLICT (email) DO NOTHING;

-- =============================================================================
-- COMENTARIOS DE DOCUMENTACION EN LA BD
-- =============================================================================
COMMENT ON TABLE release_codes IS
'Tabla central del sistema escrow. El code_hash almacena el codigo mediante bcrypt. El codigo en texto plano solo existe en memoria durante la generacion y se entrega al comprador una unica vez. RF-05, RF-07, RNF-02, CP-007, CP-008.';

COMMENT ON COLUMN release_codes.code_hash IS
'Hash bcrypt del codigo de 8 caracteres alfanumericos. Nunca almacenar el texto plano aqui.';

COMMENT ON COLUMN release_codes.expires_at IS
'Fecha de expiracion del codigo. RNF-02: maximo 24 horas desde la generacion.';

COMMENT ON COLUMN release_codes.failed_attempts IS
'Contador de intentos de validacion fallidos. CP-008: al llegar a MAX_ATTEMPTS (3) se bloquea.';

COMMENT ON COLUMN users.failed_login_attempts IS
'CP-002: contador de intentos fallidos de login. Al llegar a 5 se bloquea la cuenta 15 minutos.';

COMMENT ON COLUMN transactions.status IS
'Ciclo de vida del escrow: pending_payment -> escrow_held -> completed. Ver RF-06, RF-07.';
