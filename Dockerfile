FROM node:24-bookworm-slim

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
COPY . .
RUN pnpm install --frozen-lockfile && pnpm run build

ENV NODE_ENV=production \
    PORT=10000 \
    STATIC_DIR=/app/artifacts/river-en-israel/dist/public \
    AUTOMATION_ENABLED=false
EXPOSE 10000
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
