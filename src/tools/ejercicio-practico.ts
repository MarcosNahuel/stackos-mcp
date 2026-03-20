/**
 * Genera ejercicios prácticos según tema y nivel.
 * Los ejercicios son progresivos y contextualizados.
 */
export function ejercicioPractico(
  tema: string,
  nivel: "principiante" | "intermedio" | "avanzado"
): string {
  const key = tema.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const ejercicios: Record<string, Record<string, string>> = {
    "spec": {
      principiante: `# Ejercicio: Tu primera spec

## Contexto
Vas a escribir la spec de una feature simple: un **botón de "Agregar al carrito"** en una tienda online.

## Instrucciones
1. Escribí una sección **Propósito** (2-3 líneas): ¿qué hace este botón?
2. Escribí una sección **Alcance**:
   - **Include**: qué SÍ hace (mínimo 3 puntos)
   - **NOT include**: qué NO hace (mínimo 2 puntos)
3. Escribí 3 **Acceptance Criteria** como checklist

## Ejemplo de formato
\`\`\`markdown
## Propósito
[Tu texto aquí]

## Alcance
- INCLUDE: [punto 1], [punto 2], [punto 3]
- NOT INCLUDE: [punto 1], [punto 2]

## Acceptance Criteria
- [ ] [Criterio 1]
- [ ] [Criterio 2]
- [ ] [Criterio 3]
\`\`\`

## Criterios de evaluación
- ✅ El propósito es claro en 1 lectura
- ✅ Include y NOT include no se contradicen
- ✅ Los acceptance criteria son verificables (no subjetivos)

Cuando termines, usá \`evaluar_respuesta\` para que evalúe tu trabajo.`,

      intermedio: `# Ejercicio: Spec completa OpenSpec v2

## Contexto
Escribí la spec completa de: **Sincronización automática de stock entre la base de datos local y Mercado Libre.**

## Requisitos
Debe incluir las 6 secciones obligatorias de OpenSpec v2:
1. **Propósito** — Qué y por qué
2. **Alcance** — Include / NOT include
3. **Acceptance Criteria** — Checklist verificable
4. **Boundaries** — ALWAYS / ASK FIRST / NEVER
5. **Seguridad** — ¿Qué tokens se necesitan? ¿Dónde se guardan?
6. **Plan de pruebas** — Comandos exactos para verificar

## Bonus
- Agregá una sección de **Variaciones** (¿qué cambia por cliente?)
- Pensá en los edge cases: ¿qué pasa si ML está caído? ¿Y si el stock local es negativo?

## Criterios de evaluación
- ✅ Las 6 secciones presentes
- ✅ Boundaries tiene al menos 1 NEVER
- ✅ Plan de pruebas tiene comandos ejecutables
- ✅ Los edge cases están cubiertos`,

      avanzado: `# Ejercicio: Spec con Clarify

## Contexto
Acá hay una spec incompleta. Tu trabajo es:
1. Identificar las ambigüedades
2. Escribir las preguntas de Clarify (máximo 5)
3. Completar la spec con las respuestas que vos decidás

## Spec incompleta
\`\`\`markdown
# Sync de órdenes ML → Dashboard

## Propósito
Mostrar las órdenes de Mercado Libre en el dashboard del cliente.

## Alcance
- Traer las órdenes nuevas
- Mostrarlas en una tabla

## Acceptance Criteria
- [ ] Las órdenes se ven en el dashboard
\`\`\`

## Tu tarea
1. ¿Qué ambigüedades encontrás? (mínimo 3)
2. Para cada una, escribí la pregunta + opciones
3. Elegí una opción y completá la spec

## Criterios de evaluación
- ✅ Identificaste al menos 3 ambigüedades reales
- ✅ Las preguntas son concretas (no genéricas)
- ✅ La spec completada cubre los 6 campos de OpenSpec v2`
    },

    "skill": {
      principiante: `# Ejercicio: Leé y resumí un skill

## Instrucciones
1. Usá \`leer_skill "wrap-up"\` para leer el skill completo
2. Respondé estas preguntas:
   - ¿Cuándo se activa este skill? (trigger)
   - ¿Cuántos pasos tiene?
   - ¿Qué herramientas usa?
   - ¿Qué hace con Engram?
3. Explicá en tus palabras: ¿por qué existe este skill?

## Criterios
- ✅ Las 4 preguntas respondidas correctamente
- ✅ La explicación muestra comprensión (no copia textual)`,

      intermedio: `# Ejercicio: Comparar dos skills

## Instrucciones
1. Leé \`leer_skill "build-feature"\` y \`leer_skill "loop"\`
2. Respondé:
   - ¿Cuál es la diferencia principal entre los dos?
   - ¿Cuándo usarías uno vs el otro?
   - ¿Cómo maneja cada uno los errores?
   - ¿Cuál usa más Engram? ¿Por qué?
3. Dibujá (en texto) el flujo de decisión: "¿Cuándo uso /build-feature vs /loop?"

## Criterios
- ✅ Diferencias correctas identificadas
- ✅ Flujo de decisión lógico y completo`,

      avanzado: `# Ejercicio: Diseñá un skill nuevo

## Contexto
Diseñá un skill llamado \`/code-review\` que revise código automáticamente.

## Requisitos del diseño
1. **Frontmatter**: name, description, tools
2. **Trigger**: ¿qué palabras lo activan?
3. **Pasos** (mínimo 5):
   - ¿Qué lee?
   - ¿Qué analiza?
   - ¿Qué reporta?
   - ¿Cómo maneja errores?
4. **Integración con Engram**: ¿qué guarda? ¿qué busca?
5. **Reglas específicas** (mínimo 3)
6. **Output esperado**: ¿qué formato tiene el reporte?

## Criterios
- ✅ Sigue la estructura de un SKILL.md real
- ✅ Los pasos son atómicos y secuenciales
- ✅ Tiene bucle de control de errores (max 3 reintentos)
- ✅ Engram integrado (buscar al inicio, guardar al final)
- ✅ Las reglas no repiten las universales`
    },

    "engram": {
      principiante: `# Ejercicio: Tu primera memoria

## Instrucciones
Imaginá que acabás de descubrir que la API de Google Maps tiene un límite de 25,000 requests gratuitos por día.

Escribí una memoria con el formato obligatorio:
\`\`\`
**What:** [qué descubriste]
**Why:** [por qué importa]
**Where:** [dónde aplica]
**Learned:** [la lección reutilizable]
\`\`\`

## Criterios
- ✅ What es concreto (no genérico)
- ✅ Why explica el impacto (no repite What)
- ✅ Where es específico (no "en todos lados")
- ✅ Learned es accionable (se puede aplicar directamente)`,

      intermedio: `# Ejercicio: Consolidación de memorias

## Contexto
Tenés estas 3 memorias sobre el mismo tema:

**Memoria 1** (hace 3 meses):
\`What: Supabase RLS bloquea queries sin auth\`

**Memoria 2** (hace 1 mes):
\`What: Supabase RLS funciona con service_role key\`

**Memoria 3** (hace 1 semana):
\`What: Supabase RLS v2 permite policies por columna\`

## Tu tarea
1. ¿Cuál es obsoleta? ¿Cuál está vigente?
2. Escribí 1 memoria consolidada que reemplace las 3
3. ¿Qué status le pondrías a cada una de las originales?

## Criterios
- ✅ Identificaste correctamente cuál es obsoleta
- ✅ La memoria consolidada cubre toda la info relevante
- ✅ Los status están bien asignados (active/superseded/obsolete)`,

      avanzado: `# Ejercicio: Diseñá un sistema de freshness

## Contexto
Las memorias se vuelven obsoletas con el tiempo. ¿Cómo lo manejamos?

## Tu tarea
Diseñá un sistema que:
1. Detecte memorias potencialmente obsoletas (¿qué criterios?)
2. Proponga acciones (verificar, archivar, consolidar)
3. Sea ejecutable como script o skill

## Preguntas guía
- ¿Cada cuánto tiempo debería correr?
- ¿Qué indica que una memoria es "vieja"? (¿solo la fecha?)
- ¿Cómo distinguís entre "vieja pero válida" y "obsoleta"?
- ¿El proceso debería ser automático o requiere confirmación humana?

## Criterios
- ✅ Los criterios de obsolescencia son concretos
- ✅ El sistema tiene al menos 3 señales de obsolescencia
- ✅ Distingue entre "archivar" y "eliminar"
- ✅ Incluye confirmación humana para acciones destructivas`
    },

    "quality-gate": {
      principiante: `# Ejercicio: Identificá el gate

## Instrucciones
Para cada situación, decí qué quality gate debería ejecutarse:

1. Acabás de escribir una nueva función en TypeScript
2. Estás por hacer git commit
3. Terminaste de implementar toda una feature
4. Vas a hacer deploy a producción

## Opciones de gates
A. \`npx tsc --noEmit\` (typecheck)
B. \`npm run lint\` (lint)
C. \`npm test\` (tests)
D. \`npm run build\` (build completo)
E. Secret scanning
F. Auto-QA (spec vs código)

## Criterios
- ✅ Cada situación tiene al menos 1 gate correcto
- ✅ Podés explicar POR QUÉ ese gate en esa situación`,

      intermedio: `# Ejercicio: Configurá gates para un proyecto

## Contexto
Tenés un proyecto Next.js con Supabase. Diseñá los quality gates.

## Tu tarea
1. ¿Qué comandos van en cada nivel de gate?
   - Gate 0 (antes de empezar)
   - Gate por tarea
   - Gate final
   - Gate de seguridad
2. ¿Dónde se configuran? (hooks, CI, etc.)
3. ¿Qué pasa si un gate falla en CI pero pasó localmente?

## Criterios
- ✅ Los 4 niveles tienen comandos concretos
- ✅ Explica dónde se configuran
- ✅ Aborda la discrepancia local/CI`,

      avanzado: `# Ejercicio: Gate personalizado

## Tu tarea
Diseñá un quality gate que no existe en STACKOS:
**Gate de performance** — verifica que la app no se degradó.

## Preguntas guía
- ¿Qué métricas medís? (Lighthouse, Web Vitals, bundle size...)
- ¿Cuáles son los umbrales? (LCP < 2.5s, bundle < 500KB...)
- ¿Dónde se ejecuta? (local, CI, post-deploy)
- ¿Es bloqueante o solo reporta?
- ¿Cómo evitás falsos positivos?

## Criterios
- ✅ Métricas concretas con umbrales
- ✅ Decisión fundamentada de bloqueante vs reporte
- ✅ Manejo de falsos positivos`
    },
  };

  const found = ejercicios[key];
  if (found) {
    return found[nivel] || found["principiante"];
  }

  return `# Ejercicio práctico: ${tema}

No tengo ejercicios predefinidos para "${tema}".

## Temas con ejercicios disponibles
- **spec** — Escribir specs, completar specs, identificar ambigüedades
- **skill** — Leer skills, comparar, diseñar uno nuevo
- **engram** — Escribir memorias, consolidar, diseñar freshness
- **quality-gate** — Identificar gates, configurar, diseñar gates nuevos

## Alternativa
Podés pedirme que genere un ejercicio sobre "${tema}" y te armo uno personalizado basado en la knowledge base de STACKOS.`;
}
