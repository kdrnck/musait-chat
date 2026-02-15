FROM node:22-alpine

WORKDIR /app

# Copy root workspace files
COPY package.json pnpm-workspace.yaml .npmrc ./

# Copy packages
COPY packages/ ./packages/
COPY convex/ ./convex/

# Copy worker app
COPY apps/worker/ ./apps/worker/

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build worker
RUN pnpm --filter worker build

EXPOSE 3001

CMD ["node", "apps/worker/dist/index.js"]
