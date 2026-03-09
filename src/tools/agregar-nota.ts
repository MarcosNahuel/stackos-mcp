import { appendFileSync, existsSync } from "fs";
import { join } from "path";

export const agregarNotaDef = {
  name: "agregar_nota_conocimiento",
  description:
    "Agrega una nota a un archivo de knowledge existente. Append-only, nunca borra contenido ni crea archivos nuevos.",
  inputSchema: {
    type: "object" as const,
    properties: {
      area: {
        type: "string",
        description:
          'Ruta dentro de knowledge/ (ej: "platforms/vercel", "institucional")',
      },
      archivo: {
        type: "string",
        description:
          'Nombre del archivo sin extensión (ej: "deployment", "TRAID")',
      },
      nota: {
        type: "string",
        description: "Contenido de la nota a agregar",
      },
    },
    required: ["area", "archivo", "nota"],
  },
};

export function agregarNota(
  root: string,
  area: string,
  archivo: string,
  nota: string
): { path: string; mensaje: string } {
  // Sanitización: no permitir path traversal
  if (area.includes("..") || archivo.includes("..")) {
    throw new Error("No se permiten rutas con '..' por seguridad.");
  }
  if (area.startsWith("/") || archivo.startsWith("/")) {
    throw new Error("No se permiten rutas absolutas.");
  }

  const filePath = join(root, "knowledge", area, `${archivo}.md`);

  if (!existsSync(filePath)) {
    throw new Error(
      `Archivo no encontrado: knowledge/${area}/${archivo}.md. Esta herramienta solo agrega notas a archivos existentes.`
    );
  }

  const dateStr = new Date().toISOString().split("T")[0];
  const entry = `\n\n> **Nota (${dateStr}):** ${nota}\n`;

  appendFileSync(filePath, entry, "utf-8");

  return {
    path: `knowledge/${area}/${archivo}.md`,
    mensaje: `Nota agregada a knowledge/${area}/${archivo}.md`,
  };
}
