# DirectMarket - Dockerfile del Frontend (Produccion)
#
# Build multi-stage: construye con Node y sirve con nginx ligero.

# ---------------------------------------------------------------------------
# Etapa 1: Build
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Build de produccion optimizado
RUN npm run build

# ---------------------------------------------------------------------------
# Etapa 2: Servidor nginx
# ---------------------------------------------------------------------------
FROM nginx:1.25-alpine AS runner

LABEL org.opencontainers.image.title="DirectMarket Frontend"

# Configuracion de nginx para SPA (React Router)
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen       80;
    server_name  _;
    root         /usr/share/nginx/html;
    index        index.html;

    # Todas las rutas sirven index.html para React Router
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache de assets estaticos
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Seguridad: headers adicionales
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
}
EOF

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
