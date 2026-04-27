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
