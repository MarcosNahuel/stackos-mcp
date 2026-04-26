import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { acquireLock, withLock } from "./lockfile.js";

describe("lockfile", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "yo-lock-"));
  });

  afterEach(() => {
    try {
      rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("acquire + release funciona", async () => {
    const lock = await acquireLock(tmpRoot, "test-op");
    expect(existsSync(lock.path)).toBe(true);
    await lock.release();
    expect(existsSync(lock.path)).toBe(false);
  });

  it("withLock libera incluso con throw", async () => {
    await expect(
      withLock(tmpRoot, "boom", async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    // El lock debe estar liberado
    const lockPath = join(tmpRoot, ".locks", "boom.lock");
    expect(existsSync(lockPath)).toBe(false);
  });

  it("contention: segundo intento espera y timeoutea si no se libera", async () => {
    const first = await acquireLock(tmpRoot, "busy");
    const start = Date.now();
    await expect(acquireLock(tmpRoot, "busy", 800)).rejects.toThrow(
      /Timeout/
    );
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(700);
    await first.release();
  });

  it("dos withLock consecutivos serializan", async () => {
    const order: string[] = [];
    await Promise.all([
      withLock(tmpRoot, "serial", async () => {
        order.push("a-start");
        await new Promise((r) => setTimeout(r, 200));
        order.push("a-end");
      }),
      withLock(tmpRoot, "serial", async () => {
        order.push("b-start");
        await new Promise((r) => setTimeout(r, 50));
        order.push("b-end");
      }),
    ]);
    // Tienen que NO solaparse (cada bloque a o b está continuo)
    expect(order[0]).toMatch(/-start$/);
    expect(order[1]).toMatch(/-end$/);
    expect(order[2]).toMatch(/-start$/);
    expect(order[3]).toMatch(/-end$/);
  });
});
