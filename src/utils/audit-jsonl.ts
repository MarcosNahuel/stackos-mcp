import { appendFile } from "fs/promises";
import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import { dirname, join } from "path";
import { sha256 } from "./yo-fs.js";

export interface AuditEntry {
  ts: string;
  tool: string;
  actor?: string;
  paths_touched: string[];
  redactor_decision?: "clean" | "flagged" | "blocked" | "skipped";
  fingerprint_input_hash?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Append-only JSONL: una línea por evento, **rotación mensual**.
 * Path: <root>/yo/audit/audit-<YYYY-MM>.jsonl (o sub-categoría auth/ si se pasa).
 *
 * Política de retention (FIX M6 — auditoría 2026-04-26):
 *  - 180 días (~6 meses).
 *  - Archivos > 6 meses se mueven a yo/.archive/audit/<YYYY>/ via cron mensual
 *    (TODO Session 2.5 — no implementado todavía, solo política documentada).
 */
export async function appendAudit(
  root: string,
  entry: Omit<AuditEntry, "ts">,
  category: "main" | "auth" = "main"
): Promise<void> {
  const ts = new Date().toISOString();
  const yearMonth = ts.slice(0, 7); // YYYY-MM
  const subdir = category === "auth" ? "auth" : "";
  const dir = subdir
    ? join(root, "yo", "audit", subdir)
    : join(root, "yo", "audit");
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  const filePath = join(dir, `audit-${yearMonth}.jsonl`);
  const line = JSON.stringify({ ts, ...entry }) + "\n";
  await appendFile(filePath, line, "utf8");
}

/**
 * Genera un fingerprint del input (sha256). Útil para correlacionar
 * sin guardar el contenido crudo.
 */
export function fingerprint(input: string): string {
  return sha256(input);
}
