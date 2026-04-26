import { existsSync, readFileSync } from "fs";
import { z } from "zod";
import { appendAudit } from "./utils/audit-jsonl.js";
import { getStackosRoot } from "./config.js";

export const TokenSchema = z.object({
  name: z.string().min(1),
  value: z.string().min(16),
  scopes: z.array(z.string()).min(1),
  created_at: z.string().optional(),
  expires_at: z.string().optional(),
  description: z.string().optional(),
});

export const TokensFileSchema = z.object({
  tokens: z.array(TokenSchema),
});

export type Token = z.infer<typeof TokenSchema>;

interface AuthState {
  tokens: Token[];
  legacyApiKey?: string;
  loaded: boolean;
}

const state: AuthState = { tokens: [], loaded: false };

export function loadTokens(): AuthState {
  if (state.loaded) return state;

  const file = process.env.STACKOS_TOKENS_FILE;
  if (file && existsSync(file)) {
    try {
      const raw = readFileSync(file, "utf8");
      const parsed = TokensFileSchema.parse(JSON.parse(raw));
      state.tokens = parsed.tokens;
    } catch (err) {
      console.error(
        `[auth] STACKOS_TOKENS_FILE inválido (${file}): ${(err as Error).message}`
      );
      state.tokens = [];
    }
  }

  // Backward compat: si existe STACKOS_API_KEY, registramos un token "legacy" con scope *.
  const legacy = process.env.STACKOS_API_KEY;
  if (legacy) {
    state.legacyApiKey = legacy;
    if (!state.tokens.some((t) => t.value === legacy)) {
      state.tokens.push({
        name: "LEGACY_API_KEY",
        value: legacy,
        scopes: ["*"],
        description: "Compat con STACKOS_API_KEY env var",
      });
    }
  }

  state.loaded = true;
  return state;
}

/**
 * Resultado de validar un Bearer token contra los scopes requeridos.
 */
export interface AuthResult {
  ok: boolean;
  reason?: string;
  token?: Token;
}

export function authValid(scope: string, token: Token): boolean {
  if (token.scopes.includes("*")) return true;
  if (token.scopes.includes(scope)) return true;
  // Wildcard por prefijo: "tasks:*" matchea "tasks:read"
  for (const s of token.scopes) {
    if (s.endsWith(":*") && scope.startsWith(s.slice(0, -1))) return true;
  }
  return false;
}

export function tokenIsExpired(t: Token, now: Date = new Date()): boolean {
  if (!t.expires_at) return false;
  const exp = new Date(t.expires_at).getTime();
  if (Number.isNaN(exp)) return false;
  return exp < now.getTime();
}

/**
 * Valida un Bearer header contra la tokens DB.
 * Si no hay tokens cargadas, retorna ok=false con reason="no_tokens_configured".
 */
export function validateBearer(
  bearerHeader: string | undefined,
  scope: string
): AuthResult {
  loadTokens();
  if (state.tokens.length === 0) {
    return { ok: false, reason: "no_tokens_configured" };
  }
  if (!bearerHeader) {
    return { ok: false, reason: "no_authorization_header" };
  }
  if (!bearerHeader.startsWith("Bearer ")) {
    return { ok: false, reason: "invalid_authorization_header" };
  }
  const token = bearerHeader.slice("Bearer ".length).trim();
  const found = state.tokens.find((t) => t.value === token);
  if (!found) {
    return { ok: false, reason: "unknown_token" };
  }
  if (tokenIsExpired(found)) {
    return { ok: false, reason: "token_expired", token: found };
  }
  if (!authValid(scope, found)) {
    return { ok: false, reason: "scope_mismatch", token: found };
  }
  return { ok: true, token: found };
}

/**
 * Append a yo/audit/auth/audit-<YYYY-MM>.jsonl con el resultado del check.
 */
export async function logAuthAttempt(
  result: AuthResult,
  scope: string,
  toolName: string,
  ip: string | undefined
): Promise<void> {
  try {
    const root = getStackosRoot();
    await appendAudit(
      root,
      {
        tool: toolName,
        actor: result.token?.name,
        paths_touched: [],
        metadata: {
          result: result.ok ? "allowed" : "denied",
          reason: result.reason,
          scope_required: [scope],
          scope_granted: result.token?.scopes,
          ip,
        },
      },
      "auth"
    );
  } catch {
    // Audit es best-effort — no bloquea el request.
  }
}
