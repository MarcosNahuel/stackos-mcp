import { existsSync } from "fs";
import { resolve } from "path";

const DEFAULT_ROOT = "D:/Proyectos/CONOCIMIENTO-NAHUEL";

export function getStackosRoot(): string {
  const root = process.env.STACKOS_ROOT || DEFAULT_ROOT;
  const resolved = resolve(root);

  if (!existsSync(resolved)) {
    throw new Error(
      `STACKOS_ROOT no existe: ${resolved}. Configurá la variable de entorno STACKOS_ROOT con la ruta al repo de conocimiento.`
    );
  }

  return resolved;
}

export function getTransportMode(): "stdio" | "http" {
  if (
    process.argv.includes("--http") ||
    process.env.MCP_TRANSPORT === "http"
  ) {
    return "http";
  }
  return "stdio";
}

export function getPort(): number {
  const portArg = process.argv.find((_, i, arr) => arr[i - 1] === "--port");
  if (portArg) return parseInt(portArg, 10);
  return parseInt(process.env.PORT || "3000", 10);
}

export function getApiKey(): string | undefined {
  return process.env.STACKOS_API_KEY;
}

export function getWebhookToken(): string | undefined {
  return process.env.SUPERYO_WEBHOOK_TOKEN;
}

export function isWebhookAuthRequired(): boolean {
  return process.env.SUPERYO_WEBHOOK_REQUIRE_AUTH === "true";
}

export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY;
}
