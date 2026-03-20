# STACKOS MCP Server

[![MCP Server](https://img.shields.io/badge/MCP-Server-purple)](https://modelcontextprotocol.io)

MCP Server que expone la knowledge base, metodología, evaluaciones y standards de **TRAID Agency** como servicio consumible desde cualquier cliente MCP.

Compatible con: Claude Code, ChatGPT, Gemini, Cursor, Windsurf, n8n.

## Qué es STACKOS

Sistema de investigación técnica que mantiene documentación siempre actualizada con evaluaciones objetivas de herramientas (ADOPT/HOLD/DROP), papers de investigación, standards de calidad y conocimiento institucional.

**Sin RAG, sin vector DB** — búsqueda por keyword sobre archivos markdown.

## Tools disponibles (16)

### Lectura y búsqueda (6)

| Tool | Descripción |
|------|-------------|
| `buscar_evaluacion` | Busca evaluación Tech Radar de una herramienta |
| `buscar_conocimiento` | Grep en toda la knowledge base o por área |
| `listar_skills` | Lista skills/metodologías disponibles |
| `listar_evaluaciones` | Lista todas las evaluaciones con clasificación |
| `leer_standard` | Lee un standard de calidad completo |
| `obtener_contexto_global` | Resumen ejecutivo de toda la KB |

### Skills y metodología (3)

| Tool | Descripción |
|------|-------------|
| `leer_skill` | Lee el workflow completo de un skill (SKILL.md) |
| `leer_metodologia` | Lee SDD-STACKOS, reglas universales o estándar de Engram |
| `guia_aprendizaje` | Guía estructurada para alumnos (principiante/intermedio/avanzado) |

### Pedagógicos (4)

| Tool | Descripción |
|------|-------------|
| `modo_tutor` | Instrucciones que convierten al agente en tutor pedagógico |
| `explicar_concepto` | Explica conceptos con analogía, ejemplo y verificación |
| `ejercicio_practico` | Genera ejercicios por tema y nivel |
| `evaluar_respuesta` | Evalúa respuesta del alumno con feedback constructivo |

### Escritura (3)

| Tool | Descripción |
|------|-------------|
| `registrar_leccion` | Registra lección aprendida (append-only) |
| `agregar_nota_conocimiento` | Agrega nota a archivo de knowledge existente |
| `proponer_evaluacion` | Propone herramienta para evaluar |

## Para alumnos

Si sos alumno y te compartieron este MCP, empezá así:

1. **`modo_tutor`** — El agente se convierte en tu tutor pedagógico
2. **`guia_aprendizaje`** con nivel `"principiante"` — te da el roadmap completo
3. **`explicar_concepto`** con `"spec"` nivel `"principiante"` — tu primer concepto
4. **`ejercicio_practico`** con `"spec"` nivel `"principiante"` — practica lo aprendido
5. **`evaluar_respuesta`** — cuando termines el ejercicio, evaluá tu trabajo

### Flujo de una sesión de aprendizaje

```
modo_tutor → guia_aprendizaje → explicar_concepto → ejercicio_practico → evaluar_respuesta
     ↑                                                                          │
     └──────────────────── siguiente concepto ←─────────────────────────────────┘
```

### Conceptos disponibles (con 3 niveles cada uno)
- **spec** — Especificaciones y OpenSpec v2
- **skill** — Skills y automatizaciones
- **engram** — Sistema de memoria persistente
- **quality-gate** — Quality gates y gobernanza
- **lifecycle** — Ciclo de vida de un proyecto

### Resources (8)

| URI | Contenido |
|-----|-----------|
| `stackos://institucional/traid` | Marca y stack de TRAID Agency |
| `stackos://institucional/nahuel` | Perfil del co-founder |
| `stackos://contexto-global` | Resumen de toda la KB |
| `stackos://standards/investigacion` | Cómo investigar |
| `stackos://standards/citacion` | Formato de citas |
| `stackos://standards/evaluacion` | Criterios Tech Radar |
| `stackos://standards/checklist` | Checklist pre-publicación |
| `stackos://indice` | Índice de topics y evaluaciones |

## Quick Start

### Local (stdio)

```bash
git clone <este-repo>
cd stackos-mcp
npm install
npm run build
node dist/index.js
```

### Docker (HTTP)

```bash
docker compose up -d --build
# Endpoint: http://localhost:3000/mcp
# Health:   http://localhost:3000/health
```

## Configuración

### Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `STACKOS_ROOT` | `D:/OneDrive/GitHub/CONOCIMIENTO-NAHUEL` | Ruta a la knowledge base |
| `MCP_TRANSPORT` | `stdio` | Transporte: `stdio` o `http` |
| `PORT` | `3000` | Puerto HTTP |
| `STACKOS_API_KEY` | (vacío) | Bearer token. Si está definido, valida auth |

### Claude Code

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

### Remoto (ChatGPT, Gemini, Cursor, n8n)

```json
{
  "stackos": {
    "type": "http",
    "url": "https://tu-servidor.com:3000/mcp",
    "headers": { "Authorization": "Bearer <tu-api-key>" }
  }
}
```

## Licencia

MIT
