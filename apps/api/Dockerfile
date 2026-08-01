# apps/api — build depuis la racine du monorepo (workspace pnpm) :
#   docker build -f apps/api/Dockerfile -t social-api .
#
# `tsc` compile en ESM avec moduleResolution "Bundler" (tsconfig.base.json) :
# les imports relatifs sortent sans extension et `@social/shared` reste un
# spécificateur de package, comme attendu d'un bundler — mais un `node`
# nu ne sait résoudre ni l'un ni l'autre. Le runtime utilise donc le même
# loader que `start:dev` (`@swc-node/register`) pointé sur `src/main.ts` :
# TS exécuté directement, cohérent avec le reste du repo. `tsc` tourne quand
# même au build (ci-dessous) comme garde-fou de compilation.
FROM node:20-alpine AS deps
RUN apk add --no-cache openssl && corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/prisma.config.ts
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @social/api run build

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
