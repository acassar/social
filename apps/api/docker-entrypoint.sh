#!/bin/sh
# Applique les migrations Prisma en attente avant de démarrer l'API — la
# stack de prod n'a pas d'étape manuelle séparée entre `docker compose up`
# et un schéma à jour (contrairement au dev, où `pnpm db:migrate` est un
# geste explicite).
set -e

node_modules/.bin/prisma migrate deploy

exec node --import @swc-node/register/esm-register src/main.ts
