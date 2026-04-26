import { existsSync } from "fs";
import { readFile, rename, copyFile } from "fs/promises";
import { join } from "path";
import matter from "gray-matter";
import { withLock } from "../utils/lockfile.js";
import {
  YO_PATHS,
  atomicWrite,
  ensureDir,
  listDrafts,
  moveFile,
  readDraftFile,
  safeJoin,
} from "../utils/yo-fs.js";
import { exactIdempotency } from "../utils/merge-paragraphs.js";
import { appendAudit } from "../utils/audit-jsonl.js";
import { commitAndPushYoAsync } from "../utils/git-sync.js";
import type { YoDraftFrontmatter } from "../schemas/yo-draft.schema.js";

export type YoIntegrarAccion =
  | "proposal"
  | "apply"
  | "append"
  | "replace"
  | "discard";

export interface YoIntegrarBorradorInput {
  draft_id: string;
  /**
   * Action default = "proposal" (FIX M2): genera <target>.proposal.md SIN
   * tocar el target original. Usar action="apply" para escribir realmente.
   */
  accion?: YoIntegrarAccion;
  target_path?: string;
}

export interface YoIntegrarBorradorResult {
  accion: YoIntegrarAccion;
  draft_id: string;
  target_path?: string;
  proposal_path?: string;
  backup_path?: string;
  archived_to?: string;
  paragraphs_already_present: number;
  paragraphs_to_append: number;
  conflicts_count: number;
  warnings: string[];
}

/**
 * Mapea (scope, kind) → archivo target por defecto en yo/.
 */
function defaultTargetForDraft(fm: YoDraftFrontmatter): string {
  if (fm.scope === "project") {
    if (!fm.project_slug) {
      throw new Error(
        "scope=project pero el draft no tiene project_slug. No se puede inferir target."
      );
    }
    return `yo/projects/${fm.project_slug}.md`;
  }
  // global
  switch (fm.kind) {
    case "stack-update":
      return "yo/global/stacks.md";
    case "workflow":
      return "yo/global/workflows.md";
    case "pattern":
    case "gotcha":
    case "insight":
    case "decision":
    default:
      return "yo/global/insights.md";
  }
}

/**
 * Construye el frontmatter de salida para el target tras integrar drafts.
 */
function withIntegratedDraft(
  current: Record<string, unknown> | null,
  draftId: string
): Record<string, unknown> {
  const next: Record<string, unknown> = current ? { ...current } : {};
  const list = Array.isArray(next.integrated_drafts)
    ? (next.integrated_drafts as string[])
    : [];
  if (!list.includes(draftId)) list.push(draftId);
  next.integrated_drafts = list;
  next.last_integrated_at = new Date().toISOString();
  return next;
}

