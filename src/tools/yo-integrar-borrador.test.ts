import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readdirSync } from "fs";
import { readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import matter from "gray-matter";
import { yoAgregarBorrador } from "./yo-agregar-borrador.js";
import { yoIntegrarBorrador } from "./yo-integrar-borrador.js";

const baseInput = {
  title: "Insight de testing",
  body: "Primer párrafo del draft.\n\nSegundo párrafo con info nueva.\n\nTercer párrafo sobre testing.",
  kind: "insight" as const,
  scope: "global" as const,
  confidence: "high" as const,
  source_ref: [{ type: "session" as const, ref: "test-session" }],
  session_id: "test-session",
};

async function setupRoot(): Promise<string> {
  const tmpRoot = mkdtempSync(join(tmpdir(), "yo-integrar-"));
  return tmpRoot;
}

describe("yo_integrar_borrador — proposal (default, FIX M2)", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await setupRoot();
  });

  afterEach(() => {
    try {
      rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("genera <target>.proposal.md sin tocar target", async () => {
    const draft = await yoAgregarBorrador(tmpRoot, baseInput);

    // Default action = proposal
    const result = await yoIntegrarBorrador(tmpRoot, {
      draft_id: draft.draft_id,
      target_path: "yo/global/insights.md",
    });

    expect(result.accion).toBe("proposal");
    expect(result.proposal_path).toBe("yo/global/insights.md.proposal.md");
    expect(result.paragraphs_to_append).toBe(3);

    // Target NO existe
    expect(existsSync(join(tmpRoot, "yo/global/insights.md"))).toBe(false);
    // Proposal SI existe
    expect(
      existsSync(join(tmpRoot, "yo/global/insights.md.proposal.md"))
    ).toBe(true);

    // Draft NO está archivado
    const draftStillExists = existsSync(join(tmpRoot, draft.path));
    expect(draftStillExists).toBe(true);

    // Frontmatter de proposal contiene from_draft
    const raw = await readFile(
      join(tmpRoot, "yo/global/insights.md.proposal.md"),
      "utf8"
    );
    const parsed = matter(raw);
    expect(parsed.data.is_proposal).toBe(true);
    expect(parsed.data.from_draft).toBe(draft.draft_id);
    expect(parsed.data.proposal_for).toBe("yo/global/insights.md");
  });

  it("warning explícito sobre llamar apply", async () => {
    const draft = await yoAgregarBorrador(tmpRoot, baseInput);
    const r = await yoIntegrarBorrador(tmpRoot, {
      draft_id: draft.draft_id,
      target_path: "yo/global/insights.md",
    });
    expect(r.warnings.some((w) => w.includes("apply"))).toBe(true);
  });
});

describe("yo_integrar_borrador — apply", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await setupRoot();
  });

  afterEach(() => {
    try {
      rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("apply con target inexistente crea target + archiva draft", async () => {
    const draft = await yoAgregarBorrador(tmpRoot, baseInput);
    const result = await yoIntegrarBorrador(tmpRoot, {
      draft_id: draft.draft_id,
      accion: "apply",
      target_path: "yo/global/insights.md",
    });

    expect(result.accion).toBe("apply");
    expect(result.paragraphs_to_append).toBe(3);
    expect(existsSync(join(tmpRoot, "yo/global/insights.md"))).toBe(true);

    // Draft archivado
    expect(existsSync(join(tmpRoot, draft.path))).toBe(false);
    const year = new Date().getFullYear();
    const archDir = join(tmpRoot, "yo/.archive/integrated", String(year));
    expect(existsSync(archDir)).toBe(true);
    const archFiles = readdirSync(archDir).filter((f) => f.endsWith(".md"));
    expect(archFiles.length).toBeGreaterThan(0);

    // Frontmatter target tiene integrated_drafts
    const raw = await readFile(
      join(tmpRoot, "yo/global/insights.md"),
      "utf8"
    );
    const parsed = matter(raw);
    expect(parsed.data.integrated_drafts).toContain(draft.draft_id);
  });

  it("idempotencia: aplicar mismo contenido 2x no duplica párrafos", async () => {
    const draft1 = await yoAgregarBorrador(tmpRoot, baseInput);
    await yoIntegrarBorrador(tmpRoot, {
      draft_id: draft1.draft_id,
      accion: "apply",
      target_path: "yo/global/insights.md",
    });

    // Mismo body, segunda integración (con nuevo session_id)
    const draft2 = await yoAgregarBorrador(tmpRoot, {
      ...baseInput,
      session_id: "test-session-2",
    });
    const result2 = await yoIntegrarBorrador(tmpRoot, {
      draft_id: draft2.draft_id,
      accion: "apply",
      target_path: "yo/global/insights.md",
    });

    expect(result2.paragraphs_to_append).toBe(0);
    expect(result2.paragraphs_already_present).toBe(3);

    // El target sigue teniendo solo 3 párrafos
    const raw = await readFile(
      join(tmpRoot, "yo/global/insights.md"),
      "utf8"
    );
    const body = matter(raw).content;
    const paragraphs = body.split(/\n\s*\n+/).filter((p) => p.trim());
    expect(paragraphs.length).toBeLessThanOrEqual(4); // 3 párrafos + posible separator/comment
  });

  it("flagged drafts NO pueden hacer apply", async () => {
    // Usamos un Bearer token en prosa (severity=medium) → flagged, no blocked
    const flagged = await yoAgregarBorrador(tmpRoot, {
      ...baseInput,
      title: "Flagged draft",
      body: "Vi un Bearer abcdefghij1234567890ABCDEFGHIJ1234567890ABCDEFGH en producción.",
    });
    expect(flagged.flagged).toBe(true);
    await expect(
      yoIntegrarBorrador(tmpRoot, {
        draft_id: flagged.draft_id,
        accion: "apply",
        target_path: "yo/global/insights.md",
      })
    ).rejects.toThrow(/FLAGGED/);
  });
});

describe("yo_integrar_borrador — discard", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await setupRoot();
  });

  afterEach(() => {
    try {
      rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("discard mueve draft a .archive/discarded/<año>/", async () => {
    const draft = await yoAgregarBorrador(tmpRoot, baseInput);
    const result = await yoIntegrarBorrador(tmpRoot, {
      draft_id: draft.draft_id,
      accion: "discard",
    });
    expect(result.accion).toBe("discard");
    expect(result.archived_to).toMatch(/^yo\/\.archive\/discarded\/\d{4}\//);
    expect(existsSync(join(tmpRoot, draft.path))).toBe(false);
    expect(existsSync(join(tmpRoot, result.archived_to!))).toBe(true);
  });
});

describe("yo_integrar_borrador — auto target inference", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await setupRoot();
  });

  afterEach(() => {
    try {
      rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("scope=global, kind=stack-update → yo/global/stacks.md", async () => {
    const draft = await yoAgregarBorrador(tmpRoot, {
      ...baseInput,
      kind: "stack-update",
    });
    const r = await yoIntegrarBorrador(tmpRoot, {
      draft_id: draft.draft_id,
    });
    expect(r.target_path).toBe("yo/global/stacks.md");
  });

  it("scope=project requiere project_slug", async () => {
    const draft = await yoAgregarBorrador(tmpRoot, {
      ...baseInput,
      scope: "project",
      project_slug: "diego-erp",
    });
    const r = await yoIntegrarBorrador(tmpRoot, {
      draft_id: draft.draft_id,
    });
    expect(r.target_path).toBe("yo/projects/diego-erp.md");
  });
});
