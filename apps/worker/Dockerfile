FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy root workspace files
COPY package.json pnpm-workspace.yaml .npmrc ./

# Copy packages
COPY packages/ ./packages/

# Copy convex generated files (needed for API references)
COPY convex/ ./convex/

# Copy worker app
COPY apps/worker/ ./apps/worker/

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Use tsx for runtime TypeScript execution (avoids build step issues)
# This is fine for Railway — tsx adds ~50ms startup overhead, negligible for a long-running server
EXPOSE 3002

CMD ["npx", "tsx", "apps/worker/src/index.ts"]
