FROM node:22-bookworm-slim AS build
WORKDIR /repo
RUN npm install -g pnpm@8.15.5
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json ./apps/frontend/package.json
RUN pnpm install --frozen-lockfile
COPY apps/frontend ./apps/frontend
RUN pnpm --filter dsk-stock-frontend build

FROM nginx:1.27-alpine
COPY labs/dsk-stock-lab01-docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/frontend/dist /usr/share/nginx/html
RUN printf 'window.__APP_CONFIG__ = { apiBaseUrl: "/api" };\n' > /usr/share/nginx/html/env.js
EXPOSE 80
