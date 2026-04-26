import { z } from "zod";

export const YoDraftKindSchema = z.enum([
  "pattern",
  "gotcha",
  "decision",
  "stack-update",
  "workflow",
  "insight",
]);

export const YoDraftScopeSchema = z.enum(["global", "project"]);

export const YoDraftImportanceSchema = z
  .enum(["low", "medium", "high"])
  .default("medium");

export const YoDraftConfidenceSchema = z.enum(["low", "medium", "high"]);

export const YoSourceRefSchema = z.object({
  type: z.enum(["session", "file", "url", "conversation"]),
  ref: z.string().min(1),
});

export const YoSecretScanStatusSchema = z.enum([
  "pending",
  "clean",
  "flagged",
  "blocked",
]);

/**
 * Frontmatter de un draft: campos obligatorios y opcionales.
 * Los campos `id`, `secret_scan` y `created_at` los genera el servidor;
 * el caller no los pasa.
 */
export const YoDraftInputSchema = z
  .object({
    title: z
      .string()
      .min(3)
      .max(120)
      .describe("Título corto del draft (3-120 chars). Se usa para el slug."),
    body: z
      .string()
      .min(1)
      .describe("Contenido markdown del draft (sin frontmatter)."),
    kind: YoDraftKindSchema,
    scope: YoDraftScopeSchema,
    project_slug: z
      .string()
      .min(1)
      .optional()
      .describe("Obligatorio si scope=project."),
    importance: YoDraftImportanceSchema,
    confidence: YoDraftConfidenceSchema,
    source_ref: z.array(YoSourceRefSchema).min(1),
    tags: z.array(z.string()).default([]),
    session_id: z.string().min(1),
    expires_at: z.string().datetime({ offset: true }).optional(),
    supersedes: z.array(z.string()).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.scope === "project" && !val.project_slug) {
      ctx.addIssue({
        code: "custom",
        message: "project_slug es obligatorio cuando scope=project",
        path: ["project_slug"],
      });
    }
  });

export type YoDraftInput = z.infer<typeof YoDraftInputSchema>;

/**
 * Schema completo del frontmatter (lo que se serializa al markdown).
 * Incluye campos generados por el servidor.
 */
export const YoDraftFrontmatterSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: YoDraftKindSchema,
  scope: YoDraftScopeSchema,
  project_slug: z.string().optional(),
  importance: YoDraftImportanceSchema,
  confidence: YoDraftConfidenceSchema,
  source_ref: z.array(YoSourceRefSchema),
  tags: z.array(z.string()),
  session_id: z.string(),
  created_at: z.string(),
  expires_at: z.string().optional(),
  supersedes: z.array(z.string()).optional(),
  secret_scan: YoSecretScanStatusSchema,
  redactor_findings: z
    .array(
      z.object({
        type: z.string(),
        snippet_redacted: z.string(),
        position: z.number(),
        severity: z.enum(["low", "medium", "high"]),
      })
    )
    .optional(),
});

export type YoDraftFrontmatter = z.infer<typeof YoDraftFrontmatterSchema>;
