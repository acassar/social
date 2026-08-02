# apps/web — build depuis la racine du monorepo (workspace pnpm) :
#   docker build -f apps/web/Dockerfile -t social-web .
#
# `VITE_API_URL`/`VITE_VAPID_PUBLIC_KEY` sont figées dans le bundle statique
# au build (Vite), pas lues à l'exécution du conteneur : les passer en
# `--build-arg` avec l'URL publique de l'API pour un vrai déploiement.
FROM node:20-alpine AS deps
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
# --ignore-scripts : le postinstall de @social/api (`prisma generate`) a
# besoin de prisma/schema.prisma, absent de cette couche ne contenant que
# les manifests ; inutile de toute façon pour construire le front.
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS build
COPY . .
ARG VITE_API_URL=http://localhost:3000
ARG VITE_VAPID_PUBLIC_KEY=
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_VAPID_PUBLIC_KEY=${VITE_VAPID_PUBLIC_KEY}
RUN pnpm --filter @social/web run build

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
