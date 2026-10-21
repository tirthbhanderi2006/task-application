# syntax=docker/dockerfile:1
#
# Frontend service — React 19 + Vite SPA served by nginx
#
# Build from the repository root:
#   docker build -f frontend/Dockerfile .

# ---------------------------------------------------------------------------
# Stage 1: build the production bundle with Vite
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src

# VITE_API_URL "/" => same-origin relative API calls ("/api/...").
# nginx reverse-proxies /api/* to the backend container, so the browser never
# needs to know the internal container hostname.
ARG VITE_API_URL=/
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: serve the static bundle with nginx
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
