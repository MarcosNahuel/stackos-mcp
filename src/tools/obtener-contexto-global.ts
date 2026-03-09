import { readFileSync, existsSync } from "fs";
import { join } from "path";

export const obtenerContextoGlobalDef = {
  name: "obtener_contexto_global",
  description:
    "Devuelve el resumen ejecutivo de toda la knowledge base de STACKOS. Incluye topics, evaluaciones y conocimiento institucional. Ideal como primer paso para entender qué hay disponible.",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
};

export function obtenerContextoGlobal(root: string): string {
  const contextoPath = join(root, "contexto-global.md");

  if (existsSync(contextoPath)) {
    return readFileSync(contextoPath, "utf-8");
  }

  // Fallback: generar resumen básico desde index.json
  const indexPath = join(root, "content", "index.json");
  if (!existsSync(indexPath)) {
    throw new Error(
      "No se encontró contexto-global.md ni content/index.json. Verificá STACKOS_ROOT."
    );
  }

  const index = JSON.parse(readFileSync(indexPath, "utf-8")) as {
    topics?: Array<{ id: string; title: string; category: string }>;
    evaluations?: Array<{ id: string; title: string; classification: string }>;
  };

  let resumen = "# STACKOS — Contexto Global (generado)\n\n";

  if (index.topics?.length) {
    resumen += "## Topics\n\n";
    for (const t of index.topics) {
      resumen += `- **${t.title}** (${t.category}) → content/topics/${t.id}/\n`;
    }
    resumen += "\n";
  }

  if (index.evaluations?.length) {
    resumen += "## Evaluaciones\n\n";
    for (const e of index.evaluations) {
      resumen += `- **${e.title}** → ${e.classification}\n`;
    }
  }

  return resumen;
}
