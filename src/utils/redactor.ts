import { execFileSync } from "child_process";
import { writeFileSync, unlinkSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

export type RedactorSeverity = "low" | "medium" | "high";

export interface RedactorFinding {
  type: string;
  snippet_redacted: string;
  position: number;
  severity: RedactorSeverity;
  source: "custom" | "secretlint" | "gitleaks";
}

export interface RedactorScanResult {
  clean: boolean;
  findings: RedactorFinding[];
}

export type RedactorDecision = "clean" | "flagged" | "blocked";

interface PatternDef {
  type: string;
  regex: RegExp;
  severity: RedactorSeverity;
}

/**
 * Patrones custom para 2026. Cada match:
 *  - high: token claramente secreto (alta probabilidad de fuga real)
 *  - medium: pattern sospechoso
 *  - low: heurístico (puede ser falso positivo)
 *
 * NOTA: estos patterns son deliberadamente conservadores; preferimos falsos
 * positivos (flag) sobre falsos negativos (leak).
 */
const CUSTOM_PATTERNS: PatternDef[] = [
  // Anthropic
  {
    type: "anthropic_api_key",
    regex: /sk-ant-(?:api|admin)[0-9]{2}-[A-Za-z0-9_\-]{60,}/g,
    severity: "high",
  },
  {
    type: "anthropic_api_key_loose",
    regex: /sk-ant-[A-Za-z0-9_\-]{20,}/g,
    severity: "high",
  },
  // OpenAI 2024+
  {
    type: "openai_project_key",
    regex: /sk-proj-[A-Za-z0-9_\-]{20,}/g,
    severity: "high",
  },
  {
    type: "openai_service_key",
    regex: /sk-svcacct-[A-Za-z0-9_\-]{20,}/g,
    severity: "high",
  },
  {
    type: "openai_legacy_key",
    regex: /\bsk-[A-Za-z0-9]{32,}\b/g,
    severity: "high",
  },
  // Vercel
  {
    type: "vercel_token",
    regex: /\bvcp_[A-Za-z0-9]{20,}/g,
    severity: "high",
  },
  // Supabase
  {
    type: "supabase_secret",
    regex: /\bsb_secret_[A-Za-z0-9_\-]{16,}/g,
    severity: "high",
  },
  {
    type: "supabase_publishable",
    regex: /\bsb_publishable_[A-Za-z0-9_\-]{16,}/g,
    severity: "low",
  },
  // Google API
  {
    type: "google_api_key",
    regex: /\bAIza[0-9A-Za-z_\-]{35}/g,
    severity: "high",
  },
  // GitHub
  {
    type: "github_pat",
    regex: /\bghp_[A-Za-z0-9]{36}/g,
    severity: "high",
  },
  {
    type: "github_oauth",
    regex: /\bgho_[A-Za-z0-9]{36}/g,
    severity: "high",
  },
  {
    type: "github_app",
    regex: /\bghs_[A-Za-z0-9]{36}/g,
    severity: "high",
  },
  // GitLab
  {
    type: "gitlab_pat",
    regex: /\bglpat-[A-Za-z0-9_\-]{20}/g,
    severity: "high",
  },
  // Generic high-entropy bearer in prose
  {
    type: "bearer_token_prose",
    regex: /\b[Bb]earer\s+[A-Za-z0-9_\-]{32,}/g,
    severity: "medium",
  },
  // Slack
  {
    type: "slack_token",
    regex: /\bxox[abposr]-[A-Za-z0-9-]{10,48}/g,
    severity: "high",
  },
  // AWS access key
  {
    type: "aws_access_key",
    regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
    severity: "high",
  },
  // Stripe
  {
    type: "stripe_secret",
    regex: /\bsk_live_[A-Za-z0-9]{24,}/g,
    severity: "high",
  },
  {
    type: "stripe_test",
    regex: /\bsk_test_[A-Za-z0-9]{24,}/g,
    severity: "medium",
  },
  // Generic JWT
  {
    type: "jwt_generic",
    regex:
      /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_\-]{10,}/g,
    severity: "medium",
  },
  // RSA / SSH private key markers
  {
    type: "private_key_block",
    regex:
      /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED |PGP )?PRIVATE KEY-----/g,
    severity: "high",
  },
];

/**
 * Reemplaza el match por un snippet seguro: primeros 8 chars + asteriscos.
 */
function redactSnippet(match: string): string {
  const head = match.slice(0, 8);
  return `${head}…[REDACTED ${match.length} chars]`;
}

/**
 * Escaneo deterministic con regex.
 */
