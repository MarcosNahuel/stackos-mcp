import { describe, expect, it } from "vitest";
import { buildBriefMarkdown } from "./brief.js";

describe("buildBriefMarkdown", () => {
  it("construye briefing 5-8 líneas con tasks, blockers, WA y memoria", () => {
    const md = buildBriefMarkdown({
      project: "conocimiento-nahuel",
      tasks: [
        { id: "t1", priority: "high", content_preview: "Revisar P7 playbook", age_hours: 4 },
        { id: "t2", priority: "medium", content_preview: "Update INDEX", age_hours: 12 },
      ],
      blockers: [{ id: "b1", priority: "high", content_preview: "Esperando GCP IAM", age_hours: 36 }],
      recent_wa: [{ from_name: "Nacho", text_preview: "Listo el deploy CRM", hours_ago: 2 }],
      memory_excerpt: "Session 4 done. Cycle 2c bloqueado por Dokploy.",
    });

    expect(md).toContain("conocimiento-nahuel");
    expect(md).toContain("2 tasks pending");
    expect(md).toContain("1 blocker");
    expect(md).toContain("Nacho");
    expect(md).toContain("Cycle 2c");
    const lines = md.trim().split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(5);
    expect(lines.length).toBeLessThanOrEqual(10);
  });

  it("retorna mensaje minimal cuando no hay nada", () => {
    const md = buildBriefMarkdown({
      project: "stackos-mcp",
      tasks: [],
      blockers: [],
      recent_wa: [],
      memory_excerpt: null,
    });
    expect(md).toContain("stackos-mcp");
    expect(md).toContain("Sin tasks pending");
  });

  it("trunca preview tasks a 80 chars", () => {
    const longContent = "A".repeat(200);
    const md = buildBriefMarkdown({
      project: "x",
      tasks: [{ id: "t1", priority: "low", content_preview: longContent, age_hours: 1 }],
      blockers: [],
      recent_wa: [],
      memory_excerpt: null,
    });
    expect(md).not.toContain(longContent);
    expect(md).toContain("A".repeat(80));
  });
});
