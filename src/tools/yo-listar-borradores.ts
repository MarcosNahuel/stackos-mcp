import { listDrafts, readDraftFile } from "../utils/yo-fs.js";
import type { YoDraftFrontmatter } from "../schemas/yo-draft.schema.js";

export interface YoListarBorradoresInput {
  scope?: "global" | "project";
  project_slug?: string;
  kind?: string;
  include_flagged?: boolean;
  limit?: number;
}

export interface YoBorradorListItem {
  id: string;
  path: string;
  flagged: boolean;
  title: string;
  kind: string;
  scope: string;
  project_slug?: string;
  importance: string;
  confidence: string;
  tags: string[];
  session_id: string;
  created_at: string;
  age_seconds: number;
  body_preview: string;
  findings_count: number;
}

const PREVIEW_CHARS = 200;

export async function yoListarBorradores(
  root: string,
  input: YoListarBorradoresInput = {}
): Promise<YoBorradorListItem[]> {
  const limit = input.limit ?? 50;
  if (limit < 1 || limit > 500) {
    throw new Error("limit debe estar entre 1 y 500.");
  }

  const includeFlagged = input.include_flagged ?? true;
  const drafts = await listDrafts(root, { includeFlagged });

  const items: YoBorradorListItem[] = [];
  const now = Date.now();

  for (const d of drafts) {
    let parsed: { frontmatter: YoDraftFrontmatter; body: string };
    try {
      parsed = await readDraftFile(root, d.relPath);
    } catch {
      continue; // skip drafts mal-formados
    }
    const fm = parsed.frontmatter;
    if (!fm || !fm.id) continue;

    if (input.scope && fm.scope !== input.scope) continue;
    if (input.project_slug && fm.project_slug !== input.project_slug)
      continue;
    if (input.kind && fm.kind !== input.kind) continue;

    const created = fm.created_at
      ? new Date(fm.created_at).getTime()
      : Date.now();
    const isFlagged = d.relPath.includes(".flagged/");
    const body = parsed.body.trim();
    const preview =
      body.length > PREVIEW_CHARS ? body.slice(0, PREVIEW_CHARS) + "…" : body;

    items.push({
      id: fm.id,
      path: d.relPath,
      flagged: isFlagged,
      title: fm.title,
      kind: fm.kind,
      scope: fm.scope,
      project_slug: fm.project_slug,
      importance: fm.importance ?? "medium",
      confidence: fm.confidence ?? "medium",
      tags: fm.tags ?? [],
      session_id: fm.session_id,
      created_at: fm.created_at,
      age_seconds: Math.max(0, Math.floor((now - created) / 1000)),
      body_preview: preview,
      findings_count: fm.redactor_findings?.length ?? 0,
    });

    if (items.length >= limit) break;
  }

  items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return items;
}
