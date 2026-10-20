# alert-receiver/Dockerfile
# Pinned Node.js 22 Alpine image, running as unprivileged 'node' user
FROM node:22-alpine

WORKDIR /app

# Switch to the non-root 'node' user provided by the official image
USER node

# Copy server implementation (no external npm dependencies required)
COPY --chown=node:node server.js ./

EXPOSE 8080

CMD ["node", "server.js"]
