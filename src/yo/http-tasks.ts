// src/yo/http-tasks.ts
import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

export function getTasksHandler(supabase: ReturnType<typeof createClient>) {
  return async (req: Request, res: Response) => {
    const { project, status = 'pending', limit = '10' } = req.query as Record<string, string>;

    let query = supabase
      .schema('yo')
      .from('tasks')
      .select('id, project_slug, status, priority, content_md, tags, created_at, created_by_contact_id, contacts:created_by_contact_id(name, whatsapp_number)')
      .in('status', status === 'open'
        ? ['pending', 'in_progress']
        : [status])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (project) {
      query = query.eq('project_slug', project);
    }

    const { data, error } = await query.limit(parseInt(limit, 10));
    if (error) return res.status(500).json({ error: error.message });

    const tasks = (data || []).map(t => ({
      id: t.id,
      project_slug: t.project_slug,
      status: t.status,
      priority: t.priority,
      title: (t.content_md || '').split('\n')[0].slice(0, 80),
      contact_name: (t as any).contacts?.name ?? null,
      created_at: t.created_at,
    }));

    return res.json({ tasks, count: tasks.length });
  };
}
