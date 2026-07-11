# syntax=docker/dockerfile:1

# --- Stage 1: install all deps + build TypeScript -> dist ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# --- Stage 2: production dependencies only ---
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- Stage 3: minimal runtime image ---
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Run as the built-in unprivileged "node" user.
COPY --chown=node:node package.json ./
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist

USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