export function scanCustomPatterns(text: string): RedactorFinding[] {
  const findings: RedactorFinding[] = [];
  const seen = new Set<string>();
  for (const p of CUSTOM_PATTERNS) {
    const re = new RegExp(p.regex.source, p.regex.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const matchText = m[0];
      const dedupKey = `${p.type}:${m.index}:${matchText}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      findings.push({
        type: p.type,
        snippet_redacted: redactSnippet(matchText),
        position: m.index,
        severity: p.severity,
        source: "custom",
      });
    }
  }
  return findings;
}

/**
 * Secretlint embebido (segunda opinión).
 * Si falla la carga (ESM/transitivos), se loggea pero no rompe el scan.
 */
async function scanSecretlint(text: string): Promise<RedactorFinding[]> {
  try {
    const { lintSource } = await import("@secretlint/core");
    const presetMod = await import(
      "@secretlint/secretlint-rule-preset-recommend"
    );
    const preset =
      (presetMod as { default?: unknown }).default ??
      (presetMod as { creator?: unknown }).creator ??
      presetMod;
    if (!preset) return [];

    const result = await lintSource({
      source: {
        filePath: "draft.md",
        content: text,
        contentType: "text",
      },
      options: {
        config: {
          rules: [
            {
              id: "@secretlint/secretlint-rule-preset-recommend",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              rule: preset as any,
            },
          ],
        },
        maskSecrets: true,
      },
    });

    return (result.messages ?? []).map((msg) => ({
      type: `secretlint:${msg.ruleId ?? "unknown"}`,
      snippet_redacted: msg.message?.slice(0, 80) ?? "[secretlint]",
      position: typeof msg.range?.[0] === "number" ? msg.range[0] : 0,
      severity: "high" as RedactorSeverity,
      source: "secretlint" as const,
    }));
  } catch {
    return [];
  }
}

/**
 * Gitleaks via child_process si está disponible en PATH.
 * Si no está: skip silencioso.
 */
function scanGitleaks(text: string): RedactorFinding[] {
  try {
    execFileSync("gitleaks", ["version"], {
      stdio: ["ignore", "ignore", "ignore"],
      timeout: 2000,
    });
  } catch {
    return [];
  }

  const tmpDir = mkdtempSync(join(tmpdir(), "yo-redactor-"));
  const filePath = join(tmpDir, "scan.txt");
  const reportPath = join(tmpDir, "report.json");
  try {
    writeFileSync(filePath, text, "utf8");
    try {
      execFileSync(
        "gitleaks",
        [
          "detect",
          "--no-git",
          "--source",
          tmpDir,
          "--report-path",
          reportPath,
          "--report-format",
          "json",
          "--exit-code",
          "0",
        ],
        { stdio: ["ignore", "ignore", "ignore"], timeout: 10_000 }
      );
    } catch {
      return [];
    }

    let parsed: Array<{ Description?: string; RuleID?: string }>;
    try {
      const fs = require("fs") as typeof import("fs");
      const content = fs.readFileSync(reportPath, "utf8");
      parsed = JSON.parse(content);
    } catch {
      return [];
    }

    return (parsed ?? []).map((r) => ({
      type: `gitleaks:${r.RuleID ?? "unknown"}`,
      snippet_redacted: r.Description?.slice(0, 80) ?? "[gitleaks]",
      position: 0,
      severity: "high" as RedactorSeverity,
      source: "gitleaks" as const,
    }));
  } finally {
    try {
      unlinkSync(filePath);
    } catch {
      /* ignore */
    }
    try {
      unlinkSync(reportPath);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Pipeline de scan: custom patterns + secretlint + gitleaks (best-effort).
 */
export async function redactorScan(text: string): Promise<RedactorScanResult> {
  const customFindings = scanCustomPatterns(text);
  const secretlintFindings = await scanSecretlint(text);
  const gitleaksFindings = scanGitleaks(text);

  const findings = [
    ...customFindings,
    ...secretlintFindings,
    ...gitleaksFindings,
  ];

  return {
    clean: findings.length === 0,
    findings,
  };
}

/**
 * Decide el comportamiento según los findings:
 *  - clean: 0 findings
 *  - flagged: 1+ findings cualquier severidad → escribe a .flagged/
 *  - blocked: 2+ findings high-severity → reject sin escribir
 */
export function redactorDecision(
  findings: RedactorFinding[]
): RedactorDecision {
  if (findings.length === 0) return "clean";

  const highCount = findings.filter((f) => f.severity === "high").length;
  if (highCount >= 2) return "blocked";

  // 1 high O cualquier cantidad de medium/low → flagged
  return "flagged";
}
