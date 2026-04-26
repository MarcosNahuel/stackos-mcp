import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getStackosRoot } from "./config.js";
import { startTransport } from "./transport.js";

// Tools de lectura
import { buscarEvaluacion } from "./tools/buscar-evaluacion.js";
import { buscarConocimiento } from "./tools/buscar-conocimiento.js";
import { listarSkills } from "./tools/listar-skills.js";
import { listarEvaluaciones } from "./tools/listar-evaluaciones.js";
import { leerStandard } from "./tools/leer-standard.js";
import { obtenerContextoGlobal } from "./tools/obtener-contexto-global.js";

// Tools de skills y metodología
import { leerSkill } from "./tools/leer-skill.js";
import { leerMetodologia } from "./tools/leer-metodologia.js";
import { guiaAprendizaje } from "./tools/guia-aprendizaje.js";

// Tools pedagógicos
import { modoTutor } from "./tools/modo-tutor.js";
import { explicarConcepto } from "./tools/explicar-concepto.js";
import { ejercicioPractico } from "./tools/ejercicio-practico.js";
import { evaluarRespuesta } from "./tools/evaluar-respuesta.js";
import { registrarProgreso, verProgreso } from "./tools/progreso-alumno.js";

// Tools de escritura
import { registrarLeccion } from "./tools/registrar-leccion.js";
import { agregarNota } from "./tools/agregar-nota.js";
import { proponerEvaluacion } from "./tools/proponer-evaluacion.js";

// Tools del sistema "yo" (copiloto operativo)
import { yoListTasks } from "./tools/yo-list-tasks.js";
import { yoAddTask } from "./tools/yo-add-task.js";
import { yoCloseTask } from "./tools/yo-close-task.js";

// Resources
import { getResourceDefinitions, readResource } from "./resources/resolver.js";

