import { mkdir, open, unlink, writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { tmpdir } from "os";
import { setTimeout as sleep } from "timers/promises";

const DEFAULT_TIMEOUT_MS = 5_000;
const POLL_INTERVAL_MS = 100;
const STALE_LOCK_MS = 30_000;

export interface LockHandle {
  path: string;
  release(): Promise<void>;
}

/**
 * Lockfile cooperativo basado en filesystem. Crea `<root>/.locks/<operation>.lock`
 * de forma exclusiva (`O_EXCL`) y lo libera con `release()`.
 *
 * Si el lock existe pero su mtime es más viejo que `STALE_LOCK_MS`, lo considera
 * stale y lo borra (proceso muerto sin liberar).
 */
export async function acquireLock(
  root: string,
  operation: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<LockHandle> {
  const lockDir = join(root, ".locks");
  if (!existsSync(lockDir)) {
    await mkdir(lockDir, { recursive: true });
  }

  const lockPath = join(lockDir, `${operation}.lock`);
  const start = Date.now();

  while (true) {
    try {
      const fh = await open(lockPath, "wx");
      const payload = JSON.stringify({
        pid: process.pid,
        operation,
        acquired_at: new Date().toISOString(),
      });
      await fh.writeFile(payload, "utf8");
      await fh.close();

      return {
        path: lockPath,
        release: async () => {
          try {
            await unlink(lockPath);
          } catch {
            // ignorar — lock ya borrado
          }
        },
      };
    } catch (err) {
      // EEXIST = lock activo. Chequear si está stale.
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "EEXIST") {
        try {
          const content = await readFile(lockPath, "utf8");
          const parsed = JSON.parse(content) as { acquired_at?: string };
          const acquiredAt = parsed.acquired_at
            ? new Date(parsed.acquired_at).getTime()
            : 0;
          if (Date.now() - acquiredAt > STALE_LOCK_MS) {
            await unlink(lockPath);
            continue;
          }
        } catch {
          // payload corrupto -> tratar como stale
          try {
            await unlink(lockPath);
            continue;
          } catch {
            // race: otro proceso lo borró
          }
        }
      } else {
        throw err;
      }
    }

    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `Timeout (${timeoutMs}ms) esperando lock para operación "${operation}".`
      );
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

/**
 * Wrapper que adquiere un lock, ejecuta la función y libera siempre.
 */
export async function withLock<T>(
  root: string,
  operation: string,
  fn: () => Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const lock = await acquireLock(root, operation, timeoutMs);
  try {
    return await fn();
  } finally {
    await lock.release();
  }
}
