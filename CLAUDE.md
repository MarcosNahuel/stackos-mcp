# STACKOS MCP Server

MCP Server que expone la knowledge base de TRAID Agency.

## Desarrollo local

```bash
npm install
npm run dev          # tsx watch
npm run typecheck    # tsc --noEmit
```

## Build

```bash
npm run build        # compila a dist/
```

## Correr en modo stdio (local)

```bash
node dist/index.js
# o con env explícito:
STACKOS_ROOT=D:/OneDrive/GitHub/CONOCIMIENTO-NAHUEL node dist/index.js
```

## Correr en modo HTTP (remoto)

```bash
node dist/index.js --http --port 3000
# o con env:
MCP_TRANSPORT=http PORT=3000 STACKOS_API_KEY=mi-clave node dist/index.js
```

## Deploy con Docker

```bash
docker compose up -d --build
```

## Sync de datos en VPS

```bash
git clone <repo-conocimiento> /data
# Crontab: cada hora sincroniza
echo "0 * * * * cd /data && git pull origin master" | crontab -
```

## Configuración por cliente

### Claude Code (stdio local)

En `~/.claude/settings.json` o `.claude/settings.json`:

```json
{
  "mcpServers": {
    "stackos": {
      "type": "stdio",
      "command": "node",
      "args": ["D:/OneDrive/GitHub/stackos-mcp/dist/index.js"],
      "env": { "STACKOS_ROOT": "D:/OneDrive/GitHub/CONOCIMIENTO-NAHUEL" }
    }
  }
}
```

### Remoto (HTTP) — ChatGPT, Gemini, Cursor, n8n

```json
{
  "stackos": {
    "type": "http",
    "url": "https://tu-servidor.com:3000/mcp",
    "headers": { "Authorization": "Bearer <tu-api-key>" }
  }
}
```

## Quality gates

```bash
npm run typecheck    # tsc --noEmit
npm run build        # compilación completa
```

## Estructura

```
src/
├── index.ts          # Entry point, registra tools + resources
├── transport.ts      # stdio vs HTTP
├── config.ts         # STACKOS_ROOT y configuración
├── tools/            # 9 tools (6 lectura + 3 escritura)
├── resources/        # 8 resources estáticos
└── utils/            # grep, markdown-parser, frontmatter
```
