# Mission Command Centre - Production Dockerfile

# Multi-stage build for Mission Command UI
# Stage 1: Build UI
FROM node:20-alpine AS ui-builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.7.0

# Copy UI files (assuming Vite app is in mission-command/ui)
COPY mission-command/package.json mission-command/pnpm-lock.yaml ./
COPY mission-command/src ./src
COPY packages ./packages

# Build UI
RUN pnpm install --frozen-lockfile
RUN pnpm build

# Stage 2: Production UI server
FROM node:20-alpine AS ui-production

WORKDIR /app

# Install serve for production
RUN npm install -g serve

# Copy built UI from builder
COPY --from=ui-builder /app/dist /app/dist

# Expose UI port
EXPOSE 3000

# Serve UI
CMD ["serve", "-s", "/app/dist", "-l", "3000"]

# Stage 3: Mastra Server
FROM node:20-alpine AS server

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.7.0

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY mission-command ./mission-command

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build all packages
RUN pnpm build

# Expose server port
EXPOSE 4111

# Start Mastra Server
CMD ["pnpm", "start"]
