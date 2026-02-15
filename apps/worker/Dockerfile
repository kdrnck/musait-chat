FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy current build context (can be repo root OR apps/worker)
COPY . .

# Install dependencies
RUN if [ -f "apps/worker/package.json" ]; then \
      cd apps/worker && pnpm install --no-frozen-lockfile; \
    elif [ -f "package.json" ]; then \
      pnpm install --no-frozen-lockfile; \
    else \
      echo "package.json not found in expected locations" && exit 1; \
    fi

# Use tsx for runtime TypeScript execution (avoids build step issues)
# This is fine for Railway — tsx adds ~50ms startup overhead, negligible for a long-running server
EXPOSE 3000

CMD ["sh", "-c", "if [ -f apps/worker/src/index.ts ]; then cd apps/worker && npx tsx src/index.ts; elif [ -f src/index.ts ]; then npx tsx src/index.ts; else echo 'src/index.ts not found' && exit 1; fi"]
