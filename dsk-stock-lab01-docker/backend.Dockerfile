FROM node:22-bookworm-slim AS build
WORKDIR /repo
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@8.15.5
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend ./apps/backend
RUN pnpm install --frozen-lockfile
RUN pnpm --filter dsk-stock-backend prisma:generate
RUN pnpm --filter dsk-stock-backend build

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=build --chown=node:node /repo /repo
WORKDIR /repo/apps/backend
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
