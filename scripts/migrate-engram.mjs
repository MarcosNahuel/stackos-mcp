#!/usr/bin/env node
/**
 * Migración del contenido de Claude Code auto-memory (engram) al sistema yo.
 *
 * Decisión: COEXISTIR — auto-memory queda intacta como caché local; solo
 * copiamos el contenido como import legacy bajo yo/imports/.
 *
 * Uso:
 *   node scripts/migrate-engram.mjs
 *   node scripts/migrate-engram.mjs --source <path> --target <path>
 *   node scripts/migrate-engram.mjs --dry-run
 */

import { existsSync, readdirSync, statSync, copyFileSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { resolve, join, basename } from "path";

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");

function getArg(name, fallback) {
  const idx = args.indexOf(name);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

const HOME = process.env.USERPROFILE || process.env.HOME || "C:/Users/nahue";
const DEFAULT_SOURCE = join(
  HOME,
  ".claude",
  "projects",
  "D--Proyectos-CONOCIMIENTO-NAHUEL",
  "memory"
);
const DEFAULT_TARGET_ROOT =
  process.env.STACKOS_ROOT || "D:/Proyectos/CONOCIMIENTO-NAHUEL";

const sourceDir = resolve(getArg("--source", DEFAULT_SOURCE));
const targetRoot = resolve(getArg("--target", DEFAULT_TARGET_ROOT));
const dateStamp = new Date().toISOString().slice(0, 10);
const targetDir = join(targetRoot, "yo", "imports", `claude-memory-${dateStamp}`);

console.log(`[migrate-engram] source=${sourceDir}`);
console.log(`[migrate-engram] target=${targetDir}`);
console.log(`[migrate-engram] dry-run=${isDryRun}`);

if (!existsSync(sourceDir)) {
  console.error(`ERROR: source no existe: ${sourceDir}`);
  process.exit(1);
}

const files = readdirSync(sourceDir)
  .filter((f) => f.endsWith(".md"))
  .map((f) => ({ name: f, abs: join(sourceDir, f) }))
  .filter((f) => statSync(f.abs).isFile());

if (files.length === 0) {
  console.log("[migrate-engram] no hay archivos .md para migrar.");
  process.exit(0);
}

if (!isDryRun && !existsSync(targetDir)) {
  mkdirSync(targetDir, { recursive: true });
}

const report = [];
for (const f of files) {
  const targetPath = join(targetDir, f.name);
  const stat = statSync(f.abs);
  const sizeKb = (stat.size / 1024).toFixed(1);

  // Sugerencia de promoción heurística
  let promotion = "yo/imports/ (revisar manualmente)";
  if (f.name.startsWith("project_")) {
    const slug = f.name.replace(/^project_/, "").replace(/\.md$/, "").replace(/_/g, "-");
    promotion = `yo/projects/${slug}.md`;
  } else if (f.name.startsWith("user_")) {
    promotion = `yo/global/insights.md (curar a Nahuel-only si aplica)`;
  } else if (f.name === "MEMORY.md") {
    promotion = "índice — reemplazado por yo/README.md, archivar referencia";
  }

  if (!isDryRun) {
    copyFileSync(f.abs, targetPath);
  }
  report.push({
    name: f.name,
    size_kb: sizeKb,
    target_path: targetPath,
    promotion_hint: promotion,
  });
  console.log(`  ${isDryRun ? "[DRY]" : "[OK]"} ${f.name} (${sizeKb} KB) → ${promotion}`);
}

// MIGRATION-REPORT.md
const reportPath = join(targetDir, "MIGRATION-REPORT.md");
const reportContent = `---
name: Migración Claude auto-memory → yo
description: Reporte de migración de memory/ legacy al sistema yo (Cycle 1, decisión COEXISTIR yo primary)
date: ${dateStamp}
source: ${sourceDir.replace(/\\/g, "/")}
files_count: ${files.length}
---

# Migración Claude auto-memory → \`yo\` — ${dateStamp}

Decisión: **COEXISTIR (\`yo\` primary)** — ver \`docs/research/2026-04-26-engram-vs-yo-memory.md\`.

Auto-memory de Claude Code queda como caché local por máquina/proyecto sin sync. Este import es la fotografía estática de \`memory/\` al ${dateStamp}; \`yo/\` es la memoria canónica de aquí en adelante.

## Origen

- \`${sourceDir.replace(/\\/g, "/")}\`
- ${files.length} archivos \`.md\` migrados.

## Archivos importados

| Archivo | Tamaño | Sugerencia de promoción |
|---------|--------|-------------------------|
${report
  .map(
    (r) =>
      `| \`${r.name}\` | ${r.size_kb} KB | ${r.promotion_hint} |`
  )
  .join("\n")}

## Próximos pasos (curación manual)

1. **Revisar cada archivo** en \`yo/imports/claude-memory-${dateStamp}/\`.
2. **Promover** decisiones / insights reutilizables a \`yo/global/insights.md\` o \`yo/projects/<slug>.md\` via \`yo_agregar_borrador\` + \`yo_integrar_borrador\` (action=apply).
3. **Descartar** lo que no aplica: borrar de \`yo/imports/\` (los originales en \`${sourceDir.replace(/\\/g, "/")}\` quedan intactos).
4. **No re-importar**: este import es una sola fotografía. Auto-memory sigue funcionando local sin sync.

## Política operativa

- Auto-memory (\`~/.claude/projects/.../memory/\`): caché local, no sync, no source of truth.
- \`yo/\`: source of truth, compartida via Git, gestionada por tools \`yo_*\` con redactor + audit.
- Reglas completas: \`docs/research/2026-04-26-engram-vs-yo-memory.md\` §10.
`;

if (!isDryRun) {
  writeFileSync(reportPath, reportContent, "utf8");
  console.log(`\n[migrate-engram] reporte → ${reportPath}`);
} else {
  console.log("\n[DRY] reporte sería escrito en:", reportPath);
}
console.log(`[migrate-engram] ${files.length} archivos ${isDryRun ? "listados" : "migrados"}.`);
