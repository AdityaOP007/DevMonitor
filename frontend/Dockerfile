# Stage 1: Build React Vite SPA
FROM node:22-alpine AS builder

WORKDIR /app

# Vite bakes environment variables into static JS/HTML assets at build time.
# Modifying VITE_USE_MOCK requires an image rebuild (docker compose build).
ARG VITE_USE_MOCK=false
ENV VITE_USE_MOCK=$VITE_USE_MOCK

COPY package*.json ./
RUN npm ci

COPY . ./
RUN npm run build

# Stage 2: Serve production bundle with Nginx
FROM nginx:1.27-alpine

# Copy built distribution files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Healthcheck testing frontend reachability
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
