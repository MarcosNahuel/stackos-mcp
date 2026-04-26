import { spawn } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

export interface GitResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}

const FLAGGED_PATTERNS = [
  /^yo\/drafts\/\.flagged\//,
  /^yo\/audit\/auth\//,
];

function runGit(
  cwd: string,
  args: string[],
  timeoutMs = 15_000
): Promise<GitResult> {
  return new Promise((resolve) => {
    const child = spawn("git", args, {
      cwd,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    }, timeoutMs);
    child.stdout.on("data", (b: Buffer) => (stdout += b.toString("utf8")));
    child.stderr.on("data", (b: Buffer) => (stderr += b.toString("utf8")));
    child.on("close", (code: number | null) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code,
      });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, stdout, stderr: stderr + String(err), code: -1 });
    });
  });
}

/**
 * Verifica que el repo no tenga staged paths que coincidan con FLAGGED_PATTERNS
 * (FIX M7 — defensa en profundidad antes de commit).
 *
 * Devuelve la lista de paths flageados; vacía si está limpio.
 */
export async function assertNoFlaggedStaged(
  repoRoot: string
): Promise<string[]> {
  if (!existsSync(join(repoRoot, ".git"))) return [];
  const r = await runGit(repoRoot, ["diff", "--cached", "--name-only"]);
  if (!r.ok) return [];
  const lines = r.stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return lines.filter((p) => FLAGGED_PATTERNS.some((re) => re.test(p)));
}

/**
 * Hace `git pull --rebase`. Best-effort, no rompe si no hay remote.
 */
export async function pullRebase(repoRoot: string): Promise<GitResult> {
  if (!existsSync(join(repoRoot, ".git"))) {
    return { ok: true, stdout: "[skip: not a git repo]", stderr: "", code: 0 };
  }
  return await runGit(repoRoot, ["pull", "--rebase"], 30_000);
}

/**
 * Stagea solo paths bajo `yo/` y commitea + pushea.
 *
 * - Falla loud si quedan paths flagged staged (assertion FIX M7).
 * - Si no hay cambios, retorna ok=true con mensaje específico.
 */
export async function commitAndPushYo(
  repoRoot: string,
  message: string
): Promise<GitResult> {
  if (!existsSync(join(repoRoot, ".git"))) {
    return { ok: true, stdout: "[skip: not a git repo]", stderr: "", code: 0 };
  }

  // Stagear solo yo/ — NO `git add -A` (evita capturar otros cambios)
  const add = await runGit(repoRoot, ["add", "yo"]);
  if (!add.ok) return add;

  const flagged = await assertNoFlaggedStaged(repoRoot);
  if (flagged.length > 0) {
    // Unstage todo para no quedar inconsistente
    await runGit(repoRoot, ["reset", "HEAD", "--", "yo"]);
    return {
      ok: false,
      stdout: "",
      stderr: `ABORT: paths flagged en staging (no van a Git): ${flagged.join(", ")}`,
      code: 99,
    };
  }

  // Si no hay nada staged → noop
  const diff = await runGit(repoRoot, ["diff", "--cached", "--quiet"]);
  if (diff.code === 0) {
    return {
      ok: true,
      stdout: "[noop: nothing staged]",
      stderr: "",
      code: 0,
    };
  }

  const commit = await runGit(repoRoot, [
    "commit",
    "-m",
    message,
    "--",
    "yo",
  ]);
  if (!commit.ok) return commit;

  const push = await runGit(repoRoot, ["push"], 30_000);
  return push;
}

/**
 * Async fire-and-forget wrapper: corre commit+push en background, no bloquea
 * el caller. Errores se loggean por consola (audit no es crítico para el caller).
 */
export function commitAndPushYoAsync(repoRoot: string, message: string): void {
  void commitAndPushYo(repoRoot, message)
    .then((r) => {
      if (!r.ok) {
        console.error(
          `[git-sync] commit+push falló: ${r.stderr || r.stdout}`
        );
      }
    })
    .catch((err) => {
      console.error(`[git-sync] error inesperado:`, err);
    });
}
