# Stage 1: Build TypeScript application
FROM node:22-alpine AS builder

WORKDIR /app

# Cache dependencies
COPY package*.json ./
RUN npm ci

# Copy sources and compile
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2: Minimal runtime image
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript and SQL migration files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/db/migrations ./dist/db/migrations
COPY --from=builder /app/src/db/migrations ./src/db/migrations

# Switch to standard non-root user
USER node

EXPOSE 5000

# Healthcheck targets /metrics rather than /api/health because /api/health returns 503
# during intentional failure simulation tests (/api/test/stop). /metrics always answers
# with 200 as long as the Node process is alive and responsive.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5000/metrics').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/docker-entrypoint.js"]
