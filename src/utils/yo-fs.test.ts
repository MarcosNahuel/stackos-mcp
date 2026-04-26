import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  slugify,
  generateDraftId,
  draftFilename,
  safeJoin,
  atomicWrite,
  buildDraftMarkdown,
  buildFrontmatter,
  readDraftFile,
  sha256,
} from "./yo-fs.js";
import type { YoDraftInput } from "../schemas/yo-draft.schema.js";

describe("slugify", () => {
  it("convierte título normal", () => {
    expect(slugify("Hola Mundo Cómo Estás")).toBe("hola-mundo-como-estas");
  });

  it("colapsa caracteres especiales", () => {
    expect(slugify("foo / bar / baz!")).toBe("foo-bar-baz");
  });

  it("trunca a 50 chars", () => {
    expect(slugify("a".repeat(80))).toHaveLength(50);
  });

  it("retorna 'draft' para input vacío", () => {
    expect(slugify("///!!!")).toBe("draft");
  });
});

describe("generateDraftId", () => {
  it("formato YYYYMMDDTHHmmssZ-<rand6>", () => {
    const id = generateDraftId(new Date("2026-04-26T12:34:56.789Z"));
    expect(id).toMatch(/^20260426T123456Z-[a-f0-9]{6}$/);
  });

  it("dos calls consecutivos producen ids distintos", () => {
    const a = generateDraftId();
    const b = generateDraftId();
    expect(a).not.toBe(b);
  });
});

describe("draftFilename", () => {
  it("combina id + slug", () => {
    expect(draftFilename("20260426T120000Z-abc123", "Mi Draft")).toBe(
      "20260426T120000Z-abc123-mi-draft.md"
    );
  });
});

describe("safeJoin", () => {
  it("path normal funciona", () => {
    const root = "/tmp/yo";
    const result = safeJoin(root, "drafts/test.md");
    expect(result.replace(/\\/g, "/").endsWith("/tmp/yo/drafts/test.md")).toBe(
      true
    );
  });

  it("path traversal con .. tira error", () => {
    expect(() => safeJoin("/tmp/yo", "../../etc/passwd")).toThrow(
      /Path inseguro/
    );
  });
});

describe("sha256", () => {
  it("hash determinista", () => {
    expect(sha256("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
  });
});

describe("atomic write + read draft", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "yo-fs-test-"));
  });

  afterEach(() => {
    try {
      rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("write + read recupera frontmatter", async () => {
    const input: YoDraftInput = {
      title: "Test draft",
      body: "Cuerpo del draft.\n\nPárrafo 2.",
      kind: "insight",
      scope: "global",
      importance: "medium",
      confidence: "high",
      source_ref: [{ type: "session", ref: "session-001" }],
      tags: ["test"],
      session_id: "session-001",
    };
    const fm = buildFrontmatter(
      input,
      "20260426T120000Z-aaaaaa",
      new Date("2026-04-26T12:00:00.000Z"),
      "clean"
    );
    const md = buildDraftMarkdown(fm, input.body);
    const abs = safeJoin(tmpRoot, "yo/drafts/test.md");
    await atomicWrite(abs, md);
    expect(existsSync(abs)).toBe(true);

    const parsed = await readDraftFile(tmpRoot, "yo/drafts/test.md");
    expect(parsed.frontmatter.id).toBe("20260426T120000Z-aaaaaa");
    expect(parsed.frontmatter.title).toBe("Test draft");
    expect(parsed.frontmatter.kind).toBe("insight");
    expect(parsed.frontmatter.secret_scan).toBe("clean");
    expect(parsed.body.trim()).toBe("Cuerpo del draft.\n\nPárrafo 2.");
  });
});
