import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { parseFrontmatter } from "../utils/frontmatter.js";

/**
 * Genera una guía de aprendizaje estructurada para alumnos nuevos.
 * Organiza los skills por nivel de dificultad y orden recomendado.
 */
export function guiaAprendizaje(root: string, nivel: "principiante" | "intermedio" | "avanzado"): string {
  // Cargar lista de skills disponibles
  const skillsDir = join(root, ".claude", "skills");
  const skills: Array<{ name: string; description: string }> = [];

  try {
    const entries = readdirSync(skillsDir);
    for (const entry of entries) {
      if (entry.startsWith("_") || entry.startsWith(".")) continue;
      const entryPath = join(skillsDir, entry);
      try {
        if (!statSync(entryPath).isDirectory()) continue;
      } catch { continue; }
      const skillFile = join(entryPath, "SKILL.md");
      try {
        const content = readFileSync(skillFile, "utf-8");
        const fm = parseFrontmatter(content);
        if (fm) skills.push({ name: fm.name, description: fm.description });
      } catch { continue; }
    }
  } catch { /* skills dir may not exist */ }

  // Cargar evaluaciones disponibles
  const evalsDir = join(root, "content", "evaluations");
  let evalCount = 0;
  try {
    evalCount = readdirSync(evalsDir).filter(f => f.endsWith(".md")).length;
  } catch { /* ok */ }

  // Construir guía según nivel
  const guides: Record<string, string> = {
    principiante: buildPrincipiante(skills, evalCount),
    intermedio: buildIntermedio(skills, evalCount),
    avanzado: buildAvanzado(skills, evalCount),
  };

  return guides[nivel];
}

function buildPrincipiante(skills: Array<{ name: string; description: string }>, evalCount: number): string {
  return `# Guía de Aprendizaje — Nivel Principiante

## Bienvenido a STACKOS

STACKOS es un sistema de desarrollo donde:
1. **La spec es la fuente de verdad** — Todo parte de una especificación escrita
2. **El agente ejecuta, el humano decide** — Claude Code implementa, vos aprobás
3. **La memoria persiste** — Lo que se aprende no se pierde entre sesiones
4. **Quality gates no se negocian** — El código debe pasar tests antes de commitear

## Paso 1: Entendé la metodología
Usá \`leer_metodologia\` con documento \`"sdd-stackos"\` para leer la metodología completa.

## Paso 2: Leé las reglas universales
Usá \`leer_metodologia\` con documento \`"reglas-universales"\`. Son 17 reglas que aplican SIEMPRE.

## Paso 3: Explorá los skills disponibles
Hay ${skills.length} skills organizados en 3 tiers:

### Tier 1 — UNIVERSAL (empezá por acá)
${skills.filter(s => ["loop", "wrap-up", "deploy", "QA", "skill-creator", "sop-creator", "mcp-client"].includes(s.name)).map(s => `- **/${s.name}**: ${s.description}`).join("\n")}

### Tier 2 — KNOWLEDGE (investigación)
${skills.filter(s => ["investigar", "evaluar", "actualizar", "redactar"].includes(s.name)).map(s => `- **/${s.name}**: ${s.description}`).join("\n")}

### Tier 3 — AUTOPILOT (desarrollo de proyectos)
${skills.filter(s => ["kickoff", "build-feature", "n8n-dev", "cycle-review", "manual", "deliver"].includes(s.name)).map(s => `- **/${s.name}**: ${s.description}`).join("\n")}

## Paso 4: Leé tu primer skill
Empezá con \`leer_skill "wrap-up"\` — es el más simple y te muestra cómo funciona el sistema de memoria.

## Paso 5: Consultá el Tech Radar
Hay ${evalCount} herramientas evaluadas. Usá \`listar_evaluaciones\` para verlas y \`buscar_evaluacion\` para detalle.

## Ejercicio práctico
1. Usá \`obtener_contexto_global\` para ver el resumen de la knowledge base
2. Usá \`buscar_conocimiento\` con query "Supabase" para encontrar info sobre la base de datos
3. Leé el skill \`investigar\` para entender cómo se investigan temas nuevos

## Conceptos clave
- **Spec**: Documento que define QUÉ se construye (no cómo)
- **Skill**: Workflow automatizado que sigue pasos definidos
- **Engram**: Sistema de memoria persistente entre sesiones
- **Quality Gate**: Verificación obligatoria antes de avanzar
- **Tech Radar**: Clasificación de herramientas (ADOPT/TRIAL/ASSESS/HOLD/DROP)
`;
}

