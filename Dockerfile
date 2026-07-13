# syntax=docker/dockerfile:1

# --- Stage 1: install all deps + build server (dist) and dashboard (web/dist) ---
FROM node:22-alpine AS build
WORKDIR /app
# Copy both workspace manifests so `npm ci` resolves the whole workspace graph.
COPY package.json package-lock.json ./
COPY web/package.json ./web/package.json
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY web ./web
# Builds the server (tsc → dist) and the React SPA (vite → web/dist).
RUN npm run build

# --- Stage 2: production dependencies only (server runtime) ---
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json ./web/package.json
# Production deps for the server runtime (the web workspace's output is already
# bundled into web/dist, so its packages go unused at runtime — harmless).
RUN npm ci --omit=dev

# --- Stage 3: minimal runtime image ---
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Run as the built-in unprivileged "node" user.
COPY --chown=node:node package.json ./
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
# The built dashboard SPA — served by Express at the root (masterdoc §8).
COPY --chown=node:node --from=build /app/web/dist ./web/dist

USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
