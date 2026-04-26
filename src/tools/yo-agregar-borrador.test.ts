import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readdirSync } from "fs";
import { readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import matter from "gray-matter";
import { yoAgregarBorrador } from "./yo-agregar-borrador.js";

const baseInput = {
  title: "Mi nuevo insight",
  body: "Aprendí que para Postgres con RLS conviene activar policies por tabla y nunca usar service_role del lado cliente.",
  kind: "insight" as const,
  scope: "global" as const,
  confidence: "high" as const,
  source_ref: [{ type: "session" as const, ref: "session-test-1" }],
  session_id: "session-test-1",
};

describe("yo_agregar_borrador", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "yo-agregar-"));
  });

  afterEach(() => {
    try {
      rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("happy path: draft clean se escribe en yo/drafts/", async () => {
    const result = await yoAgregarBorrador(tmpRoot, baseInput);
    expect(result.flagged).toBe(false);
    expect(result.blocked).toBe(false);
    expect(result.redactor_decision).toBe("clean");
    expect(result.path).toMatch(/^yo\/drafts\/[^/]+\.md$/);
    expect(existsSync(join(tmpRoot, result.path))).toBe(true);

    // Frontmatter persistido
    const raw = await readFile(join(tmpRoot, result.path), "utf8");
    const parsed = matter(raw);
    expect(parsed.data.id).toBe(result.draft_id);
    expect(parsed.data.kind).toBe("insight");
    expect(parsed.data.secret_scan).toBe("clean");
  });

  it("draft con secreto va a yo/drafts/.flagged/", async () => {
    const result = await yoAgregarBorrador(tmpRoot, {
      ...baseInput,
      title: "Borrador con secret",
      body: "config: GH_TOKEN=ghp_abcdefghij1234567890ABCDEFGHIJ12345678",
    });
    expect(result.flagged).toBe(true);
    expect(result.path).toMatch(/^yo\/drafts\/\.flagged\//);
    expect(result.findings_count).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("blocked: 2+ high severity rechaza el draft", async () => {
    await expect(
      yoAgregarBorrador(tmpRoot, {
        ...baseInput,
        title: "Multiple secrets",
        body: "anthropic: sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA y github ghp_zyxwvutsrqponmlkjihgfedcba0987654321",
      })
    ).rejects.toThrow(/BLOQUEÓ/);
    // No debe haber escrito nada
    const drafts = existsSync(join(tmpRoot, "yo/drafts"))
      ? readdirSync(join(tmpRoot, "yo/drafts")).filter((f) =>
          f.endsWith(".md")
        )
      : [];
    expect(drafts).toHaveLength(0);
  });

  it("schema validation: scope=project requiere project_slug", async () => {
    await expect(
      yoAgregarBorrador(tmpRoot, {
        ...baseInput,
        scope: "project",
        // sin project_slug
      })
    ).rejects.toThrow(/project_slug/);
  });

  it("schema validation: title corto rechazado", async () => {
    await expect(
      yoAgregarBorrador(tmpRoot, { ...baseInput, title: "ab" })
    ).rejects.toThrow();
  });

  it("audit log se appende", async () => {
    await yoAgregarBorrador(tmpRoot, baseInput);
    const yearMonth = new Date().toISOString().slice(0, 7);
    const auditPath = join(
      tmpRoot,
      "yo",
      "audit",
      `audit-${yearMonth}.jsonl`
    );
    expect(existsSync(auditPath)).toBe(true);
    const content = await readFile(auditPath, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    const entry = JSON.parse(lines[lines.length - 1]);
    expect(entry.tool).toBe("yo_agregar_borrador");
    expect(entry.redactor_decision).toBe("clean");
    expect(typeof entry.fingerprint_input_hash).toBe("string");
  });
});
