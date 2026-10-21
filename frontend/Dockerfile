FROM node:24-bookworm-slim AS build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM caddy:2-alpine
COPY deployment/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/frontend/dist/frontend/browser /srv
