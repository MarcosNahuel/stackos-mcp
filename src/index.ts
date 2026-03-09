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

// Tools de escritura
import { registrarLeccion } from "./tools/registrar-leccion.js";
import { agregarNota } from "./tools/agregar-nota.js";
import { proponerEvaluacion } from "./tools/proponer-evaluacion.js";

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
