# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim AS build
WORKDIR /repo

# Force IPv4 preference and ensure CA bundle is present for npm registry access
RUN echo "precedence ::ffff:0:0/96  100" >> /etc/gai.conf || true
RUN apt-get update -y && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm i -g pnpm@8.15.5
RUN pnpm --version
 
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/frontend/package.json apps/frontend/package.json
RUN pnpm install --frozen-lockfile

COPY apps/frontend apps/frontend
RUN pnpm --filter dsk-stock-frontend build

FROM nginx:1.27-alpine AS runtime
COPY apps/frontend/entrypoint.sh /entrypoint.sh
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/frontend/dist /usr/share/nginx/html
EXPOSE 80
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
