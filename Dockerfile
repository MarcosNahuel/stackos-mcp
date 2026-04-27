FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache git
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
RUN mkdir -p /data
# cache-bust: v2
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENV MCP_TRANSPORT=http
ENV PORT=3000
ENV STACKOS_ROOT=/data
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
