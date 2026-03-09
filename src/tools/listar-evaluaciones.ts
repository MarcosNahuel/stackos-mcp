import { readFileSync } from "fs";
import { join } from "path";

export interface EvaluacionEntry {
  id: string;
  title: string;
  classification: string;
  tags: string[];
}

export const listarEvaluacionesDef = {
  name: "listar_evaluaciones",
  description:
    "Lista todas las evaluaciones del Tech Radar con su clasificación (ADOPT/TRIAL/ASSESS/HOLD/DROP). Útil para saber qué herramientas están evaluadas.",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
};

export function listarEvaluaciones(root: string): EvaluacionEntry[] {
  const indexPath = join(root, "content", "index.json");

  let content: string;
  try {
    content = readFileSync(indexPath, "utf-8");
  } catch {
    throw new Error(
      `No se encontró el índice: ${indexPath}. Verificá que STACKOS_ROOT sea correcto.`
    );
  }

  const index = JSON.parse(content) as {
    evaluations?: Array<{
      id: string;
      title: string;
      classification: string;
      tags?: string[];
    }>;
  };

  if (!index.evaluations || !Array.isArray(index.evaluations)) {
    return [];
  }

  return index.evaluations.map((ev) => ({
    id: ev.id,
    title: ev.title,
    classification: ev.classification,
    tags: ev.tags || [],
  }));
}