function pruneUndefined(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

interface DraftRecord {
  id: string;
  relPath: string;
  absPath: string;
  fm: YoDraftFrontmatter;
  body: string;
}

async function findDraftById(
  root: string,
  draftId: string
): Promise<DraftRecord> {
  const drafts = await listDrafts(root, { includeFlagged: true });
  for (const d of drafts) {
    try {
      const parsed = await readDraftFile(root, d.relPath);
      if (parsed.frontmatter.id === draftId) {
        return {
          id: draftId,
          relPath: d.relPath,
          absPath: d.absPath,
          fm: parsed.frontmatter,
          body: parsed.body,
        };
      }
    } catch {
      continue;
    }
  }
  throw new Error(`Draft no encontrado: ${draftId}`);
}

interface MergePreview {
  newBody: string;
  paragraphsAlready: number;
  paragraphsToAppend: number;
}

function buildMergedBody(
  targetBody: string,
  draft: DraftRecord,
  options: { addProvenance: boolean }
): MergePreview {
  const idem = exactIdempotency(draft.body, targetBody);
  if (idem.toAppend.length === 0) {
    return {
      newBody: targetBody,
      paragraphsAlready: idem.alreadyPresent.length,
      paragraphsToAppend: 0,
    };
  }
  const provenance = options.addProvenance
    ? `<!-- merged from draft ${draft.id} (${draft.fm.kind}) at ${new Date().toISOString()} -->\n\n`
    : "";
  const appended = idem.toAppend.map((p) => p.text).join("\n\n");
  const trimmedTarget = targetBody.replace(/\s+$/g, "");
  const separator = trimmedTarget.length > 0 ? "\n\n---\n\n" : "";
  const newBody = `${trimmedTarget}${separator}${provenance}${appended}\n`;
  return {
    newBody,
    paragraphsAlready: idem.alreadyPresent.length,
    paragraphsToAppend: idem.toAppend.length,
  };
}

async function readTargetSplit(
  absPath: string
): Promise<{ frontmatter: Record<string, unknown> | null; body: string }> {
  if (!existsSync(absPath)) {
    return { frontmatter: null, body: "" };
  }
  const raw = await readFile(absPath, "utf8");
  const parsed = matter(raw);
  return {
    frontmatter:
      Object.keys(parsed.data).length > 0
        ? (parsed.data as Record<string, unknown>)
        : null,
    body: parsed.content ?? "",
  };
}

function serializeWithFrontmatter(
  fm: Record<string, unknown> | null,
  body: string
): string {
  if (!fm || Object.keys(fm).length === 0) return body;
  return matter.stringify(body, pruneUndefined(fm));
}

/**
 * yo_integrar_borrador (FIX M2 — default = "proposal", FIX M1 — exact_idempotency).
 *
 * Acciones:
 *  - "proposal" (DEFAULT): genera `<target>.proposal.md` con el merge propuesto.
 *    NO toca el target original. Para aplicar, llamar de nuevo con action="apply".
 *  - "apply": ejecuta el merge real. Hace backup del target a .archive/, escribe
 *    el nuevo contenido, y mueve el draft a .archive/integrated/<año>/.
 *  - "append": agrega el body del draft al final del target sin chequeo de
 *    idempotencia. Útil para agregar logs/eventos.
 *  - "replace": backup target y reemplaza con el body del draft.
 *  - "discard": archiva el draft sin tocar el target.
 *
 * Idempotencia (FIX M1): split por párrafos, normalize whitespace + NFC,
 * SHA-256 por párrafo. Match exacto → skip. Esto NO es dedupe semántico;
 * paráfrasis quedan como párrafos nuevos.
 */
export async function yoIntegrarBorrador(
  root: string,
  input: YoIntegrarBorradorInput
): Promise<YoIntegrarBorradorResult> {
  if (!input.draft_id || !input.draft_id.trim()) {
    throw new Error("draft_id es obligatorio.");
  }
  const accion: YoIntegrarAccion = input.accion ?? "proposal";

  return await withLock(root, "yo-integrar", async () => {
    const draft = await findDraftById(root, input.draft_id);

    // Bloqueo: si el draft está flagged, NO permitir apply/append/replace
    if (
      draft.relPath.includes(".flagged/") &&
      (accion === "apply" || accion === "append" || accion === "replace")
    ) {
      throw new Error(
        `Draft ${input.draft_id} está FLAGGED por el redactor. No puede integrarse con action="${accion}". Curá el contenido primero o usá action="discard".`
      );
    }

    if (accion === "discard") {
      const year = new Date().getFullYear();
      const filename = draft.relPath.split("/").pop() ?? draft.relPath;
      const archiveRel = `${YO_PATHS.archiveDiscarded}/${year}/${filename}`;
      const archiveAbs = safeJoin(root, archiveRel);
      await ensureDir(archiveAbs);
      if (existsSync(archiveAbs)) {
        const ts = Date.now();
        const fixedRel = archiveRel.replace(/\.md$/, `-${ts}.md`);
        await moveFile(draft.absPath, safeJoin(root, fixedRel));
        await appendAudit(root, {
          tool: "yo_integrar_borrador",
          paths_touched: [draft.relPath, fixedRel],
          metadata: { action: "discard", draft_id: draft.id },
        });
        return {
          accion,
          draft_id: draft.id,
          archived_to: fixedRel,
          paragraphs_already_present: 0,
          paragraphs_to_append: 0,
          conflicts_count: 0,
          warnings: [],
        };
      }
      await moveFile(draft.absPath, archiveAbs);
      await appendAudit(root, {
        tool: "yo_integrar_borrador",
        paths_touched: [draft.relPath, archiveRel],
        metadata: { action: "discard", draft_id: draft.id },
      });
      return {
        accion,
        draft_id: draft.id,
        archived_to: archiveRel,
        paragraphs_already_present: 0,
        paragraphs_to_append: 0,
        conflicts_count: 0,
        warnings: [],
      };
    }

    // Resto de acciones requieren target
    const targetRel = (input.target_path ?? defaultTargetForDraft(draft.fm))
      .replace(/\\/g, "/");
    const targetAbs = safeJoin(root, targetRel);
    const target = await readTargetSplit(targetAbs);

    if (accion === "proposal") {
      const merged = buildMergedBody(target.body, draft, {
        addProvenance: true,
      });
      const newFm = pruneUndefined({
        ...(target.frontmatter ?? {}),
        proposal_for: targetRel,
        from_draft: draft.id,
        from_draft_kind: draft.fm.kind,
        from_draft_title: draft.fm.title,
        generated_at: new Date().toISOString(),
        is_proposal: true,
      });
      const proposalRel = `${targetRel}.proposal.md`;
      const proposalAbs = safeJoin(root, proposalRel);
      const out = matter.stringify(merged.newBody, newFm);
      await atomicWrite(proposalAbs, out);

      await appendAudit(root, {
        tool: "yo_integrar_borrador",
        paths_touched: [draft.relPath, proposalRel],
        metadata: {
          action: "proposal",
          draft_id: draft.id,
          target: targetRel,
          paragraphs_already_present: merged.paragraphsAlready,
          paragraphs_to_append: merged.paragraphsToAppend,
        },
      });

      const warnings: string[] = [
        `PROPUESTA generada en ${proposalRel}. Revisala visualmente. Para aplicar el merge, llamá yo_integrar_borrador con action="apply" y el mismo draft_id.`,
      ];
      if (merged.paragraphsToAppend === 0) {
        warnings.push(
          "Idempotencia: todos los párrafos del draft ya existen en el target. La proposal queda igual al target."
        );
      }

      return {
        accion,
        draft_id: draft.id,
        target_path: targetRel,
        proposal_path: proposalRel,
        paragraphs_already_present: merged.paragraphsAlready,
        paragraphs_to_append: merged.paragraphsToAppend,
        conflicts_count: 0,
        warnings,
      };
    }

    if (accion === "append" || accion === "apply") {
      // backup si target existe
      let backupRel: string | undefined;
      if (existsSync(targetAbs)) {
        const ts = Date.now();
        const fname = targetRel.split("/").pop() ?? "target.md";
        backupRel = `yo/.archive/${fname.replace(/\.md$/, "")}-${ts}.bak`;
        const backupAbs = safeJoin(root, backupRel);
        await ensureDir(backupAbs);
        await copyFile(targetAbs, backupAbs);
      }

      let merged: MergePreview;
      if (accion === "append") {
        // no chequea idempotencia, append directo
        const provenance = `<!-- appended from draft ${draft.id} (${draft.fm.kind}) at ${new Date().toISOString()} -->\n\n`;
        const trimmed = target.body.replace(/\s+$/g, "");
        const sep = trimmed.length > 0 ? "\n\n---\n\n" : "";
        merged = {
          newBody: `${trimmed}${sep}${provenance}${draft.body}\n`,
          paragraphsAlready: 0,
          paragraphsToAppend: 1,
        };
      } else {
        merged = buildMergedBody(target.body, draft, { addProvenance: true });
      }

      const newFm = withIntegratedDraft(target.frontmatter, draft.id);
      const out = serializeWithFrontmatter(newFm, merged.newBody);
      await atomicWrite(targetAbs, out);

      // Mover draft a .archive/integrated/<año>/
      const year = new Date().getFullYear();
      const filename = draft.relPath.split("/").pop() ?? draft.relPath;
      const archiveRel = `${YO_PATHS.archiveIntegrated}/${year}/${filename}`;
      const archiveAbs = safeJoin(root, archiveRel);
      await ensureDir(archiveAbs);
      if (existsSync(archiveAbs)) {
        const ts = Date.now();
        const fixedRel = archiveRel.replace(/\.md$/, `-${ts}.md`);
        await moveFile(draft.absPath, safeJoin(root, fixedRel));
      } else {
        await moveFile(draft.absPath, archiveAbs);
      }

      await appendAudit(root, {
        tool: "yo_integrar_borrador",
        paths_touched: [
          draft.relPath,
          targetRel,
          ...(backupRel ? [backupRel] : []),
        ],
        metadata: {
          action: accion,
          draft_id: draft.id,
          target: targetRel,
          paragraphs_already_present: merged.paragraphsAlready,
          paragraphs_to_append: merged.paragraphsToAppend,
          backup_path: backupRel,
        },
      });

      // Eliminar proposal stale si existe
      const proposalRel = `${targetRel}.proposal.md`;
      const proposalAbs = safeJoin(root, proposalRel);
      if (existsSync(proposalAbs)) {
        try {
          await rename(proposalAbs, `${proposalAbs}.applied.bak`);
        } catch {
          /* ignore */
        }
      }

      // git sync async (no bloquea)
      commitAndPushYoAsync(
        root,
        `chore(yo): integrar draft ${draft.id} (${accion}) → ${targetRel}`
      );

      return {
        accion,
        draft_id: draft.id,
        target_path: targetRel,
        backup_path: backupRel,
        paragraphs_already_present: merged.paragraphsAlready,
        paragraphs_to_append: merged.paragraphsToAppend,
        conflicts_count: 0,
        warnings:
          merged.paragraphsToAppend === 0 && accion === "apply"
            ? [
                "Idempotencia: todos los párrafos del draft ya existen en el target. Solo se actualizó frontmatter y se archivó el draft.",
              ]
            : [],
      };
    }

    if (accion === "replace") {
      let backupRel: string | undefined;
      if (existsSync(targetAbs)) {
        const ts = Date.now();
        const fname = targetRel.split("/").pop() ?? "target.md";
        backupRel = `yo/.archive/${fname.replace(/\.md$/, "")}-${ts}.bak`;
        const backupAbs = safeJoin(root, backupRel);
        await ensureDir(backupAbs);
        await copyFile(targetAbs, backupAbs);
      }
      const newFm = withIntegratedDraft(target.frontmatter, draft.id);
      const out = serializeWithFrontmatter(newFm, draft.body + "\n");
      await atomicWrite(targetAbs, out);

      // Archivar draft
      const year = new Date().getFullYear();
      const filename = draft.relPath.split("/").pop() ?? draft.relPath;
      const archiveRel = `${YO_PATHS.archiveIntegrated}/${year}/${filename}`;
      const archiveAbs = safeJoin(root, archiveRel);
      await ensureDir(archiveAbs);
      if (existsSync(archiveAbs)) {
        const ts2 = Date.now();
        await moveFile(
          draft.absPath,
          safeJoin(root, archiveRel.replace(/\.md$/, `-${ts2}.md`))
        );
      } else {
        await moveFile(draft.absPath, archiveAbs);
      }

      await appendAudit(root, {
        tool: "yo_integrar_borrador",
        paths_touched: [
          draft.relPath,
          targetRel,
          ...(backupRel ? [backupRel] : []),
        ],
        metadata: {
          action: "replace",
          draft_id: draft.id,
          target: targetRel,
          backup_path: backupRel,
        },
      });

      commitAndPushYoAsync(
        root,
        `chore(yo): replace ${targetRel} desde draft ${draft.id}`
      );

      return {
        accion,
        draft_id: draft.id,
        target_path: targetRel,
        backup_path: backupRel,
        paragraphs_already_present: 0,
        paragraphs_to_append: 0,
        conflicts_count: 0,
        warnings: [],
      };
    }

    throw new Error(`Acción no soportada: ${accion}`);
  });
}
