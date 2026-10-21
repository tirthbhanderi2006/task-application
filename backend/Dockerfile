# syntax=docker/dockerfile:1
#
# Backend service — Express 5 REST API (Task Management API)
#
# Build from the repository root so the shared root package.json /
# package-lock.json (which declares the runtime dependencies) are available:
#   docker build -f backend/Dockerfile .

# ---------------------------------------------------------------------------
# Stage 1: install production dependencies only (no devDependencies)
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

# Only the manifests are copied so this layer is cached until deps actually change
COPY package.json package-lock.json ./

RUN npm ci --omit=dev && npm cache clean --force

# ---------------------------------------------------------------------------
# Stage 2: runtime
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    PORT=5000

WORKDIR /app

# Production node_modules from stage 1
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./

# Backend source code
COPY --chown=node:node backend ./backend

# The app writes CSV request logs and EDA CSV exports to backend/logs/
RUN mkdir -p /app/backend/logs/exports && chown -R node:node /app/backend/logs

USER node

EXPOSE 5000

# Uses the Node 22 built-in fetch so no extra packages (curl/wget) are needed
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:5000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "backend/app.js"]
