import { mkdir, readdir, readFile, stat, rename } from "fs/promises";
import { existsSync } from "fs";
import { dirname, join, resolve, relative, sep } from "path";
import { randomBytes, createHash } from "crypto";
import writeFileAtomic from "write-file-atomic";
import matter from "gray-matter";
import type {
  YoDraftFrontmatter,
  YoDraftInput,
} from "../schemas/yo-draft.schema.js";

export const YO_PATHS = {
  drafts: "yo/drafts",
  draftsFlagged: "yo/drafts/.flagged",
  global: "yo/global",
  projects: "yo/projects",
  imports: "yo/imports",
  audit: "yo/audit",
  archiveIntegrated: "yo/.archive/integrated",
  archiveDiscarded: "yo/.archive/discarded",
  locks: "yo/.locks",
} as const;

/**
 * Convierte un título humano a un slug seguro para filesystem.
 * Mantiene letras y dígitos, reemplaza el resto por `-`, colapsa múltiples
 * `-`, recorta a 50 chars.
 */
export function slugify(input: string): string {
  const normalized = input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const cleaned = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!cleaned) return "draft";
  return cleaned.slice(0, 50);
}

/**
 * Genera un id único para el draft: <YYYYMMDDTHHmmssZ>-<rand6>.
 * No contiene `:` (incompatible con Windows) ni separadores de path.
 */
export function generateDraftId(now: Date = new Date()): string {
  // 2026-04-26T12:34:56.789Z → 20260426T123456Z (strip ms, then strip - and :)
  const iso = now.toISOString();
  const noMs = iso.replace(/\.\d{3}Z$/, "Z");
  const stamp = noMs.replace(/[-:]/g, "");
  const rand = randomBytes(3).toString("hex");
  return `${stamp}-${rand}`;
}

/**
 * Construye el filename del draft: `<id>-<slug>.md`.
 */
export function draftFilename(id: string, title: string): string {
  return `${id}-${slugify(title)}.md`;
}

/**
 * Path absoluto seguro contra traversal. Normaliza `relPath` y verifica que
 * el resultado quede dentro de `root`.
 */
export function safeJoin(root: string, relPath: string): string {
  const absRoot = resolve(root);
  const absPath = resolve(absRoot, relPath);
  const rel = relative(absRoot, absPath);
  if (rel.startsWith("..") || rel.includes(`..${sep}`)) {
    throw new Error(
      `Path inseguro: "${relPath}" escapa el root (${absRoot}).`
    );
  }
  return absPath;
}

/**
 * Asegura que el directorio padre de `filePath` exista.
 */
export async function ensureDir(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * Write atómico: escribe a tempfile en el mismo dir y rename. Crea el dir si
 * hace falta.
 */
export async function atomicWrite(
  absPath: string,
  content: string
): Promise<void> {
  await ensureDir(absPath);
  await writeFileAtomic(absPath, content, { encoding: "utf8" });
}

/**
 * Strip undefined values from an object (recursive shallow). js-yaml/gray-matter
 * no soporta dump de `undefined` y lanza "unacceptable kind of an object".
 */
function pruneUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  return out as T;
}

/**
 * Serializa frontmatter + body a markdown.
 */
export function buildDraftMarkdown(
  fm: YoDraftFrontmatter,
  body: string
): string {
  const fmObject = pruneUndefined({ ...fm } as Record<string, unknown>);
  return matter.stringify(body, fmObject);
}

/**
 * Construye un frontmatter válido a partir del input + metadata generada.
 */
export function buildFrontmatter(
  input: YoDraftInput,
  id: string,
  createdAt: Date,
  secret_scan: YoDraftFrontmatter["secret_scan"],
  redactor_findings?: YoDraftFrontmatter["redactor_findings"]
): YoDraftFrontmatter {
  const fm: YoDraftFrontmatter = {
    id,
    title: input.title,
    kind: input.kind,
    scope: input.scope,
    project_slug: input.project_slug,
    importance: input.importance,
    confidence: input.confidence,
    source_ref: input.source_ref,
    tags: input.tags ?? [],
    session_id: input.session_id,
    created_at: createdAt.toISOString(),
    expires_at: input.expires_at,
    supersedes: input.supersedes,
    secret_scan,
    redactor_findings,
  };
  return fm;
}

/**
 * Lee un draft (parseando frontmatter) por filename relativo a yo/drafts/.
 * Soporta también la subcarpeta .flagged/.
 */
export async function readDraftFile(
  root: string,
  draftRelPath: string
): Promise<{
  frontmatter: YoDraftFrontmatter;
  body: string;
  absPath: string;
}> {
  const absPath = safeJoin(root, draftRelPath);
  const raw = await readFile(absPath, "utf8");
  const parsed = matter(raw);
  return {
    frontmatter: parsed.data as YoDraftFrontmatter,
    body: parsed.content,
    absPath,
  };
}

/**
 * Lista archivos `.md` en `yo/drafts/` (excluye `.flagged/` salvo que se pida).
 */
export async function listDrafts(
  root: string,
  options: { includeFlagged?: boolean } = {}
): Promise<{ relPath: string; absPath: string }[]> {
  const out: { relPath: string; absPath: string }[] = [];
  const draftsAbs = safeJoin(root, YO_PATHS.drafts);

  const walk = async (
    dirAbs: string,
    relBase: string,
    depth: number
  ): Promise<void> => {
    if (!existsSync(dirAbs)) return;
    const entries = await readdir(dirAbs, { withFileTypes: true });
    for (const e of entries) {
      const abs = join(dirAbs, e.name);
      const rel = join(relBase, e.name);
      if (e.isDirectory()) {
        if (e.name === ".flagged" && !options.includeFlagged) continue;
        if (depth >= 2) continue; // no profundizar más
        await walk(abs, rel, depth + 1);
      } else if (e.name.endsWith(".md")) {
        out.push({ relPath: rel.replace(/\\/g, "/"), absPath: abs });
      }
    }
  };
  await walk(draftsAbs, YO_PATHS.drafts, 0);
  return out;
}

/**
 * Mueve un archivo dentro de yo/ creando el dir destino si hace falta.
 */
export async function moveFile(
  absFrom: string,
  absTo: string
): Promise<void> {
  await ensureDir(absTo);
  await rename(absFrom, absTo);
}

/**
 * Hash SHA-256 de un buffer/string.
 */
export function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/**
 * Retorna size + mtime de un archivo, o null si no existe.
 */
export async function fileMeta(
  absPath: string
): Promise<{ size: number; mtime: Date } | null> {
  if (!existsSync(absPath)) return null;
  const s = await stat(absPath);
  return { size: s.size, mtime: s.mtime };
}
