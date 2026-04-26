import { existsSync } from "fs";
import { readFile, stat } from "fs/promises";
import { posix } from "path";
import matter from "gray-matter";
import { safeJoin } from "../utils/yo-fs.js";

export interface YoLeerArchivoInput {
  path: string;
}

export interface YoLeerArchivoResult {
  path: string;
  content: string;
  frontmatter_parsed: Record<string, unknown> | null;
  size_bytes: number;
  modified_at: string;
}

/**
 * Allowlist de prefijos permitidos (relativos al root).
 * Cualquier path fuera de estos retorna error.
 */
const ALLOWED_PREFIXES = [
  "yo/",
  "content/",
  "knowledge/",
  "standards/",
  "brands/",
  "docs/",
  "plan/",
];

/**
 * Allowlist de archivos top-level permitidos.
 */
const ALLOWED_TOP_FILES = ["INDEX.md", "CLAUDE.md", "README.md"];

/**
 * Denylist explícito (extra defensa por si un día se agrega un prefijo).
 */
const DENIED_PATTERNS: RegExp[] = [
  /^memory\//,
  /^\.claude\/skills\//,
  /^\.claude\/projects\//,
  /^cockpit\//,
  /(^|\/)\.env(\.|$)/,
  /(^|\/)\.git(\/|$)/,
];

function isAllowed(relPath: string): boolean {
  // Normalizar separadores y resolver "..", "./" antes de chequear allowlist
  const slashed = relPath.replace(/\\/g, "/").replace(/^\.\//, "");
  const norm = posix.normalize(slashed);
  if (norm.startsWith("..") || norm.includes("../")) return false;
  if (DENIED_PATTERNS.some((re) => re.test(norm))) return false;
  if (ALLOWED_TOP_FILES.includes(norm)) return true;
  return ALLOWED_PREFIXES.some((p) => norm.startsWith(p));
}

/**
 * Lee un archivo de la knowledge base (CN), parseando frontmatter si es .md.
 *
 * Solo permite paths en allowlist (yo/, content/, knowledge/, standards/,
 * brands/, docs/, plan/, INDEX.md, CLAUDE.md, README.md). NO permite memory/,
 * .claude/skills/, cockpit/, .env*.
 */
export async function yoLeerArchivo(
  root: string,
  input: YoLeerArchivoInput
): Promise<YoLeerArchivoResult> {
  if (!input.path || !input.path.trim()) {
    throw new Error("path es obligatorio.");
  }

  if (!isAllowed(input.path)) {
    throw new Error(
      `Path "${input.path}" no permitido por allowlist. Prefijos válidos: ${ALLOWED_PREFIXES.join(", ")} | Top-level: ${ALLOWED_TOP_FILES.join(", ")}`
    );
  }

  const absPath = safeJoin(root, input.path);
  if (!existsSync(absPath)) {
    throw new Error(`Archivo no existe: ${input.path}`);
  }

  const [content, st] = await Promise.all([
    readFile(absPath, "utf8"),
    stat(absPath),
  ]);

  let frontmatter_parsed: Record<string, unknown> | null = null;
  if (input.path.endsWith(".md")) {
    try {
      const parsed = matter(content);
      frontmatter_parsed =
        Object.keys(parsed.data).length > 0
          ? (parsed.data as Record<string, unknown>)
          : null;
    } catch {
      frontmatter_parsed = null;
    }
  }

  return {
    path: input.path,
    content,
    frontmatter_parsed,
    size_bytes: st.size,
    modified_at: st.mtime.toISOString(),
  };
}
