/**
 * Extrae campos de un archivo de evaluación markdown.
 * Busca: **Clasificacion:**, **Promedio ponderado:**, ## Veredicto
 */
export interface EvaluacionData {
  titulo: string;
  clasificacion: string;
  promedio: string;
  veredicto: string;
}

export function parseEvaluacion(
  content: string,
  filename: string
): EvaluacionData {
  // Título: primera línea que empieza con #
  const tituloMatch = content.match(/^#\s+(.+)$/m);
  const titulo = tituloMatch ? tituloMatch[1].trim() : filename;

  // Clasificación
  const clasMatch = content.match(
    /\*\*Clasificacion:\*\*\s*(.+?)(?:\n|$)/i
  );
  const clasificacion = clasMatch ? clasMatch[1].trim() : "Sin clasificar";

  // Promedio ponderado
  const promedioMatch = content.match(
    /\*\*Promedio ponderado:\*\*\s*(.+?)(?:\n|$)/i
  );
  const promedio = promedioMatch ? promedioMatch[1].trim() : "N/A";

  // Veredicto: contenido de la sección ## Veredicto
  const veredictoMatch = content.match(
    /##\s*Veredicto\s*\n([\s\S]*?)(?=\n##\s|\n---|\Z)/i
  );
  const veredicto = veredictoMatch
    ? veredictoMatch[1].trim()
    : "Sin veredicto";

  return { titulo, clasificacion, promedio, veredicto };
}
