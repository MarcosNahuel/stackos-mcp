// src/yo/session-close.ts
import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function generateDraftId(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 15) + 'Z';
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}`;
}

function buildDraftContent(
  draftId: string,
  projectSlug: string,
  sessionCommits: string[],
  taskIdsResolved: string[]
): string {
  const date = new Date().toISOString().slice(0, 10);
  const summary = sessionCommits[0]?.slice(0, 60) ?? `sesion ${date}`;

  return [
    '---',
    `id: ${draftId}`,
    `title: "${summary}"`,
    `kind: workflow`,
    `scope: project`,
    `project_slug: ${projectSlug}`,
    `importance: medium`,
    `confidence: medium`,
    `source_ref:`,
    `  - type: session`,
    `    ref: session-${date}`,
    `tags: [session-wrap, ${projectSlug}]`,
    `expires_at: null`,
    `supersedes: []`,
    `secret_scan: pending`,
    '---',
    '',
    '## Commits de la sesion',
    ...(sessionCommits.length > 0
      ? sessionCommits.map(c => `- ${c}`)
      : ['- (sin commits en esta sesion)']),
    '',
    '## Tickets marcados como resueltos',
    ...(taskIdsResolved.length > 0
      ? taskIdsResolved.map(id => `- \`${id}\``)
      : ['- (ninguno)']),
  ].join('\n');
}

export function sessionCloseHandler(
  supabase: ReturnType<typeof createClient>,
  cnPath: string
) {
  return async (req: Request, res: Response) => {
    const {
      project_slug,
      task_ids_resolved = [],
      session_commits = [],
    } = req.body as {
      project_slug: string;
      task_ids_resolved: string[];
      session_commits: string[];
    };

    if (!project_slug) {
      return res.status(400).json({ error: 'project_slug requerido' });
    }

    // 1. Marcar tasks como resolved
    let resolved_count = 0;
    if (task_ids_resolved.length > 0) {
      const { error } = await supabase
        .schema('yo')
        .from('tasks')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .in('id', task_ids_resolved)
        .eq('project_slug', project_slug);

      if (!error) resolved_count = task_ids_resolved.length;
    }

    // 2. Generar draft
    const draftId = generateDraftId();
    const draftContent = buildDraftContent(
      draftId,
      project_slug,
      session_commits,
      task_ids_resolved
    );

    // 3. Escribir draft al filesystem CN (/data en Docker = CN clone)
    try {
      const draftsDir = path.join(cnPath, 'yo', 'drafts');
      fs.mkdirSync(draftsDir, { recursive: true });
      const slug = project_slug.replace(/[^a-z0-9-]/g, '-');
      fs.writeFileSync(
        path.join(draftsDir, `${draftId}-session-${slug}.md`),
        draftContent
      );
    } catch (e) {
      // Draft write es best-effort — no romper el response
      console.error('[session-close] draft write error:', e);
    }

    return res.json({
      resolved_count,
      draft_id: draftId,
      draft_content: draftContent,
    });
  };
}
