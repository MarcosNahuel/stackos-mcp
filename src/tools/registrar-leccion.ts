import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

export const registrarLeccionDef = {
  name: "registrar_leccion",
  description:
    "Registra una lección aprendida desde cualquier sesión de trabajo. Se guarda en sessions/ con fecha y categoría. Append-only, nunca borra contenido.",
  inputSchema: {
    type: "object" as const,
    properties: {
      proyecto: {
        type: "string",
        description: "Nombre del proyecto (ej: traid-landing, erp-dashboard)",
      },
      leccion: {
        type: "string",
        description: "La lección aprendida a registrar",
      },
      categoria: {
        type: "string",
        enum: ["pattern", "gotcha", "decision"],
        description:
          "Tipo de lección: pattern (patrón reutilizable), gotcha (trampa a evitar), decision (decisión arquitectural)",
      },
    },
    required: ["proyecto", "leccion"],
  },
};

export function registrarLeccion(
  root: string,
  proyecto: string,
  leccion: string,
  categoria?: string
): { path: string; mensaje: string } {
  // Sanitizar nombre de proyecto
  const safeName = proyecto
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-");

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().slice(0, 5);
  const cat = categoria || "pattern";

  const sessionsDir = join(root, "sessions");
  if (!existsSync(sessionsDir)) {
    mkdirSync(sessionsDir, { recursive: true });
  }

  const filename = `${dateStr}-${safeName}.md`;
  const filePath = join(sessionsDir, filename);

  const entry = `\n## [${timeStr}] — ${cat}\n\n${leccion}\n`;

  // Si el archivo no existe, agregar header
  if (!existsSync(filePath)) {
    const header = `# Sesión: ${proyecto}\n**Fecha:** ${dateStr}\n`;
    appendFileSync(filePath, header + entry, "utf-8");
  } else {
    appendFileSync(filePath, entry, "utf-8");
  }

  return {
    path: `sessions/${filename}`,
    mensaje: `Lección registrada en ${filename} como ${cat}`,
  };
}
