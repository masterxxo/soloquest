# syntax=docker/dockerfile:1
# Production image for @soloquest/api (Hono). Built from the REPO ROOT context:
#   docker build -f apps/api/Dockerfile -t soloquest-api .
# Runtime env (DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, PORT) is injected by
# Coolify at run time — never baked in, never passed as ARG.

FROM node:22-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

# 1) Prune the monorepo down to @soloquest/api and its workspace deps.
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.9.18 prune @soloquest/api --docker

# 2) Install pruned deps (cached on the lockfile), then add the pruned source.
FROM base AS builder
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
# No build step: the API runs TypeScript directly via tsx (start = "tsx src/index.ts").
# This keeps workspace deps unbundled — the pruned node_modules is all it needs.

# 3) Runtime image — non-root, env from the process environment (Coolify).
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder --chown=node:node /app .
USER node
WORKDIR /app/apps/api
# App listens on PORT (falls back to 3001). Coolify injects PORT/secrets at runtime.
EXPOSE 3001
CMD ["pnpm", "start"]
