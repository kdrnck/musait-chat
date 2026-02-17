# ── Stage 1: Install & Build ─────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# 1) Copy only workspace config first (better layer caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# 2) Copy shared package manifest
COPY packages/shared/package.json ./packages/shared/

# 3) Copy worker manifest
COPY apps/worker/package.json ./apps/worker/

# 4) Install dependencies (cached unless manifests change)
RUN pnpm install --no-frozen-lockfile

# 5) Copy shared package source & build
COPY packages/shared/ ./packages/shared/

# 6) Copy worker source & build
COPY apps/worker/ ./apps/worker/

# 7) Build worker (shared exports raw TS, no build needed)
RUN pnpm --filter worker build

# ── Stage 2: Production Image ───────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy built shared package
COPY --from=builder /app/packages/shared/ ./packages/shared/

# Copy built worker
COPY --from=builder /app/apps/worker/package.json ./apps/worker/
COPY --from=builder /app/apps/worker/dist/ ./apps/worker/dist/

# Install production deps only
RUN pnpm install --frozen-lockfile --prod

ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "apps/worker/dist/index.js"]
