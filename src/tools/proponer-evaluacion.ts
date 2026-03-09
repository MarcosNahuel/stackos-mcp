import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

export const proponerEvaluacionDef = {
  name: "proponer_evaluacion",
  description:
    "Registra una propuesta de evaluación para una herramienta nueva. NO crea la evaluación completa — solo la propuesta para que se ejecute con /evaluar después.",
  inputSchema: {
    type: "object" as const,
    properties: {
      herramienta: {
        type: "string",
        description: "Nombre de la herramienta a evaluar",
      },
      motivo: {
        type: "string",
        description: "Por qué se propone evaluar esta herramienta",
      },
      contexto: {
        type: "string",
        description:
          "Contexto adicional: en qué proyecto se usaría, alternativas consideradas, etc.",
      },
    },
    required: ["herramienta", "motivo"],
  },
};

export function proponerEvaluacion(
  root: string,
  herramienta: string,
  motivo: string,
  contexto?: string
): { path: string; mensaje: string } {
  const propuestasDir = join(root, "content", "evaluations", "_propuestas");
  if (!existsSync(propuestasDir)) {
    mkdirSync(propuestasDir, { recursive: true });
  }

  const slug = herramienta
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const filePath = join(propuestasDir, `${slug}.md`);
  const dateStr = new Date().toISOString().split("T")[0];

  let content = `# Propuesta de Evaluación: ${herramienta}\n\n`;
  content += `**Fecha:** ${dateStr}\n`;
  content += `**Estado:** Pendiente\n\n`;
  content += `## Motivo\n\n${motivo}\n`;

  if (contexto) {
    content += `\n## Contexto\n\n${contexto}\n`;
  }

  content += `\n---\n*Ejecutar con /evaluar ${herramienta} para crear la evaluación completa.*\n`;

  writeFileSync(filePath, content, "utf-8");

  return {
    path: `content/evaluations/_propuestas/${slug}.md`,
    mensaje: `Propuesta de evaluación creada para "${herramienta}". Ejecutá /evaluar ${herramienta} para completarla.`,
  };
}
