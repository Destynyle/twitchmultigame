FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY . .
RUN pnpm install
ENV SKIP_ENV_VALIDATION=1
RUN pnpm turbo build --filter=@playground/web
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/.next/standalone/apps/web/server.js"]
