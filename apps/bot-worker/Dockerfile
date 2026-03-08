FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/bot-worker/package.json ./apps/bot-worker/
COPY packages/shared/package.json ./packages/shared/
COPY packages/eslint-config/package.json ./packages/eslint-config/
RUN pnpm install --frozen-lockfile --filter @playground/bot-worker...

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/bot-worker/node_modules ./apps/bot-worker/node_modules
COPY . .
RUN pnpm --filter @playground/bot-worker build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/bot-worker/dist ./dist
COPY --from=builder /app/apps/bot-worker/node_modules ./node_modules

EXPOSE 3001

CMD ["node", "dist/index.js"]
