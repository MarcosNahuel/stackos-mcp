import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { parseEvaluacion } from "../utils/markdown-parser.js";
import { grepFiles } from "../utils/grep.js";

export const buscarEvaluacionDef = {
  name: "buscar_evaluacion",
  description:
    "Busca la evaluación Tech Radar de una herramienta específica. Devuelve clasificación (ADOPT/TRIAL/ASSESS/HOLD/DROP), promedio ponderado y veredicto.",
  inputSchema: {
    type: "object" as const,
    properties: {
      herramienta: {
        type: "string",
        description:
          'Nombre de la herramienta a buscar (ej: "Next.js", "Tailwind", "Recharts")',
      },
    },
    required: ["herramienta"],
  },
};

export function buscarEvaluacion(
  root: string,
  herramienta: string
): { titulo: string; clasificacion: string; promedio: string; veredicto: string; path: string } {
  const evalDir = join(root, "content", "evaluations");
  const query = herramienta.toLowerCase().replace(/[\s.]+/g, "");

  // Paso 1: buscar por nombre de archivo
  let files: string[];
  try {
    files = readdirSync(evalDir).filter(
      (f) => f.endsWith(".md") && !f.startsWith("_")
    );
  } catch {
    throw new Error(
      `No se encontró el directorio de evaluaciones: ${evalDir}`
    );
  }

  // Match por substring en filename
  let matchFile = files.find((f) => {
    const normalized = f.replace(".md", "").replace(/-/g, "").toLowerCase();
    return normalized.includes(query);
  });

  // Si no hay match por nombre, grep en contenido
  if (!matchFile) {
    const grepResults = grepFiles(evalDir, herramienta, {
      maxResults: 1,
      contextLines: 0,
      extensions: [".md"],
    });
    if (grepResults.length > 0) {
      const parts = grepResults[0].archivo.split("/");
      matchFile = parts[parts.length - 1];
    }
  }

  if (!matchFile) {
    throw new Error(
      `No se encontró evaluación para "${herramienta}". Evaluaciones disponibles: ${files.map((f) => f.replace(".md", "")).join(", ")}`
    );
  }

  const filePath = join(evalDir, matchFile);
  const content = readFileSync(filePath, "utf-8");
  const data = parseEvaluacion(content, matchFile.replace(".md", ""));

  return {
    ...data,
    path: `content/evaluations/${matchFile}`,
  };
}
