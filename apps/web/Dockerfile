# syntax=docker/dockerfile:1
# Production image for @soloquest/web (Nuxt 4). Built from the REPO ROOT context:
#   docker build -f apps/web/Dockerfile -t soloquest-web .
# Routing web <-> api (same host, /api -> api) is handled by Coolify/Traefik, NOT here.
# Runtime env (PORT, and NUXT_PUBLIC_API_BASE for SSR — see notes) is injected by Coolify.

FROM node:24-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

# 1) Prune the monorepo down to @soloquest/web and its workspace deps.
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.9.18 prune @soloquest/web --docker

# 2) Install pruned deps, then add the pruned source and build to .output.
FROM base AS builder
COPY --from=pruner /app/out/json/ .
# --ignore-scripts: the web package's `postinstall: nuxt prepare` needs the app source,
# which isn't present at this json-only stage. `nuxt build` runs prepare itself, and
# esbuild resolves its binary from its platform package (no install script required).
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY --from=pruner /app/out/full/ .
# `turbo prune` doesn't carry root-level configs into the pruned context, but every
# packages/*/tsconfig.json `extends` this base. Nuxt/Vite (TSConfck) resolves it when it
# transforms the workspace source (@soloquest/shared), so copy it from the repo-root
# build context — without it the build fails to resolve the "extends" path.
COPY tsconfig.base.json ./tsconfig.base.json
RUN pnpm exec turbo build --filter=@soloquest/web

# 3) Runtime image — Nitro bundles all deps into .output, so we copy only that.
FROM base AS runner
ENV NODE_ENV=production
# Bind all interfaces inside the container; Nitro reads HOST/PORT from env.
ENV HOST=0.0.0.0
EXPOSE 3000
COPY --from=builder --chown=node:node /app/apps/web/.output ./.output
USER node
CMD ["node", ".output/server/index.mjs"]
