# Build context: repo root (set via docker-compose)
FROM node:22-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace=@clawhuddle/api --workspace=@clawhuddle/shared --include-workspace-root
COPY tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/
RUN npm run build -w packages/shared && npm run build -w apps/api

FROM node:22-alpine
RUN apk add --no-cache git
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/apps/api/src/db/schema.sql ./dist/db/schema.sql
COPY --from=builder /app/apps/api/src/db/migrations ./dist/db/migrations
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
EXPOSE 4000
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
