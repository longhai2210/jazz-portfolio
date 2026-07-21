# === Stage 1: Build ===
FROM node:18-alpine AS builder

# Install pnpm globally
RUN npm install -g pnpm

WORKDIR /app

# Copy root configurations and workspace settings
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api

# Install dependencies (only packages and apps/api needed)
RUN pnpm install --frozen-lockfile

# Generate Prisma Client
WORKDIR /app/packages/database
RUN pnpm db:generate

# Build apps/api using Turborepo
WORKDIR /app
RUN npx turbo run build --filter=@jazz-portfolio/api

# === Stage 2: Runtime ===
FROM node:18-alpine AS runner

WORKDIR /app

# Set node production environment
ENV NODE_ENV=production

# Copy built outputs and dependencies from Stage 1
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/database ./packages/database
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/api ./apps/api

EXPOSE 3001

# Run NestJS API server
CMD ["node", "apps/api/dist/main"]
