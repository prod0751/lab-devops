# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS deps
WORKDIR /repo

# deps système (prisma/openssl)
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# pnpm
RUN npm i -g pnpm@8.15.5

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json apps/backend/package.json

# IMPORTANT: ne pas exécuter postinstall ici
RUN pnpm install --no-frozen-lockfile --ignore-scripts

FROM deps AS build
WORKDIR /repo

COPY apps/backend apps/backend


RUN pnpm --filter dsk-stock-backend prisma:generate
RUN pnpm --filter dsk-stock-backend build
FROM deps AS prod-deps
WORKDIR /repo
COPY apps/backend/prisma apps/backend/prisma
RUN pnpm --filter dsk-stock-backend deploy --prod /out
# Génère le client Prisma dans /out/node_modules après l'install prod
WORKDIR /out
RUN npx prisma generate --schema /repo/apps/backend/prisma/schema.prisma

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
  && useradd -m -u 10001 nodeuser

ENV NODE_ENV=production
ENV NODE_OPTIONS=--dns-result-order=ipv4first

COPY --from=prod-deps /out/node_modules ./node_modules
COPY --from=prod-deps /out/package.json ./package.json
COPY --from=build /repo/apps/backend/dist ./dist
COPY --from=build /repo/apps/backend/prisma ./prisma
# Génère le client Prisma dans l'image finale (sécurise l'init)
RUN npx prisma generate --schema ./prisma/schema.prisma

USER nodeuser
EXPOSE 3001
CMD ["node", "dist/main.js"]
