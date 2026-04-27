import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { classifyMessage, type Classification } from "./classifier.js";

describe("classifyMessage", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("retorna fallback cuando no hay GEMINI_API_KEY", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await classifyMessage("hola, cómo estás?");
    expect(result.label).toBe("noise");
    expect(result.confidence).toBe(0);
    expect(result.fallback_used).toBe("no_gemini_api_key");
    expect(result.model).toBe("fallback");
    expect(result.candidates).toHaveLength(4);
  });

  it("retorna fallback con error cuando la API falla (HTTP error)", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "Service Unavailable",
      })
    );

    const result = await classifyMessage("mensaje de prueba");
    expect(result.fallback_used).toBe("gemini_api_error");
    expect(result.error).toContain("503");
  });

  it("retorna fallback con error cuando fetch lanza excepción", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const result = await classifyMessage("mensaje de prueba");
    expect(result.fallback_used).toBe("exception");
    expect(result.error).toBe("Network error");
  });

  it("parsea respuesta válida de Gemini correctamente", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const mockResponse: Classification = {
      label: "urgent_task",
      confidence: 0.95,
      candidates: [
        { label: "urgent_task", score: 0.95 },
        { label: "fyi", score: 0.03 },
        { label: "question", score: 0.01 },
        { label: "noise", score: 0.01 },
      ],
      model: "gemini/gemini-1.5-flash",
      latency_ms: 300,
      fallback_used: null,
      error: null,
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      label: "urgent_task",
                      confidence: 0.95,
                      candidates: mockResponse.candidates,
                    }),
                  },
                ],
              },
            },
          ],
        }),
      })
    );

    const result = await classifyMessage("Urgente: el sistema de pagos está caído");
    expect(result.label).toBe("urgent_task");
    expect(result.confidence).toBe(0.95);
    expect(result.candidates).toHaveLength(4);
    expect(result.fallback_used).toBeNull();
    expect(result.error).toBeNull();
    expect(result.model).toBe("gemini/gemini-1.5-flash");
  });

  it("normaliza confidence fuera de rango [0,1]", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      label: "fyi",
                      confidence: 1.5,
                      candidates: [],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      })
    );

    const result = await classifyMessage("info de actualización del sistema");
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  it("retorna fallback con error ante label inválido", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ label: "unknown_label", confidence: 0.9, candidates: [] }) }],
              },
            },
          ],
        }),
      })
    );

    const result = await classifyMessage("mensaje de prueba");
    expect(result.fallback_used).toBe("invalid_label");
    expect(result.error).toContain("unknown_label");
  });

  it("trunca texto largo a 2000 chars antes de enviar", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    let capturedBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (_url: string, opts: RequestInit) => {
        capturedBody = opts.body as string;
        return {
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    { text: JSON.stringify({ label: "noise", confidence: 0.9, candidates: [] }) },
                  ],
                },
              },
            ],
          }),
        };
      })
    );

    await classifyMessage("x".repeat(5000));
    const body = JSON.parse(capturedBody) as { contents: Array<{ parts: Array<{ text: string }> }> };
    const sentText = body.contents[0].parts[0].text;
    expect(sentText.length).toBeLessThanOrEqual(2000);
  });
});
