import { readFileSync } from "fs";
import { join } from "path";

interface ResourceDef {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  relativePath: string;
}

const RESOURCES: ResourceDef[] = [
  {
    uri: "stackos://institucional/traid",
    name: "TRAID Agency",
    description:
      "Marca, stack tecnológico, propuesta de valor y branding de TRAID Agency",
    mimeType: "text/markdown",
    relativePath: "knowledge/institucional/TRAID.md",
  },
  {
    uri: "stackos://institucional/nahuel",
    name: "Nahuel Albornoz",
    description: "Perfil del co-founder: roles, stack, diferenciador",
    mimeType: "text/markdown",
    relativePath: "knowledge/institucional/NAHUEL.md",
  },
  {
    uri: "stackos://contexto-global",
    name: "Contexto Global",
    description:
      "Resumen ejecutivo de toda la knowledge base — topics, evaluaciones, conocimiento institucional",
    mimeType: "text/markdown",
    relativePath: "contexto-global.md",
  },
  {
    uri: "stackos://standards/investigacion",
    name: "Standard: Investigación",
    description:
      "Cómo investigar un tema, jerarquía de fuentes, metodología",
    mimeType: "text/markdown",
    relativePath: "standards/investigacion.md",
  },
  {
    uri: "stackos://standards/citacion",
    name: "Standard: Citación",
    description: "Formato de citas y referencias [N]",
    mimeType: "text/markdown",
    relativePath: "standards/citacion.md",
  },
  {
    uri: "stackos://standards/evaluacion",
    name: "Standard: Evaluación",
    description:
      "Criterios del Tech Radar: ponderación, puntuación, clasificación ADOPT/HOLD/DROP",
    mimeType: "text/markdown",
    relativePath: "standards/evaluacion.md",
  },
  {
    uri: "stackos://standards/checklist",
    name: "Standard: Checklist",
    description: "Verificación pre-publicación de contenido",
    mimeType: "text/markdown",
    relativePath: "standards/checklist.md",
  },
  {
    uri: "stackos://indice",
    name: "Índice de contenido",
    description:
      "Índice JSON con todos los topics y evaluaciones registrados",
    mimeType: "application/json",
    relativePath: "content/index.json",
  },
];

export function getResourceDefinitions(): Array<{
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}> {
  return RESOURCES.map(({ uri, name, description, mimeType }) => ({
    uri,
    name,
    description,
    mimeType,
  }));
}

export function readResource(
  root: string,
  uri: string
): { contents: Array<{ uri: string; mimeType: string; text: string }> } {
  const resource = RESOURCES.find((r) => r.uri === uri);
  if (!resource) {
    throw new Error(
      `Resource no encontrado: ${uri}. Disponibles: ${RESOURCES.map((r) => r.uri).join(", ")}`
    );
  }

  const filePath = join(root, resource.relativePath);
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    throw new Error(
      `Archivo no encontrado: ${resource.relativePath}. Verificá que STACKOS_ROOT sea correcto.`
    );
  }

  return {
    contents: [
      {
        uri: resource.uri,
        mimeType: resource.mimeType,
        text: content,
      },
    ],
  };
}