function buildIntermedio(skills: Array<{ name: string; description: string }>, evalCount: number): string {
  return `# Guía de Aprendizaje — Nivel Intermedio

## Ya conocés lo básico. Ahora profundizá.

## Fase 1: Dominar el ciclo de desarrollo

El ciclo completo de un proyecto:
\`\`\`
/kickoff → /build-feature (×N) → /n8n-dev → /QA
                │                              │
                ▼                              ▼
           /loop (multi)            /cycle-review
                                         │
                                         ▼
                              /manual → /deliver → /deploy → /wrap-up
\`\`\`

### Ejercicio: Leé estos skills en orden
1. \`leer_skill "kickoff"\` — Cómo se arranca un proyecto
2. \`leer_skill "build-feature"\` — Los 10 pasos de implementación (el core)
3. \`leer_skill "cycle-review"\` — Cómo se cierra un ciclo
4. \`leer_skill "deliver"\` — Cómo se entrega al cliente

## Fase 2: Entender Engram (memoria)
Usá \`leer_metodologia "engram-usage"\` para el estándar completo.

Puntos clave:
- Formato obligatorio: What / Why / Where / Learned
- Tipos: discovery, decision, config
- Topic keys jerárquicos: \`<proyecto>/<área>\`
- Lifecycle: active → superseded → obsolete

## Fase 3: Evaluar herramientas
Leé el skill \`evaluar\` y el standard \`evaluacion\`.
Hay ${evalCount} evaluaciones existentes como referencia.

## Fase 4: Skills de investigación
- \`/investigar\` — Papers técnicos con citas verificables
- \`/evaluar\` — Tech Radar de herramientas
- \`/actualizar\` — Mantenimiento de contenido

## Ejercicio avanzado
1. Leé \`leer_skill "build-feature"\` completo
2. Identificá los 10 pasos y el bucle de control de errores
3. Entendé cuándo el agente escala al humano (BLOCKER)
4. Analizá cómo se integra Engram en paso 2 (buscar) y paso 8 (guardar)

## Métricas que se trackean
- **Lead time**: Horas desde spec hasta done
- **First-pass rate**: % de gates verdes en intento 1
- **Rework**: Tareas reabiertas
- **Spec drift**: Puntos de spec no cubiertos
- **Human takeover rate**: BLOCKERs / total tareas
- **Memory hit rate**: Memorias útiles / búsquedas totales
`;
}

function buildAvanzado(skills: Array<{ name: string; description: string }>, evalCount: number): string {
  return `# Guía de Aprendizaje — Nivel Avanzado

## Dominá el sistema completo.

## 1. Crear skills propios
Leé \`leer_skill "skill-creator"\` — el meta-skill que crea nuevos skills.

Estructura de un skill:
\`\`\`
.claude/skills/<nombre>/SKILL.md
---
name: <nombre>
description: <qué hace>
tools: [Read, Write, Edit, Bash, Grep, Glob]
---
# Contenido del skill
\`\`\`

## 2. Arquitectura del sistema

### 5 capas de STACKOS:
1. **Specs** (OpenSpec v2) — Fuente de verdad del producto
2. **Skills** (17 skills, 3 tiers) — Ejecución automatizada
3. **Memoria** (Engram) — Persistencia cross-sesión
4. **Gobernanza** — Quality gates + secret scanning + hooks
5. **Métricas** — Lead time, first-pass, rework, drift

### Artefactos estándar:
- \`spec.md\` — Especificación de feature (OpenSpec v2)
- \`backlog.md\` — Estado del ciclo de desarrollo
- \`progress.txt\` — Memoria local del proyecto (append-only)
- \`sessions/*.md\` — Registro de sesiones de trabajo

## 3. Gobernanza avanzada
- **Quality gates**: tsc + lint + test + build (hooks enforced)
- **Secret scanning**: pre-commit hook + scan_secrets.py
- **Spec linting**: lint_specs.py valida estructura OpenSpec v2
- **GitHub Actions**: secret-scan.yml en CI/CD

## 4. MCP Servers del ecosistema
- **stackos** — Knowledge base (este server)
- **gemini** — Multimedia (imágenes, audio, video)
- **engram** — Memoria persistente
- **n8n** — Automatización de workflows
- **supabase** — Base de datos

## 5. Sync de skills entre proyectos
\`\`\`bash
python scripts/sync_skills.py --dry-run  # preview
python scripts/sync_skills.py            # sync a todos
\`\`\`
Manifest: \`scripts/skills-manifest.json\`

## 6. Extender STACKOS
- Crear nuevos skills con \`/skill-creator\`
- Crear SOPs con \`/sop-creator\`
- Agregar MCP servers con \`/mcp-client\`
- Proponer evaluaciones con \`proponer_evaluacion\`

## Ejercicio final
1. Leé TODOS los skills del Tier 3 (Autopilot)
2. Diseñá un skill propio para un caso de uso que te interese
3. Evaluá una herramienta nueva siguiendo el standard de evaluación
4. Escribí una investigación siguiendo el standard de investigación

## ${skills.length} skills disponibles:
${skills.map(s => `- **/${s.name}**: ${s.description}`).join("\n")}
`;
}
