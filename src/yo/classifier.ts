import { getGeminiApiKey } from "../config.js";

export type ClassificationLabel = "urgent_task" | "fyi" | "question" | "noise";

export interface Candidate {
  label: ClassificationLabel;
  score: number;
}

export interface Classification {
  label: ClassificationLabel;
  confidence: number;
  candidates: Candidate[];
  model: string;
  latency_ms: number;
  fallback_used: string | null;
  error: string | null;
}

const SYSTEM_PROMPT = `Sos un clasificador de mensajes de WhatsApp para el sistema operativo de Nahuel.
Clasificá el mensaje en UNA de estas 4 categorías:

- urgent_task: requiere acción inmediata de Nahuel (cliente esperando, problema urgente, deadline, pedido concreto)
- question: pregunta que necesita respuesta pero no es urgente
- fyi: información relevante, update, notificación — sin acción requerida
- noise: spam, saludos, reacciones, mensajes sin relevancia operativa

Respondé SOLO con un JSON válido con este formato exacto (sin markdown, sin explicaciones):
{"label":"<label>","confidence":<0.0-1.0>,"candidates":[{"label":"urgent_task","score":<0-1>},{"label":"fyi","score":<0-1>},{"label":"question","score":<0-1>},{"label":"noise","score":<0-1>}]}`;

const VALID_LABELS: ClassificationLabel[] = ["urgent_task", "fyi", "question", "noise"];

function isValidLabel(s: string): s is ClassificationLabel {
  return VALID_LABELS.includes(s as ClassificationLabel);
}

function fallbackClassification(reason: string): Classification {
  return {
    label: "noise",
    confidence: 0,
    candidates: [
      { label: "urgent_task", score: 0 },
      { label: "fyi", score: 0 },
      { label: "question", score: 0 },
      { label: "noise", score: 1 },
    ],
    model: "fallback",
    latency_ms: 0,
    fallback_used: reason,
    error: null,
  };
}

export async function classifyMessage(text: string): Promise<Classification> {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    return fallbackClassification("no_gemini_api_key");
  }

  const t0 = Date.now();
  const model = "gemini-1.5-flash";

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: text.slice(0, 2000) }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 200,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    const latency_ms = Date.now() - t0;

    if (!response.ok) {
      const errText = await response.text();
      return {
        ...fallbackClassification("gemini_api_error"),
        latency_ms,
        error: `HTTP ${response.status}: ${errText.slice(0, 200)}`,
      };
    }

    const json = await response.json() as Record<string, unknown>;
    const rawText: string =
      (json?.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }>)?.[0]
        ?.content?.parts?.[0]?.text ?? "";

    const parsed = JSON.parse(rawText) as {
      label: string;
      confidence: number;
      candidates: Array<{ label: string; score: number }>;
    };

    if (!isValidLabel(parsed.label)) {
      return {
        ...fallbackClassification("invalid_label"),
        latency_ms,
        error: `Label inválido: ${parsed.label}`,
      };
    }

    return {
      label: parsed.label,
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
      candidates: (parsed.candidates ?? []).map((c) => ({
        label: isValidLabel(c.label) ? c.label : "noise",
        score: Math.min(1, Math.max(0, Number(c.score) || 0)),
      })),
      model: `gemini/${model}`,
      latency_ms,
      fallback_used: null,
      error: null,
    };
  } catch (err) {
    return {
      ...fallbackClassification("exception"),
      latency_ms: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
