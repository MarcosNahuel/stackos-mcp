import { join } from "path";
import { grepFiles, type GrepResult } from "../utils/grep.js";

type Area =
  | "evaluations"
  | "knowledge"
  | "topics"
  | "standards"
  | "skills"
  | "all";

const AREA_PATHS: Record<Exclude<Area, "all">, string> = {
  evaluations: "content/evaluations",
  knowledge: "knowledge",
  topics: "content/topics",
  standards: "standards",
  skills: ".claude/skills",
};

export const buscarConocimientoDef = {
  name: "buscar_conocimiento",
  description:
    "Busca texto en toda la knowledge base o en un área específica. Grep case-insensitive con contexto. Útil para encontrar información sobre cualquier tema documentado.",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "Texto a buscar (case-insensitive)",
      },
      area: {
        type: "string",
        enum: ["evaluations", "knowledge", "topics", "standards", "skills", "all"],
        description:
          'Área donde buscar. Si no se especifica, busca en todo. Opciones: evaluations, knowledge, topics, standards, skills, all',
      },
    },
    required: ["query"],
  },
};

export function buscarConocimiento(
  root: string,
  query: string,
  area?: string
): GrepResult[] {
  const selectedArea = (area || "all") as Area;

  if (selectedArea === "all") {
    return grepFiles(root, query, { maxResults: 10, contextLines: 3 });
  }

  const subPath = AREA_PATHS[selectedArea];
  if (!subPath) {
    throw new Error(
      `Área no válida: "${area}". Opciones: evaluations, knowledge, topics, standards, skills, all`
    );
  }

  return grepFiles(join(root, subPath), query, {
    maxResults: 10,
    contextLines: 3,
  });
}
