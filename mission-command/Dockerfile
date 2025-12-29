# Multi-stage Dockerfile for Mission Command Centre

# Stage 1: Build Dependencies
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.7.0

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY packages/mission-command/package.json ./packages/mission-command/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Build Mission Command Package
FROM node:18-alpine AS build
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.7.0

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/mission-command/node_modules ./packages/mission-command/node_modules

# Copy source files
COPY packages/mission-command ./packages/mission-command
COPY package.json pnpm-lock.yaml ./
COPY tsconfig.json ./
COPY packages/core ./packages/core
COPY packages/server ./packages/server

# Build the package
RUN pnpm build --filter=@mission-command

# Stage 3: Build UI
FROM node:18-alpine AS ui-build
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.7.0

# Copy UI dependencies
COPY packages/mission-command/ui/package.json ./packages/mission-command/ui/
RUN cd packages/mission-command/ui && pnpm install

# Copy UI source and build
COPY packages/mission-command/ui ./packages/mission-command/ui
RUN cd packages/mission-command/ui && pnpm build

# Stage 4: Production Runtime
FROM node:18-alpine AS runtime
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    openssl \
    curl \
    && npm install -g pnpm@9.7.0

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built files from build stages
COPY --from=build --chown=nodejs:nodejs /app/packages/mission-command/dist ./packages/mission-command/dist
COPY --from=build --chown=nodejs:nodejs /app/packages/mission-command/package.json ./packages/mission-command/
COPY --from=ui-build --chown=nodejs:nodejs /app/packages/mission-command/ui/dist ./ui

# Copy node_modules for production
COPY --from=build --chown=nodejs:nodejs /app/packages/mission-command/node_modules ./packages/mission-command/node_modules

# Set environment
ENV NODE_ENV=production
ENV PORT=4111
ENV UI_PORT=3000

# Switch to non-root user
USER nodejs

# Expose ports
EXPOSE 4111 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:4111/webhooks/github/health || exit 1

# Run the application
CMD ["node", "packages/mission-command/dist/server/index.js"]
