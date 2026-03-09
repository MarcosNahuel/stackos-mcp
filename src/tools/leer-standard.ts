import { readFileSync } from "fs";
import { join } from "path";

const VALID_STANDARDS = [
  "investigacion",
  "citacion",
  "evaluacion",
  "checklist",
] as const;

type StandardName = (typeof VALID_STANDARDS)[number];

export const leerStandardDef = {
  name: "leer_standard",
  description:
    "Lee un standard de calidad completo. Disponibles: investigacion (cómo investigar), citacion (formato de citas), evaluacion (criterios Tech Radar), checklist (verificación pre-publicación).",
  inputSchema: {
    type: "object" as const,
    properties: {
      nombre: {
        type: "string",
        enum: [...VALID_STANDARDS],
        description:
          "Nombre del standard: investigacion, citacion, evaluacion, checklist",
      },
    },
    required: ["nombre"],
  },
};

export function leerStandard(root: string, nombre: string): string {
  if (!VALID_STANDARDS.includes(nombre as StandardName)) {
    throw new Error(
      `Standard no válido: "${nombre}". Opciones: ${VALID_STANDARDS.join(", ")}`
    );
  }

  const filePath = join(root, "standards", `${nombre}.md`);

  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    throw new Error(
      `No se encontró el standard: ${filePath}`
    );
  }
}
