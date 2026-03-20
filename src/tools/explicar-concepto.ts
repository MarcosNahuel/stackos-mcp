import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Genera explicaciones pedagógicas de conceptos STACKOS.
 * Cada explicación incluye: contexto, analogía, concepto, ejemplo y pregunta de verificación.
 */
export function explicarConcepto(concepto: string, nivel: "principiante" | "intermedio" | "avanzado"): string {
  const key = concepto.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  // Conceptos predefinidos con explicaciones pedagógicas
  const conceptos: Record<string, Record<string, string>> = {
    "spec": {
      principiante: `# ¿Qué es una Spec?

## Contexto
Imaginá que vas a construir una casa. ¿Empezarías a poner ladrillos sin un plano? No. El plano te dice qué construir, dónde van las paredes, cuántas habitaciones. La **spec** es el plano del software.

## Analogía
Spec = Receta de cocina. Antes de cocinar, leés la receta: ingredientes (alcance), pasos (implementation), y cómo saber si salió bien ("la masa debe estar dorada" = acceptance criteria).

## Concepto
Una **spec** (especificación) es un documento que define:
- **Qué** se construye (y qué NO)
- **Cómo se verifica** que está bien (acceptance criteria)
- **Qué está prohibido** (boundaries)
- **Cómo se prueba** (plan de pruebas)

En STACKOS usamos el formato **OpenSpec v2** — un template de markdown con secciones obligatorias.

## Ejemplo
\`\`\`markdown
# Spec: Sincronización de productos con Mercado Libre

## Propósito
Sincronizar el catálogo local con ML cada 6 horas.

## Alcance
- INCLUDE: Crear, actualizar precio y stock
- NOT INCLUDE: Borrar productos, gestionar preguntas

## Acceptance Criteria
- [ ] Los productos se sincronizan cada 6 horas
- [ ] Si falla, se reintenta 3 veces antes de alertar
- [ ] El stock nunca queda en negativo
\`\`\`

## Verificación
🤔 **Pregunta para vos:** ¿Por qué crees que es importante definir "NOT INCLUDE" (lo que NO se hace)?`,

      intermedio: `# Spec en STACKOS — Más allá del documento

## El problema que resuelve
Sin spec, el agente "llena los blancos" con suposiciones. A veces acierta, a veces no. Con spec, las decisiones están tomadas ANTES de codear.

## Spec ≠ PRD
Un PRD (Product Requirements Document) describe el producto completo. Una spec describe UNA feature específica con todo el detalle para implementarla.

## Estructura OpenSpec v2
| Sección | Propósito |
|---------|-----------|
| Propósito | Qué hace y por qué |
| Alcance | Include / NOT include |
| Acceptance Criteria | Checklist verificable |
| Boundaries | ALWAYS / ASK FIRST / NEVER |
| Seguridad | RLS, validación, secrets |
| Plan de pruebas | Comandos exactos |

## La regla de oro
> **NUNCA se modifica spec.md directamente.** Las decisiones van en notes.md.

¿Por qué? Porque la spec es la "fuente de verdad". Si la modificamos durante la implementación, perdemos trazabilidad de qué se pidió vs qué se decidió después.

## Verificación
🤔 **Pensá:** ¿Qué pasa si un agente implementa algo que contradice la spec? ¿Cómo lo detectamos?
(Pista: buscá "Auto-QA" en el skill build-feature)`,

      avanzado: `# Spec como contrato — Arquitectura de specs en STACKOS

## Spec-Driven Development
En SDD clásico, la spec es un documento estático que un humano escribe y un humano implementa. En SDD-STACKOS, la spec es un **contrato ejecutable**: el agente la lee, implementa, y verifica automáticamente (Auto-QA paso 7).

## El pipeline de una spec
\`\`\`
Brainstorming → Spec v2 → Clarify → Plan → Implement → Auto-QA (spec vs código)
\`\`\`

El paso de **Clarify** es clave: resuelve ambigüedades ANTES de planificar. Max 5 preguntas. Si hay más, la spec necesita reescritura.

## Spec drift detection
El agente relee la spec completa en paso 7 (Auto-QA) y verifica punto por punto:
- Cada requerimiento tiene implementación
- No hay código que contradiga la spec
- No hay código huérfano (implementado pero no especificado)

## Trade-offs de diseño
- ¿Por qué markdown y no JSON Schema? → Legibilidad humana + versionado en git
- ¿Por qué notes.md separado? → Trazabilidad de decisiones post-spec
- ¿Por qué NOT include explícito? → Evita scope creep del agente

## Desafío
🧪 Diseñá una spec para una feature que conozcas. ¿Podés cubrir las 6 secciones obligatorias?`
    },

    "skill": {
      principiante: `# ¿Qué es un Skill?

## Contexto
Cuando cocinás mucho, desarrollás "recetas propias" — pasos que siempre seguís en el mismo orden. Un skill es exactamente eso: una receta que el agente sigue paso a paso.

## Analogía
Skill = Procedimiento médico. Un cirujano sigue un protocolo paso a paso. No improvisa. Cada paso tiene un criterio de éxito. Si algo sale mal, hay un protocolo de escalación.

## Concepto
Un **skill** es un archivo (SKILL.md) que le dice al agente:
- **Cuándo activarse** (trigger: qué palabras lo disparan)
- **Qué pasos seguir** (proceso paso a paso)
- **Qué hacer si falla** (manejo de errores)
- **Qué herramientas usar** (tools: Read, Write, Bash, etc.)

## Ejemplo simple
El skill \`/wrap-up\` se activa cuando decís "cerrá la sesión" y hace:
1. Analiza qué se hizo (git diff)
2. Clasifica: ¿es conocimiento reutilizable o específico?
3. Guarda en memoria (Engram)
4. Genera un archivo de sesión como backup

## En STACKOS hay 17 skills organizados en 3 niveles:
- **Universal** (7) — Funcionan en cualquier proyecto
- **Knowledge** (4) — Solo para investigación
- **Autopilot** (6) — Para desarrollo de proyectos ERP/CRM

## Verificación
🤔 **Pregunta:** ¿Cuál es la diferencia entre un skill y un script? (Pista: pensá en quién lo ejecuta y cómo maneja errores)`,

      intermedio: `# Skills — El motor de STACKOS

## Anatomía de un skill
\`\`\`markdown
---
name: mi-skill
description: Qué hace en una línea
tools: [Read, Write, Edit, Bash, Grep, Glob]
---
# Contenido: trigger, pasos, reglas, output esperado
\`\`\`

## Composición
Los skills son piezas componibles, no un monolito:
- Cada skill hace UNA cosa bien
- Se encadenan: \`/kickoff → /build-feature → /QA → /deliver\`
- Se pueden usar individualmente

## El bucle de control de errores
CADA paso de un skill sigue este patrón:
\`\`\`
Ejecutar → ¿OK? → Siguiente paso
              │ NO
              ▼
Analizar error:
  Trivial → Autofix + reintento
  Técnico → Diagnóstico + fix + reintento
  3 fallos → BLOCKER: parar, preguntar al humano
\`\`\`

## Reglas universales vs específicas
- Las reglas que aplican a TODOS los skills están en CLAUDE.md global
- Cada skill solo define reglas PROPIAS (no repite las universales)

## Verificación
🤔 **Pregunta:** ¿Por qué un skill tiene max 3 reintentos y no 10? ¿Qué problema evita?`,

      avanzado: `# Skills — Diseño y extensión

## Crear un skill propio
Usá el meta-skill \`/skill-creator\` o diseñá manualmente.

Principios de diseño:
1. **Single responsibility** — Un skill, una cosa
2. **Fail-fast** — Detectar problemas temprano
3. **Human-in-the-loop** — Checkpoints en features complejas
4. **Memory-aware** — Buscar antes, guardar después

## Tiers y sincronización
\`\`\`
Tier 1 (Universal) → se copia a TODOS los proyectos
Tier 2 (Knowledge) → solo en repo de conocimiento
Tier 3 (Autopilot) → solo en proyectos ERP/CRM
\`\`\`
Sync: \`python scripts/sync_skills.py\`

## Desafío
🧪 Diseñá un skill para un caso de uso que te interese. Definí: trigger, pasos, manejo de errores, qué guarda en memoria.`
    },

    "engram": {
      principiante: `# ¿Qué es Engram (Memoria)?

## Contexto
¿Alguna vez resolviste un problema en el trabajo y 2 meses después te encontraste el mismo problema y no te acordabas cómo lo habías resuelto? Eso le pasa a los agentes de IA. Cada conversación nueva empieza de cero. **Engram resuelve eso.**

## Analogía
Engram = Cuaderno de notas de un científico. Cada vez que descubrís algo, lo anotás con estructura:
- **Qué** descubriste
- **Por qué** importa
- **Dónde** aplica
- **Qué aprendiste** (la lección reutilizable)

## Concepto
**Engram** es un sistema de memoria persistente. Cuando el agente aprende algo, lo guarda. Cuando empieza una tarea nueva, busca si ya sabe algo relevante.

3 operaciones básicas:
- **mem_save** — Guardar una memoria
- **mem_search** — Buscar memorias relevantes
- **mem_context** — Obtener contexto de un proyecto

## Ejemplo
Supongamos que el agente descubre que la API de Mercado Libre tiene un rate limit de 10 requests por segundo. Guarda:

\`\`\`
What: ML API tiene rate limit de 10 req/seg
Why: Si lo superás, te bloquean 1 hora
Where: Todos los proyectos que usan ML API
Learned: Siempre usar cola con delay de 100ms entre requests
\`\`\`

La próxima vez que trabaje en otro proyecto con ML, lo va a encontrar y no va a cometer el mismo error.

## Verificación
🤔 **Pregunta:** ¿Qué pasa si una memoria se vuelve obsoleta? (Ej: ML cambia su rate limit a 20 req/seg). ¿Cómo lo manejamos?`,

      intermedio: `# Engram — Sistema de memoria cross-proyecto

## Tipos de memoria
| Tipo | Cuándo | Ejemplo |
|------|--------|---------|
| **discovery** | Descubrís un gotcha o pattern | "Supabase RLS no funciona con service_role" |
| **decision** | Tomás una decisión de arquitectura | "Usamos server actions en vez de API routes" |
| **config** | Configurás algo exitosamente | "Deploy a Vercel necesita NODE_ENV=production" |

## Lifecycle de una memoria
\`\`\`
active → superseded (reemplazada por otra más nueva)
       → obsolete (ya no aplica)
\`\`\`

Campos del lifecycle:
- **Source**: de dónde viene (commit, sesión, investigación)
- **Confidence**: high / medium / low
- **Status**: active / superseded / obsolete
- **Supersedes**: topic_key de la nota que reemplaza

## Cuándo guardar automáticamente
- "Si hubiera sabido esto antes..."
- "Esto aplica a todos los ERPs"
- "El workaround para esto es..."
- "Decidimos X en vez de Y porque..."

## Verificación
🤔 ¿Cuándo conviene que una memoria tenga confidence "low"? Dá un ejemplo.`,

      avanzado: `# Engram — Arquitectura y optimización

## Formato obligatorio
\`\`\`
**What:** [concreto]
**Why:** [por qué importa]
**Where:** [dónde aplica]
**Learned:** [lección reutilizable]
**Source:** [commit/sesión]
**Confidence:** high|medium|low
**Status:** active|superseded|obsolete
**Supersedes:** [topic_key anterior o "—"]
\`\`\`

## Consolidación
Cuando hay 3+ notas sobre el mismo tema → merge en 1 nota resumen.
La nota resumen tiene Supersedes apuntando a las originales.

## Freshness audit
Script que detecta:
- Memorias sin acceso en 90+ días
- Duplicados (mismo topic_key, mismo tipo)
- Candidatos a consolidación

## Limitaciones actuales
- Append-only (no hay invalidación automática)
- Retrieval por texto plano (no vector search)
- Sin analytics de uso

## Desafío
🧪 ¿Cómo diseñarías un sistema de "confianza decreciente"? (Una memoria pierde confianza si no se valida periódicamente)`
    },

    "quality-gate": {
      principiante: `# ¿Qué es un Quality Gate?

## Contexto
En una fábrica de autos, hay puntos de inspección donde se verifica que todo esté bien antes de seguir ensamblando. Si un auto tiene un defecto en la pintura, no pasa a la siguiente etapa. Un **quality gate** es lo mismo para el código.

## Analogía
Quality Gate = Control de pasaporte en el aeropuerto. No importa quién seas — si tu pasaporte no está en orden, no pasás. No hay excepciones, no hay "por esta vez".

## Concepto
Un quality gate es una verificación obligatoria que el código DEBE pasar antes de avanzar:
\`\`\`bash
npx tsc --noEmit     # ¿El código compila sin errores de tipos?
npm run lint         # ¿Sigue las reglas de estilo?
npm test             # ¿Los tests pasan?
npm run build        # ¿Se puede construir para producción?
\`\`\`

**La regla de oro: Quality gates NO se negocian.** No se skipean, no se desactivan, no "por esta vez".

## Verificación
🤔 **Pregunta:** ¿Por qué crees que la regla dice "no se negocian"? ¿Qué podría pasar si "por esta vez" dejamos pasar un error de tipos?`,

      intermedio: `# Quality Gates en STACKOS

## 4 niveles de gates
1. **Gate 0**: build + lint + tests pasan ANTES de empezar
2. **Gate por tarea**: typecheck + tests relevantes
3. **Gate final**: suite completa + Auto-QA
4. **Gate de seguridad**: secret scanning pre-commit

## Enforcement
Los gates se configuran como hooks en el proyecto:
- Pre-commit hook: secret scanning
- Settings hooks: tsc, lint, test

## Métricas asociadas
- **First-pass rate**: % de gates verdes en intento 1
  → Mide calidad del código del agente
- **Rework**: tareas que necesitan re-trabajo después del gate
  → Mide precisión de la implementación

## Verificación
🤔 ¿Cuál es la diferencia entre un quality gate y un test? ¿Son lo mismo?`,

      avanzado: `# Gates — Diseño de gobernanza

## Gates como arquitectura de confianza
Los quality gates implementan el principio: "confiá pero verificá".
El agente puede codear autónomamente PORQUE los gates lo verifican.

## Secret scanning
- Pre-commit hook + scan_secrets.py
- Detecta: tokens ML, JWT, AWS keys, passwords, private keys
- Exit code 1 bloquea el commit
- GitHub Action como segunda línea de defensa

## Trade-offs
- Gates lentos → el agente tarda más
- Gates estrictos → menos falsos negativos pero más friccción
- Gates en CI → cubren commits desde cualquier origen

## Desafío
🧪 Diseñá un quality gate para un caso no cubierto. Ej: ¿cómo verificarías que una migración de base de datos es reversible?`
    },

    "lifecycle": {
      principiante: `# El Ciclo de Vida de un Proyecto

## Analogía
Pensá en construir una casa:
1. 📋 **Kickoff** — Reunión con el cliente: ¿qué querés? ¿cuántas habitaciones?
2. 🔨 **Build** — Construir habitación por habitación
3. 🔍 **QA** — Inspección: ¿las puertas cierran? ¿hay goteras?
4. 📊 **Review** — ¿Cumplimos lo prometido? ¿Qué aprendimos?
5. 📖 **Manual** — Guía para el cliente: "así se usa la calefacción"
6. 📦 **Deliver** — Entrega de llaves + capacitación
7. 🚀 **Deploy** — Mudanza: el cliente se muda
8. 📝 **Wrap-up** — Registrar lecciones para la próxima casa

## En STACKOS
\`\`\`
/kickoff → /build-feature (×N) → /QA → /cycle-review
                                          │
                                          ▼
                               /manual → /deliver → /deploy → /wrap-up
\`\`\`

Cada paso es un **skill** que el agente ejecuta. El humano aprueba en checkpoints.

## Verificación
🤔 ¿Por qué crees que /wrap-up va AL FINAL y no antes de /deploy?`,

      intermedio: `# Lifecycle — Profundizando

## Los 10 pasos de /build-feature (el core)
1. Leer spec
2. Clarify (resolver ambigüedades)
3. Analizar código existente
4. Generar plan
5. Implementar task por task
6. Tests
7. Auto-QA (spec vs código)
8. Wrap-up automático
9. Commit
10. Checkpoint

## Paralelismo
Features independientes se pueden implementar en paralelo:
\`\`\`
Terminal 1: /build-feature auth
Terminal 2: /build-feature dashboard
\`\`\`

## Verificación
🤔 ¿En qué paso el agente escala al humano? ¿Por qué no antes?`,

      avanzado: `# Lifecycle — Arquitectura y extensión

## Composición de skills
Los skills no son lineales — son componibles:
- /loop puede ejecutar un plan completo sin intervención
- /build-feature puede llamarse N veces en un ciclo
- /n8n-dev puede intercalarse donde se necesite

## Métricas del ciclo
| Métrica | Qué mide |
|---------|----------|
| Lead time | Horas desde spec hasta done |
| First-pass rate | % gates verdes en intento 1 |
| Rework | Tareas reabiertas |
| Spec drift | Puntos no cubiertos |
| Human takeover | BLOCKERs / total tareas |

## Desafío
🧪 ¿Cómo adaptarías el lifecycle para un proyecto que no es ERP? (Ej: una librería open-source, un data pipeline)`
    },
  };

  // Buscar concepto
  const found = conceptos[key];
  if (found) {
    return found[nivel] || found["principiante"];
  }

  // Si no hay concepto predefinido, devolver guía genérica
  return `# Concepto: ${concepto}

No tengo una explicación pedagógica predefinida para "${concepto}".

## Sugerencias
1. Usá **buscar_conocimiento** con query "${concepto}" para encontrar información en la KB
2. Usá **leer_metodologia** con "sdd-stackos" para buscar si se menciona
3. Usá **listar_skills** para ver si hay un skill relacionado

## Conceptos disponibles con explicación pedagógica
Los siguientes conceptos tienen explicaciones preparadas por nivel:
- **spec** — Especificaciones y OpenSpec v2
- **skill** — Skills y automatizaciones
- **engram** — Sistema de memoria persistente
- **quality-gate** — Quality gates y gobernanza
- **lifecycle** — Ciclo de vida de un proyecto

Usá: \`explicar_concepto\` con alguno de estos.`;
}
