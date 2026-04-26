import { join } from "path";
import { existsSync } from "fs";
import { withLock } from "../utils/lockfile.js";
import {
  YO_PATHS,
  listDrafts,
  moveFile,
  readDraftFile,
  safeJoin,
} from "../utils/yo-fs.js";
import { appendAudit } from "../utils/audit-jsonl.js";

export interface YoDescartarBorradorInput {
  draft_id: string;
  reason?: string;
}

export interface YoDescartarBorradorResult {
  draft_id: string;
  archived_to: string;
}

/**
 * Mueve el draft de yo/drafts/ (o yo/drafts/.flagged/) a
 * yo/.archive/discarded/<YYYY>/. No borra: archiva.
 */
export async function yoDescartarBorrador(
  root: string,
  input: YoDescartarBorradorInput
): Promise<YoDescartarBorradorResult> {
  if (!input.draft_id || !input.draft_id.trim()) {
    throw new Error("draft_id es obligatorio.");
  }

  return await withLock(root, "yo-drafts", async () => {
    const drafts = await listDrafts(root, { includeFlagged: true });
    let target: { relPath: string; absPath: string } | null = null;
    for (const d of drafts) {
      try {
        const parsed = await readDraftFile(root, d.relPath);
        if (parsed.frontmatter.id === input.draft_id) {
          target = d;
          break;
        }
      } catch {
        continue;
      }
    }
    if (!target) {
      throw new Error(`Draft no encontrado: ${input.draft_id}`);
    }

    const year = new Date().getFullYear();
    const filename = target.relPath.split("/").pop() ?? target.relPath;
    const archiveRel = `${YO_PATHS.archiveDiscarded}/${year}/${filename}`;
    const archiveAbs = safeJoin(root, archiveRel);

    if (existsSync(archiveAbs)) {
      // colision: agregar sufijo timestamp
      const ts = Date.now();
      const fixedRel = archiveRel.replace(/\.md$/, `-${ts}.md`);
      const fixedAbs = safeJoin(root, fixedRel);
      await moveFile(target.absPath, fixedAbs);
      await appendAudit(root, {
        tool: "yo_descartar_borrador",
        paths_touched: [target.relPath, fixedRel],
        metadata: {
          draft_id: input.draft_id,
          reason: input.reason ?? null,
          collision_renamed: true,
        },
      });
      return { draft_id: input.draft_id, archived_to: fixedRel };
    }

    await moveFile(target.absPath, archiveAbs);
    await appendAudit(root, {
      tool: "yo_descartar_borrador",
      paths_touched: [target.relPath, archiveRel],
      metadata: {
        draft_id: input.draft_id,
        reason: input.reason ?? null,
      },
    });

    return { draft_id: input.draft_id, archived_to: archiveRel };
  });
}
