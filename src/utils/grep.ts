import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

export interface GrepResult {
  archivo: string;
  linea: number;
  contexto: string;
}

/**
 * Busca recursivamente en archivos .md y .json dentro de un directorio.
 * Devuelve hasta maxResults coincidencias con contextLines líneas de contexto.
 */
export function grepFiles(
  rootDir: string,
  query: string,
  options: {
    maxResults?: number;
    contextLines?: number;
    extensions?: string[];
  } = {}
): GrepResult[] {
  const {
    maxResults = 10,
    contextLines = 3,
    extensions = [".md", ".json"],
  } = options;

  const results: GrepResult[] = [];
  const regex = new RegExp(query, "i");
  const files = listFilesRecursive(rootDir, extensions);

  for (const filePath of files) {
    if (results.length >= maxResults) break;

    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      if (results.length >= maxResults) break;
      if (!regex.test(lines[i])) continue;

      const start = Math.max(0, i - contextLines);
      const end = Math.min(lines.length - 1, i + contextLines);
      const contextSlice = lines.slice(start, end + 1).join("\n");

      results.push({
        archivo: relative(rootDir, filePath).replace(/\\/g, "/"),
        linea: i + 1,
        contexto: contextSlice,
      });
    }
  }

  return results;
}

function listFilesRecursive(dir: string, extensions: string[]): string[] {
  const files: string[] = [];

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }

  for (const entry of entries) {
    // Saltar directorios ocultos y node_modules
    if (entry.startsWith(".") || entry === "node_modules") continue;

    const fullPath = join(dir, entry);

    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      files.push(...listFilesRecursive(fullPath, extensions));
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}
