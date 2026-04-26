import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execSync } from "child_process";
import { assertNoFlaggedStaged } from "./git-sync.js";

describe("git-sync — assertion FIX M7", () => {
  it("retorna lista vacía si no es repo git", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "yo-git-"));
    try {
      const r = await assertNoFlaggedStaged(tmp);
      expect(r).toEqual([]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("detecta paths staged en yo/drafts/.flagged/ y yo/audit/auth/", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "yo-git-"));
    try {
      execSync("git init", { cwd: tmp, stdio: "ignore" });
      execSync('git config user.email "test@test"', {
        cwd: tmp,
        stdio: "ignore",
      });
      execSync('git config user.name "test"', {
        cwd: tmp,
        stdio: "ignore",
      });

      mkdirSync(join(tmp, "yo", "drafts", ".flagged"), { recursive: true });
      mkdirSync(join(tmp, "yo", "audit", "auth"), { recursive: true });
      writeFileSync(
        join(tmp, "yo", "drafts", ".flagged", "leak.md"),
        "secret: sk-ant-xxx",
        "utf8"
      );
      writeFileSync(
        join(tmp, "yo", "audit", "auth", "today.jsonl"),
        '{"ok":true}\n',
        "utf8"
      );

      // Forzar add a pesar de gitignore (simulando bug)
      execSync("git add -f yo/drafts/.flagged/leak.md yo/audit/auth/today.jsonl", {
        cwd: tmp,
        stdio: "ignore",
      });

      const flagged = await assertNoFlaggedStaged(tmp);
      expect(flagged.length).toBe(2);
      expect(flagged).toContain("yo/drafts/.flagged/leak.md");
      expect(flagged).toContain("yo/audit/auth/today.jsonl");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
