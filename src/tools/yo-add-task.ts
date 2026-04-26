import { getYoSupabase } from "../utils/yo-supabase.js";

export interface YoAddTaskInput {
  project: string;
  content_md: string;
  priority?: "low" | "medium" | "high" | "urgent";
  assigned_to?: string;
}

export interface YoAddTaskResult {
  task_id: string;
}

export async function yoAddTask(
  input: YoAddTaskInput
): Promise<YoAddTaskResult> {
  if (!input.project || !input.project.trim()) {
    throw new Error("project (project_slug) es obligatorio.");
  }
  if (!input.content_md || !input.content_md.trim()) {
    throw new Error("content_md es obligatorio.");
  }

  const supabase = getYoSupabase();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      project_slug: input.project,
      content_md: input.content_md,
      priority: input.priority ?? "medium",
      assigned_to: input.assigned_to ?? null,
      source: "claude",
      metadata: { created_via: "mcp_claude_code" },
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Error insertando task: ${error.message}`);
  }
  if (!data?.id) {
    throw new Error("Insert no retornó id.");
  }

  return { task_id: data.id };
}
