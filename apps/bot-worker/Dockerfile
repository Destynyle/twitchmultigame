FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/bot-worker/package.json ./apps/bot-worker/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/game-engine/package.json ./packages/game-engine/
COPY packages/game-types/package.json ./packages/game-types/
COPY packages/eslint-config/package.json ./packages/eslint-config/
RUN pnpm install --frozen-lockfile --filter @playground/bot-worker...

FROM base AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/bot-worker/node_modules ./apps/bot-worker/node_modules
COPY . .
WORKDIR /app/apps/bot-worker
CMD ["npx", "tsx", "src/index.ts"]