async function main(): Promise<void> {
  const root = getStackosRoot();

  const server = new McpServer({
    name: "stackos",
    version: "1.0.0",
  });

  // --- Tools de lectura ---

  server.tool(
    "buscar_evaluacion",
    "Busca la evaluación Tech Radar de una herramienta específica. Devuelve clasificación (ADOPT/TRIAL/ASSESS/HOLD/DROP), promedio ponderado y veredicto.",
    {
      herramienta: z
        .string()
        .describe('Nombre de la herramienta a buscar (ej: "Next.js", "Tailwind", "Recharts")'),
    },
    async ({ herramienta }) => {
      try {
        const result = buscarEvaluacion(root, herramienta);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "buscar_conocimiento",
    "Busca texto en toda la knowledge base o en un área específica. Grep case-insensitive con contexto. Útil para encontrar información sobre cualquier tema documentado.",
    {
      query: z.string().describe("Texto a buscar (case-insensitive)"),
      area: z
        .enum(["evaluations", "knowledge", "topics", "standards", "skills", "all"])
        .optional()
        .describe("Área donde buscar. Si no se especifica, busca en todo."),
    },
    async ({ query, area }) => {
      try {
        const results = buscarConocimiento(root, query, area);
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "listar_skills",
    "Lista todos los skills y metodologías disponibles en STACKOS. Cada skill es una automatización que puede ejecutarse con Claude Code.",
    {},
    async () => {
      try {
        const results = listarSkills(root);
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "listar_evaluaciones",
    "Lista todas las evaluaciones del Tech Radar con su clasificación (ADOPT/TRIAL/ASSESS/HOLD/DROP). Útil para saber qué herramientas están evaluadas.",
    {},
    async () => {
      try {
        const results = listarEvaluaciones(root);
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "leer_standard",
    "Lee un standard de calidad completo. Disponibles: investigacion, citacion, evaluacion, checklist.",
    {
      nombre: z
        .enum(["investigacion", "citacion", "evaluacion", "checklist"])
        .describe("Nombre del standard a leer"),
    },
    async ({ nombre }) => {
      try {
        const content = leerStandard(root, nombre);
        return { content: [{ type: "text", text: content }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "obtener_contexto_global",
    "Devuelve el resumen ejecutivo de toda la knowledge base de STACKOS. Ideal como primer paso para entender qué hay disponible.",
    {},
    async () => {
      try {
        const content = obtenerContextoGlobal(root);
        return { content: [{ type: "text", text: content }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  // --- Tools de skills y metodología ---

  server.tool(
    "leer_skill",
    "Lee el contenido completo de un skill específico (su workflow, pasos, reglas y configuración). Usá listar_skills primero para ver cuáles hay.",
    {
      nombre: z
        .string()
        .describe('Nombre del skill (ej: "build-feature", "wrap-up", "investigar", "deploy")'),
    },
    async ({ nombre }) => {
      try {
        const content = leerSkill(root, nombre);
        return { content: [{ type: "text", text: content }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "leer_metodologia",
    "Lee documentos clave de la metodología SDD-STACKOS: la metodología completa, las reglas universales, o el estándar de uso de memoria (Engram).",
    {
      documento: z
        .enum(["sdd-stackos", "reglas-universales", "engram-usage"])
        .describe("sdd-stackos = metodología completa | reglas-universales = 17 reglas que aplican siempre | engram-usage = cómo usar el sistema de memoria"),
    },
    async ({ documento }) => {
      try {
        const content = leerMetodologia(root, documento);
        return { content: [{ type: "text", text: content }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "guia_aprendizaje",
    "Genera una guía de aprendizaje estructurada para alumnos nuevos. 3 niveles: principiante (conceptos + primeros pasos), intermedio (ciclo de desarrollo + Engram), avanzado (crear skills + arquitectura).",
    {
      nivel: z
        .enum(["principiante", "intermedio", "avanzado"])
        .describe("principiante = conceptos básicos | intermedio = ciclo completo | avanzado = extender el sistema"),
    },
    async ({ nivel }) => {
      try {
        const content = guiaAprendizaje(root, nivel);
        return { content: [{ type: "text", text: content }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  // --- Tools pedagógicos ---

  server.tool(
    "modo_tutor",
    "LLAMAR AL INICIO DE CADA SESIÓN DE ENSEÑANZA. Devuelve instrucciones pedagógicas que transforman al agente en un tutor de STACKOS. El agente debe seguir estas instrucciones durante toda la conversación.",
    {
      idioma: z
        .enum(["es", "en"])
        .default("es")
        .describe("Idioma de las instrucciones: es (español) o en (inglés)"),
    },
    async ({ idioma }) => {
      try {
        const content = modoTutor(idioma);
        return { content: [{ type: "text", text: content }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "explicar_concepto",
    "Explica un concepto de STACKOS de forma pedagógica con: contexto, analogía, concepto, ejemplo y pregunta de verificación. Adaptado al nivel del alumno. Conceptos: spec, skill, engram, quality-gate, lifecycle.",
    {
      concepto: z
        .string()
        .describe('Concepto a explicar: "spec", "skill", "engram", "quality-gate", "lifecycle"'),
      nivel: z
        .enum(["principiante", "intermedio", "avanzado"])
        .default("principiante")
        .describe("Nivel del alumno"),
    },
    async ({ concepto, nivel }) => {
      try {
        const content = explicarConcepto(concepto, nivel);
        return { content: [{ type: "text", text: content }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "ejercicio_practico",
    "Genera un ejercicio práctico sobre un tema de STACKOS, adaptado al nivel del alumno. Incluye instrucciones, criterios de evaluación y formato esperado. Temas: spec, skill, engram, quality-gate.",
    {
      tema: z
        .string()
        .describe('Tema del ejercicio: "spec", "skill", "engram", "quality-gate"'),
      nivel: z
        .enum(["principiante", "intermedio", "avanzado"])
        .default("principiante")
        .describe("Nivel del alumno"),
    },
    async ({ tema, nivel }) => {
      try {
        const content = ejercicioPractico(tema, nivel);
        return { content: [{ type: "text", text: content }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "evaluar_respuesta",
    "Evalúa la respuesta de un alumno a un ejercicio. Devuelve un framework de evaluación con feedback constructivo, nota, y siguiente paso recomendado.",
    {
      ejercicio: z.string().describe("Descripción del ejercicio que el alumno respondió"),
      respuesta: z.string().describe("La respuesta del alumno (texto completo)"),
      nivel: z
        .enum(["principiante", "intermedio", "avanzado"])
        .default("principiante")
        .describe("Nivel del alumno"),
    },
    async ({ ejercicio, respuesta, nivel }) => {
      try {
        const content = evaluarRespuesta(ejercicio, respuesta, nivel);
        return { content: [{ type: "text", text: content }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  // --- Tools de progreso del alumno ---

  server.tool(
    "registrar_progreso",
    "Registra el progreso de un alumno. USARLO SIEMPRE: después de explicar un concepto, después de evaluar un ejercicio, al inicio de sesión, o para anotar observaciones. El sistema sube de nivel automáticamente.",
    {
      alumno: z.string().describe("Nombre del alumno"),
      tema: z
        .string()
        .describe('Tema: "spec", "skill", "engram", "quality-gate", "lifecycle" o cualquier otro'),
      tipo: z
        .enum(["concepto_visto", "ejercicio_aprobado", "ejercicio_reprobado", "nota_tutor", "inicio_sesion"])
        .describe("concepto_visto = explicó un concepto | ejercicio_aprobado/reprobado = resultado de ejercicio | nota_tutor = observación del tutor | inicio_sesion = nueva sesión"),
      detalle: z
        .string()
        .describe('Qué se registra (ej: "analogía de la receta para spec", "entiende bien boundaries")'),
    },
    async ({ alumno, tema, tipo, detalle }) => {
      try {
        const result = registrarProgreso(root, alumno, tema, tipo, detalle);
        return { content: [{ type: "text", text: result }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "ver_progreso",
    "Muestra el progreso actual de un alumno: nivel por tema, ejercicios completados, notas del tutor y siguiente paso recomendado. USARLO AL INICIO DE CADA SESIÓN.",
    {
      alumno: z.string().describe("Nombre del alumno"),
    },
    async ({ alumno }) => {
      try {
        const result = verProgreso(root, alumno);
        return { content: [{ type: "text", text: result }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  // --- Tools de escritura ---

  server.tool(
    "registrar_leccion",
    "Registra una lección aprendida desde cualquier sesión de trabajo. Se guarda en sessions/ con fecha y categoría. Append-only.",
    {
      proyecto: z.string().describe("Nombre del proyecto (ej: traid-landing, erp-dashboard)"),
      leccion: z.string().describe("La lección aprendida a registrar"),
      categoria: z
        .enum(["pattern", "gotcha", "decision"])
        .optional()
        .describe("Tipo: pattern (reutilizable), gotcha (trampa a evitar), decision (arquitectural)"),
    },
    async ({ proyecto, leccion, categoria }) => {
      try {
        const result = registrarLeccion(root, proyecto, leccion, categoria);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "agregar_nota_conocimiento",
    "Agrega una nota a un archivo de knowledge existente. Append-only, nunca borra contenido ni crea archivos nuevos.",
    {
      area: z.string().describe('Ruta dentro de knowledge/ (ej: "platforms/vercel", "institucional")'),
      archivo: z.string().describe('Nombre del archivo sin extensión (ej: "deployment", "TRAID")'),
      nota: z.string().describe("Contenido de la nota a agregar"),
    },
    async ({ area, archivo, nota }) => {
      try {
        const result = agregarNota(root, area, archivo, nota);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "proponer_evaluacion",
    "Registra una propuesta de evaluación para una herramienta nueva. NO crea la evaluación completa — solo la propuesta.",
    {
      herramienta: z.string().describe("Nombre de la herramienta a evaluar"),
      motivo: z.string().describe("Por qué se propone evaluar esta herramienta"),
      contexto: z
        .string()
        .optional()
        .describe("Contexto adicional: proyecto, alternativas, etc."),
    },
    async ({ herramienta, motivo, contexto }) => {
      try {
        const result = proponerEvaluacion(root, herramienta, motivo, contexto);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  // --- Tools del sistema "yo" ---

  server.tool(
    "yo_list_tasks",
    "Lista tasks del sistema yo (copiloto operativo) con preview de content_md (200 chars) y age en segundos. Filtros opcionales: project, status, assigned_to. Order by created_at desc. Default limit=20.",
    {
      project: z
        .string()
        .optional()
        .describe("Filtrar por project_slug (ej: traid-landing, gov-mendoza)"),
      status: z
        .enum(["pending", "in_progress", "done", "cancelled", "blocked"])
        .optional()
        .describe("Filtrar por status"),
      assigned_to: z
        .string()
        .optional()
        .describe("Filtrar por asignado (ej: nahuel, claude)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe("Límite de resultados (1-200, default 20)"),
    },
    async ({ project, status, assigned_to, limit }) => {
      try {
        const result = await yoListTasks({ project, status, assigned_to, limit });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "yo_add_task",
    "Crea una task nueva en el sistema yo desde Claude Code. Source='claude', metadata.created_via='mcp_claude_code'. Retorna el task_id.",
    {
      project: z.string().describe("project_slug (ej: traid-landing, sistema-yo)"),
      content_md: z.string().describe("Contenido markdown de la task"),
      priority: z
        .enum(["low", "medium", "high", "urgent"])
        .optional()
        .describe("Prioridad (default medium)"),
      assigned_to: z
        .string()
        .optional()
        .describe("Asignado (ej: nahuel, claude). Default null."),
    },
    async ({ project, content_md, priority, assigned_to }) => {
      try {
        const result = await yoAddTask({ project, content_md, priority, assigned_to });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "yo_close_task",
    "Cierra una task del sistema yo: setea status=done, closed_at=NOW(). Si se pasa resolution, hace merge en metadata.resolution. Retorna {id, status, closed_at}.",
    {
      id: z.string().describe("UUID de la task a cerrar"),
      resolution: z
        .string()
        .optional()
        .describe("Texto opcional con la resolución/cómo se cerró. Se guarda en metadata.resolution."),
    },
    async ({ id, resolution }) => {
      try {
        const result = await yoCloseTask(id, resolution);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  // --- Resources ---

  const resourceDefs = getResourceDefinitions();
  for (const res of resourceDefs) {
    server.resource(res.uri, res.uri, async (uri) => {
      try {
        return readResource(root, uri.href);
      } catch (e) {
        return {
          contents: [
            { uri: uri.href, mimeType: "text/plain", text: `Error: ${(e as Error).message}` },
          ],
        };
      }
    });
  }

  // --- Iniciar transporte ---
  await startTransport(server);
}

main().catch((err) => {
  console.error("Error fatal al iniciar STACKOS MCP Server:", err);
  process.exit(1);
});
