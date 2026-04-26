import { getYoSupabase } from "../utils/yo-supabase.js";

export interface YoListTasksInput {
  project?: string;
  status?: "pending" | "in_progress" | "done" | "cancelled" | "blocked";
  assigned_to?: string;
  limit?: number;
}

export interface YoTaskListItem {
  id: string;
  project_slug: string | null;
  status: string;
  priority: string;
  source: string;
  assigned_to: string | null;
  content_preview: string;
  created_at: string;
  age_seconds: number;
}

const PREVIEW_CHARS = 200;

export async function yoListTasks(
  input: YoListTasksInput = {}
): Promise<YoTaskListItem[]> {
  const limit = input.limit ?? 20;
  if (limit < 1 || limit > 200) {
    throw new Error("limit debe estar entre 1 y 200.");
  }

  const supabase = getYoSupabase();
  let query = supabase
    .from("tasks")
    .select(
      "id, project_slug, status, priority, source, assigned_to, content_md, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input.project) query = query.eq("project_slug", input.project);
  if (input.status) query = query.eq("status", input.status);
  if (input.assigned_to) query = query.eq("assigned_to", input.assigned_to);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Error listando tasks: ${error.message}`);
  }

  const now = Date.now();
  return (data ?? []).map((row) => {
    const contentMd: string = row.content_md ?? "";
    const preview =
      contentMd.length > PREVIEW_CHARS
        ? contentMd.slice(0, PREVIEW_CHARS) + "…"
        : contentMd;
    const createdMs = new Date(row.created_at).getTime();
    return {
      id: row.id,
      project_slug: row.project_slug,
      status: row.status,
      priority: row.priority,
      source: row.source,
      assigned_to: row.assigned_to,
      content_preview: preview,
      created_at: row.created_at,
      age_seconds: Math.max(0, Math.floor((now - createdMs) / 1000)),
    };
  });
}
