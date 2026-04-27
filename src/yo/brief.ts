export interface BriefTask {
  id: string;
  priority: string;
  content_preview: string;
  age_hours: number;
}

export interface BriefWA {
  from_name: string;
  text_preview: string;
  hours_ago: number;
}

export interface BriefInput {
  project: string;
  tasks: BriefTask[];
  blockers: BriefTask[];
  recent_wa: BriefWA[];
  memory_excerpt: string | null;
}

const MAX_PREVIEW = 80;

function truncate(s: string, n: number = MAX_PREVIEW): string {
  return (s || "").slice(0, n);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = import("@supabase/supabase-js").SupabaseClient<any, any, any>;
import { readFile } from "fs/promises";
import { join } from "path";

const STACKOS_ROOT = process.env.STACKOS_ROOT ?? process.env.DEFAULT_ROOT ?? "D:/Proyectos/CONOCIMIENTO-NAHUEL";

export async function fetchBriefTasks(
  client: AnySupabaseClient,
  project: string,
  limit = 5,
): Promise<BriefTask[]> {
  const { data } = await (client as any)
    .from("tasks")
    .select("id,priority,content_md,created_at,status")
    .eq("project_slug", project)
    .eq("status", "pending")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data as any[]) ?? []).map((t) => ({
    id: t.id,
    priority: t.priority ?? "medium",
    content_preview: ((t.content_md ?? "") as string).split("\n")[0] ?? "",
    age_hours: Math.round((Date.now() - new Date(t.created_at).getTime()) / 3_600_000),
  }));
}

export async function fetchBriefBlockers(
  client: AnySupabaseClient,
  project: string,
): Promise<BriefTask[]> {
  const { data } = await (client as any)
    .from("tasks")
    .select("id,priority,content_md,created_at")
    .eq("project_slug", project)
    .eq("status", "blocked")
    .order("created_at", { ascending: false })
    .limit(3);

  return ((data as any[]) ?? []).map((t) => ({
    id: t.id,
    priority: t.priority ?? "medium",
    content_preview: ((t.content_md ?? "") as string).split("\n")[0] ?? "",
    age_hours: Math.round((Date.now() - new Date(t.created_at).getTime()) / 3_600_000),
  }));
}

export async function fetchRecentWA(
  client: AnySupabaseClient,
  project: string,
  hoursWindow = 24,
): Promise<BriefWA[]> {
  const since = new Date(Date.now() - hoursWindow * 3_600_000).toISOString();
  const { data } = await (client as any)
    .from("tasks")
    .select("content_md,created_at,created_by_contact_id,contacts:created_by_contact_id(name)")
    .eq("project_slug", project)
    .eq("source", "whatsapp")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(3);

  return ((data as any[]) ?? []).map((t) => ({
    from_name: (t.contacts as any)?.name ?? "WA",
    text_preview: ((t.content_md ?? "") as string).split("\n")[0] ?? "",
    hours_ago: Math.round((Date.now() - new Date(t.created_at).getTime()) / 3_600_000),
  }));
}

export async function fetchMemoryExcerpt(
  project: string,
  client: AnySupabaseClient,
  maxChars = 600,
): Promise<string | null> {
  const { data } = await (client as any)
    .from("projects")
    .select("memory_md_path")
    .eq("slug", project)
    .maybeSingle();

  const relPath = (data as any)?.memory_md_path as string | undefined;
  if (!relPath) return null;

  try {
    const full = join(STACKOS_ROOT, relPath);
    const content = await readFile(full, "utf-8");
    const paragraphs = content
      .split(/\n\n+/)
      .filter((p) => !p.startsWith("---") && !p.startsWith("#") && p.trim().length > 20);
    const last = paragraphs.slice(-2).join(" ").replace(/\s+/g, " ").trim();
    return last.slice(0, maxChars);
  } catch {
    return null;
  }
}

export async function buildFullBrief(
  client: AnySupabaseClient,
  project: string,
  limit = 5,
): Promise<{ markdown: string; data: BriefInput }> {
  const [tasks, blockers, recent_wa, memory_excerpt] = await Promise.all([
    fetchBriefTasks(client, project, limit),
    fetchBriefBlockers(client, project),
    fetchRecentWA(client, project),
    fetchMemoryExcerpt(project, client),
  ]);
  const data: BriefInput = { project, tasks, blockers, recent_wa, memory_excerpt };
  return { markdown: buildBriefMarkdown(data), data };
}

export function buildBriefMarkdown(input: BriefInput): string {
  const lines: string[] = [];
  lines.push(`## yo · ${input.project}`);

  if (input.tasks.length === 0 && input.blockers.length === 0) {
    lines.push("Sin tasks pending. /yo-brief para detalle.");
  } else {
    const byPrio: Record<string, number> = {};
    input.tasks.forEach((t) => {
      byPrio[t.priority] = (byPrio[t.priority] ?? 0) + 1;
    });
    const breakdown = Object.entries(byPrio)
      .map(([p, n]) => `${p}=${n}`)
      .join(" ");
    lines.push(`${input.tasks.length} tasks pending${breakdown ? ` (${breakdown})` : ""}`);

    const top = input.tasks[0];
    if (top) lines.push(`Top: ${truncate(top.content_preview)} (${top.age_hours}h)`);

    if (input.blockers.length > 0) {
      lines.push(
        `${input.blockers.length} blocker${input.blockers.length > 1 ? "s" : ""}: ${truncate(input.blockers[0].content_preview, 60)}`,
      );
    }
  }

  if (input.recent_wa.length > 0) {
    const w = input.recent_wa[0];
    lines.push(`WA reciente · ${w.from_name} (${w.hours_ago}h): ${truncate(w.text_preview, 60)}`);
  }

  if (input.memory_excerpt) {
    lines.push(`Memoria: ${truncate(input.memory_excerpt, 120)}`);
  }

  lines.push("/yo-brief para detalle.");
  return lines.join("\n");
}
