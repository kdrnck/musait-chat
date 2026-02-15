FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Railway service root is apps/worker, so copy local files only.
COPY . .

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Use tsx for runtime TypeScript execution (avoids build step issues)
# This is fine for Railway — tsx adds ~50ms startup overhead, negligible for a long-running server
EXPOSE 3000

CMD ["npx", "tsx", "src/index.ts"]
