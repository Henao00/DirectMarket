# DirectMarket - Dockerfile del Backend
#
# Build multi-stage para minimizar la imagen final en produccion.
# RNF-04: imagen ligera y rapida de arrancar para alta disponibilidad.

# ---------------------------------------------------------------------------
# Etapa 1: Dependencias
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Copiar solo los manifiestos de dependencias primero para cache efectivo
COPY package.json package-lock.json* ./

# Instalar solo dependencias de produccion
RUN npm ci --only=production --ignore-scripts

# ---------------------------------------------------------------------------
# Etapa 2: Imagen final de produccion
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner

# Etiquetas de metadatos
LABEL org.opencontainers.image.title="DirectMarket Backend"
LABEL org.opencontainers.image.description="API REST del sistema de escrow DirectMarket"

# Usuario no-root para seguridad (RNF-06)
RUN addgroup --system --gid 1001 directmarket \
 && adduser  --system --uid 1001 --ingroup directmarket directmarket

WORKDIR /app

# Copiar node_modules de la etapa de dependencias
COPY --from=deps /app/node_modules ./node_modules

# Copiar el codigo fuente
COPY src ./src
COPY package.json ./

# Crear directorio de logs con permisos correctos
RUN mkdir -p logs && chown -R directmarket:directmarket /app

# Cambiar al usuario no-root
USER directmarket

EXPOSE 4000

# Healthcheck para orquestadores (RNF-04)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "src/index.js"]
