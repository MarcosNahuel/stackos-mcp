import { join } from "path";
import { withLock } from "../utils/lockfile.js";
import {
  YO_PATHS,
  atomicWrite,
  buildDraftMarkdown,
  buildFrontmatter,
  draftFilename,
  generateDraftId,
  safeJoin,
} from "../utils/yo-fs.js";
import {
  YoDraftInput,
  YoDraftInputSchema,
} from "../schemas/yo-draft.schema.js";
import { appendAudit, fingerprint } from "../utils/audit-jsonl.js";
import { redactorScan, redactorDecision } from "../utils/redactor.js";

export interface YoAgregarBorradorResult {
  draft_id: string;
  path: string;
  flagged: boolean;
  blocked: boolean;
  redactor_decision: "clean" | "flagged" | "blocked";
  findings_count: number;
  warnings: string[];
}

/**
 * Crea un draft en yo/drafts/<id>-<slug>.md.
 *
 * Pipeline:
 *   1. Validar input contra Zod schema.
 *   2. Pasar body por el redactor (Secretlint + patterns custom).
 *      - clean → drafts/
 *      - flagged → drafts/.flagged/
 *      - blocked → reject sin escribir
 *   3. Generar frontmatter con secret_scan + findings.
 *   4. Write atómico bajo lock.
 *   5. Append audit JSONL.
 */
export async function yoAgregarBorrador(
  root: string,
  rawInput: unknown
): Promise<YoAgregarBorradorResult> {
  const input: YoDraftInput = YoDraftInputSchema.parse(rawInput);

  const scan = await redactorScan(input.body);
  const decision = redactorDecision(scan.findings);

  if (decision === "blocked") {
    await appendAudit(root, {
      tool: "yo_agregar_borrador",
      paths_touched: [],
      redactor_decision: "blocked",
      fingerprint_input_hash: fingerprint(input.body),
      metadata: {
        reason: "high_severity_findings",
        findings_count: scan.findings.length,
        finding_types: scan.findings.map((f) => f.type),
      },
    });
    throw new Error(
      `Redactor BLOQUEÓ el draft: ${scan.findings.length} hallazgo(s) de severidad alta. ` +
        `Tipos: ${scan.findings.map((f) => f.type).join(", ")}. ` +
        `Revisá el contenido y remové los secretos antes de reintentar.`
    );
  }

  const id = generateDraftId();
  const filename = draftFilename(id, input.title);

  // Escoger destino según decision
  const targetDir =
    decision === "flagged" ? YO_PATHS.draftsFlagged : YO_PATHS.drafts;
  const relPath = `${targetDir}/${filename}`;
  const absPath = safeJoin(root, relPath);

  const fm = buildFrontmatter(
    input,
    id,
    new Date(),
    decision === "flagged" ? "flagged" : "clean",
    scan.findings.length > 0
      ? scan.findings.map((f) => ({
          type: f.type,
          snippet_redacted: f.snippet_redacted,
          position: f.position,
          severity: f.severity,
        }))
      : undefined
  );

  const markdown = buildDraftMarkdown(fm, input.body);

  await withLock(root, "yo-drafts", async () => {
    await atomicWrite(absPath, markdown);
  });

  await appendAudit(root, {
    tool: "yo_agregar_borrador",
    paths_touched: [relPath],
    redactor_decision: decision,
    fingerprint_input_hash: fingerprint(input.body),
    metadata: {
      draft_id: id,
      kind: input.kind,
      scope: input.scope,
      findings_count: scan.findings.length,
    },
  });

  const warnings: string[] = [];
  if (decision === "flagged") {
    warnings.push(
      `Draft FLAGEADO: redactor detectó ${scan.findings.length} hallazgo(s) (${scan.findings
        .map((f) => f.type)
        .join(", ")}). Guardado en .flagged/ (no va a Git). Revisá antes de integrar.`
    );
  }

  return {
    draft_id: id,
    path: relPath,
    flagged: decision === "flagged",
    blocked: false,
    redactor_decision: decision,
    findings_count: scan.findings.length,
    warnings,
  };
}
