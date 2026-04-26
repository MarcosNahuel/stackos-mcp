import { existsSync } from "fs";
import { readdir } from "fs/promises";
import { join } from "path";
import { listDrafts, readDraftFile, safeJoin } from "../utils/yo-fs.js";

export interface YoStatusResult {
  drafts_pending: number;
  drafts_flagged: number;
  drafts_blocked: number;
  conflicts_count: number;
  archives: {
    integrated: number;
    discarded: number;
  };
  by_kind: Record<string, number>;
  by_scope: Record<string, number>;
  oldest_draft_age_seconds: number | null;
  redactor_findings_total: number;
  audit_log_today_path: string;
}

/**
 * Reporta estado agregado de yo/.
 * Usado por agentes / dashboard para chequear backlog de drafts pendientes.
 */
export async function yoStatus(root: string): Promise<YoStatusResult> {
  const drafts = await listDrafts(root, { includeFlagged: true });

  let pending = 0;
  let flagged = 0;
  let oldest: number | null = null;
  let findingsTotal = 0;
  const byKind: Record<string, number> = {};
  const byScope: Record<string, number> = {};
  const now = Date.now();

  for (const d of drafts) {
    let parsed;
    try {
      parsed = await readDraftFile(root, d.relPath);
    } catch {
      continue;
    }
    const fm = parsed.frontmatter;
    const isFlagged = d.relPath.includes(".flagged/");
    if (isFlagged) flagged++;
    else pending++;

    byKind[fm.kind] = (byKind[fm.kind] ?? 0) + 1;
    byScope[fm.scope] = (byScope[fm.scope] ?? 0) + 1;
    findingsTotal += fm.redactor_findings?.length ?? 0;

    const created = fm.created_at ? new Date(fm.created_at).getTime() : now;
    const age = Math.floor((now - created) / 1000);
    if (oldest === null || age > oldest) oldest = age;
  }

  // Drafts blocked nunca persisten en disco. Lo mantenemos en 0 acá; queda
  // visible en audit log si interesa.
  const blocked = 0;

  // Archives
  const yearNow = String(new Date().getFullYear());
  const integratedDir = safeJoin(
    root,
    `yo/.archive/integrated/${yearNow}`
  );
  const discardedDir = safeJoin(
    root,
    `yo/.archive/discarded/${yearNow}`
  );
  const integrated = existsSync(integratedDir)
    ? (await readdir(integratedDir)).filter((f) => f.endsWith(".md")).length
    : 0;
  const discarded = existsSync(discardedDir)
    ? (await readdir(discardedDir)).filter((f) => f.endsWith(".md")).length
    : 0;

  // Conflicts: por ahora 0 (yo_integrar_borrador MPV con dedupe SHA-256 no
  // genera "conflicts" reales en el sentido de merge concurrente).
  const conflicts = 0;

  const yearMonth = new Date().toISOString().slice(0, 7);
  const auditLogPath = `yo/audit/audit-${yearMonth}.jsonl`;

  return {
    drafts_pending: pending,
    drafts_flagged: flagged,
    drafts_blocked: blocked,
    conflicts_count: conflicts,
    archives: { integrated, discarded },
    by_kind: byKind,
    by_scope: byScope,
    oldest_draft_age_seconds: oldest,
    redactor_findings_total: findingsTotal,
    audit_log_today_path: auditLogPath,
  };
}
