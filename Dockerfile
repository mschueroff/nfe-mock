FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS dependencies
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS build
WORKDIR /app
ARG APP_VERSION=0.1.0
ARG APP_COMMIT=development
ENV NEXT_TELEMETRY_DISABLED=1 \
  APP_VERSION=${APP_VERSION} \
  APP_COMMIT=${APP_COMMIT} \
  NEXT_PUBLIC_APP_VERSION=${APP_VERSION}
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS runtime
WORKDIR /app
ARG APP_VERSION=0.1.0
ARG APP_COMMIT=development
ARG SOURCE_URL
LABEL org.opencontainers.image.title="NF-e Mock" \
  org.opencontainers.image.description="Gerador local de NF-e para desenvolvimento, QA e testes de integração" \
  org.opencontainers.image.version="${APP_VERSION}" \
  org.opencontainers.image.source="${SOURCE_URL}" \
  org.opencontainers.image.revision="${APP_COMMIT}" \
  org.opencontainers.image.licenses="MIT"
ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  HOSTNAME=0.0.0.0 \
  PORT=3010 \
  NFE_DATA_DIR=/app/data \
  APP_VERSION=${APP_VERSION} \
  APP_COMMIT=${APP_COMMIT} \
  NEXT_PUBLIC_APP_VERSION=${APP_VERSION}
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/schemas ./schemas
COPY --from=build --chown=node:node /app/db ./db
COPY --from=build --chown=node:node /app/LICENSE /app/THIRD_PARTY_NOTICES.md ./licenses/
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3010
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3010/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
