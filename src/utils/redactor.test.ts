import { describe, it, expect } from "vitest";
import {
  redactorScan,
  redactorDecision,
  scanCustomPatterns,
} from "./redactor.js";

describe("redactor — patterns custom", () => {
  it("texto limpio retorna 0 findings", () => {
    const result = scanCustomPatterns(
      "este es un texto sobre cómo configurar nginx con docker-compose."
    );
    expect(result).toHaveLength(0);
  });

  it("detecta key Anthropic estilo sk-ant-api03-...", () => {
    const text =
      "mi clave es sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMN-OPQRSTUV-XX_YY";
    const findings = scanCustomPatterns(text);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.type.startsWith("anthropic"))).toBe(true);
    // No leak: el snippet debe estar redacted
    expect(findings[0].snippet_redacted).toContain("REDACTED");
    expect(findings[0].severity).toBe("high");
  });

  it("detecta GitHub PAT (ghp_)", () => {
    const text = "GH_TOKEN=ghp_abcdefghij1234567890ABCDEFGHIJ12345678";
    const findings = scanCustomPatterns(text);
    expect(findings.some((f) => f.type === "github_pat")).toBe(true);
  });

  it("detecta Google API key (AIza)", () => {
    const text = "GEMINI_API_KEY=AIzaSyA-abc123DEFghi456JKLmno789PQRstu0AB";
    const findings = scanCustomPatterns(text);
    expect(findings.some((f) => f.type === "google_api_key")).toBe(true);
  });

  it("detecta JWT genérico (eyJ...)", () => {
    const text =
      "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSIsIm5hbWUiOiJUZXN0In0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    const findings = scanCustomPatterns(text);
    expect(findings.some((f) => f.type === "jwt_generic")).toBe(true);
  });

  it("detecta private key block", () => {
    const text =
      "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----";
    const findings = scanCustomPatterns(text);
    expect(findings.some((f) => f.type === "private_key_block")).toBe(true);
  });
});

describe("redactor — decisión", () => {
  it("0 findings → clean", () => {
    expect(redactorDecision([])).toBe("clean");
  });

  it("1 high → flagged", () => {
    expect(
      redactorDecision([
        {
          type: "anthropic_api_key",
          snippet_redacted: "sk-ant-…",
          position: 0,
          severity: "high",
          source: "custom",
        },
      ])
    ).toBe("flagged");
  });

  it("2+ high → blocked", () => {
    expect(
      redactorDecision([
        {
          type: "anthropic_api_key",
          snippet_redacted: "x",
          position: 0,
          severity: "high",
          source: "custom",
        },
        {
          type: "github_pat",
          snippet_redacted: "y",
          position: 10,
          severity: "high",
          source: "custom",
        },
      ])
    ).toBe("blocked");
  });

  it("solo medium/low → flagged", () => {
    expect(
      redactorDecision([
        {
          type: "bearer_token_prose",
          snippet_redacted: "x",
          position: 0,
          severity: "medium",
          source: "custom",
        },
      ])
    ).toBe("flagged");
  });
});

describe("redactor — pipeline async", () => {
  it("texto sin secretos retorna clean=true", async () => {
    const r = await redactorScan(
      "un draft markdown común sobre patrones de diseño y arquitectura."
    );
    expect(r.clean).toBe(true);
    expect(r.findings).toHaveLength(0);
  });

  it("texto con secret retorna clean=false con finding", async () => {
    const r = await redactorScan(
      "config: SUPABASE_KEY=sb_secret_abcdefghij1234567890_supersecret"
    );
    expect(r.clean).toBe(false);
    expect(r.findings.length).toBeGreaterThan(0);
  });
});
