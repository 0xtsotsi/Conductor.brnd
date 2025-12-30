# Multi-stage Dockerfile for Mission Command Centre
# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm i --frozen-lockfile

# Stage 2: Build Mission Command package
FROM node:20-alpine AS build-mission-command
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the mission-command package
RUN corepack enable pnpm && pnpm build

# Stage 3: Build UI
FROM node:20-alpine AS build-ui
WORKDIR /app/ui
COPY --from=build-mission-command /app/node_modules ./node_modules
COPY ui/package.json ui/pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm i --frozen-lockfile

COPY ui/ ./
RUN pnpm build

# Stage 4: Production runtime
FROM node:20-alpine AS runner
WORKDIR /app

# Install production dependencies only
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S missioncmd -u 1001

# Copy built mission-command package
COPY --from=build-mission-command --chown=missioncmd:nodejs /app/dist ./dist
COPY --from=build-mission-command --chown=missioncmd:nodejs /app/node_modules ./node_modules
COPY --from=build-mission-command --chown=missioncmd:nodejs /app/package.json ./

# Copy built UI
COPY --from=build-ui --chown=missioncmd:nodejs /app/ui/dist ./ui/dist

# Set environment
ENV NODE_ENV=production
ENV PORT=4111
ENV HOSTNAME="0.0.0.0"

# Switch to non-root user
USER missioncmd

# Expose port
EXPOSE 4111

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4111/webhooks/github/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
