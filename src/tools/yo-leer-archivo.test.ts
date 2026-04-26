import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { yoLeerArchivo } from "./yo-leer-archivo.js";

describe("yo_leer_archivo", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "yo-leer-"));
    mkdirSync(join(tmpRoot, "yo", "global"), { recursive: true });
    mkdirSync(join(tmpRoot, "memory"), { recursive: true });
    mkdirSync(join(tmpRoot, "cockpit"), { recursive: true });
    writeFileSync(
      join(tmpRoot, "yo", "global", "insights.md"),
      "---\nname: test\n---\n# Hola\n",
      "utf8"
    );
    writeFileSync(
      join(tmpRoot, "memory", "secret.md"),
      "PRIVATE",
      "utf8"
    );
    writeFileSync(
      join(tmpRoot, "INDEX.md"),
      "# index",
      "utf8"
    );
    writeFileSync(
      join(tmpRoot, ".env"),
      "SECRET=foo",
      "utf8"
    );
  });

  afterEach(() => {
    try {
      rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("permite path en allowlist con frontmatter parseado", async () => {
    const r = await yoLeerArchivo(tmpRoot, { path: "yo/global/insights.md" });
    expect(r.content).toContain("Hola");
    expect(r.frontmatter_parsed?.name).toBe("test");
    expect(r.size_bytes).toBeGreaterThan(0);
  });

  it("permite top-level INDEX.md", async () => {
    const r = await yoLeerArchivo(tmpRoot, { path: "INDEX.md" });
    expect(r.content).toBe("# index");
  });

  it("rechaza memory/", async () => {
    await expect(
      yoLeerArchivo(tmpRoot, { path: "memory/secret.md" })
    ).rejects.toThrow(/no permitido/);
  });

  it("rechaza cockpit/", async () => {
    await expect(
      yoLeerArchivo(tmpRoot, { path: "cockpit/anything.md" })
    ).rejects.toThrow(/no permitido/);
  });

  it("rechaza .env", async () => {
    await expect(yoLeerArchivo(tmpRoot, { path: ".env" })).rejects.toThrow(
      /no permitido/
    );
  });

  it("rechaza path traversal", async () => {
    await expect(
      yoLeerArchivo(tmpRoot, { path: "yo/../memory/secret.md" })
    ).rejects.toThrow();
  });
});
