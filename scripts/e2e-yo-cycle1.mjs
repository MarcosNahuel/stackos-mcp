#!/usr/bin/env node
// E2E del flujo Cycle 1 contra el repo CN real (D:/Proyectos/CONOCIMIENTO-NAHUEL/yo).
// Crea drafts en una sub-carpeta de prueba para no contaminar yo/.

import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { yoAgregarBorrador } from "../dist/tools/yo-agregar-borrador.js";
import { yoListarBorradores } from "../dist/tools/yo-listar-borradores.js";
import { yoIntegrarBorrador } from "../dist/tools/yo-integrar-borrador.js";
import { yoDescartarBorrador } from "../dist/tools/yo-descartar-borrador.js";
import { yoStatus } from "../dist/tools/yo-status.js";
import { yoLeerArchivo } from "../dist/tools/yo-leer-archivo.js";

const tmp = mkdtempSync(join(tmpdir(), "yo-e2e-"));
console.log(`[E2E] root=${tmp}`);

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.error(`  ✗ ${label}`); }
}

try {
  // 1. agregar_borrador — clean
  console.log("\n[1] yo_agregar_borrador — clean draft");
  const d1 = await yoAgregarBorrador(tmp, {
    title: "Cycle 1 — exact_idempotency baseline",
    body: "Primer insight real de la Session 2. Validar que SHA-256 normalizado por párrafo cubre el caso de re-integrar el mismo draft sin duplicados.\n\nFix M2 default proposal evita corromper memoria curada.",
    kind: "insight",
    scope: "global",
    importance: "high",
    confidence: "high",
    source_ref: [{ type: "session", ref: "session-2-2026-04-26" }],
    tags: ["cycle-1", "yo"],
    session_id: "session-2-2026-04-26",
  });
  assert(d1.flagged === false && d1.path.startsWith("yo/drafts/"), "draft clean → yo/drafts/");
  assert(d1.redactor_decision === "clean", "redactor_decision === clean");

  // 2. agregar_borrador — flagged (1 high → flagged)
  console.log("\n[2] yo_agregar_borrador — flagged (Bearer token medium severity)");
  const d2 = await yoAgregarBorrador(tmp, {
    title: "Test redactor flagged",
    body: "Vi un Bearer abcdefghij1234567890ABCDEFGHIJKLMNOPQRSTUV12 hardcoded en producción.",
    kind: "gotcha",
    scope: "global",
    importance: "low",
    confidence: "low",
    source_ref: [{ type: "session", ref: "e2e" }],
    session_id: "e2e",
  });
  assert(d2.flagged === true && d2.path.includes(".flagged/"), "draft flagged → yo/drafts/.flagged/");
  assert(d2.findings_count > 0, "findings_count > 0");

  // 3. agregar_borrador — blocked (2 high → throws)
  console.log("\n[3] yo_agregar_borrador — blocked (2 high severity)");
  let blocked = false;
  try {
    await yoAgregarBorrador(tmp, {
      title: "Test blocked",
      body: "anthropic sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA y github ghp_zyxwvutsrqponmlkjihgfedcba0987654321",
      kind: "gotcha",
      scope: "global",
      importance: "low",
      confidence: "low",
      source_ref: [{ type: "session", ref: "e2e" }],
      session_id: "e2e",
    });
  } catch (err) {
    blocked = /BLOQUEÓ/.test(err.message);
  }
  assert(blocked, "redactor BLOQUEÓ con 2+ high severity findings");

  // 4. listar_borradores
  console.log("\n[4] yo_listar_borradores");
  const list = await yoListarBorradores(tmp, {});
  assert(list.length === 2, `lista contiene 2 drafts (got ${list.length})`);
  assert(list.some(d => d.flagged === true), "incluye 1 flagged");

  // 5. integrar_borrador — proposal default (FIX M2)
  console.log("\n[5] yo_integrar_borrador — DEFAULT (proposal, FIX M2)");
  const proposal = await yoIntegrarBorrador(tmp, {
    draft_id: d1.draft_id,
    target_path: "yo/global/insights.md",
  });
  assert(proposal.accion === "proposal", `accion=proposal (got ${proposal.accion})`);
  assert(proposal.proposal_path === "yo/global/insights.md.proposal.md", "proposal_path correcto");
  // target NO debe existir (no se tocó)
  const fs = await import("fs");
  assert(!fs.existsSync(join(tmp, "yo/global/insights.md")), "target NO existe (proposal no toca target)");
  assert(fs.existsSync(join(tmp, "yo/global/insights.md.proposal.md")), "proposal.md SI existe");
  assert(fs.existsSync(join(tmp, d1.path)), "draft sigue en drafts/ (no archivado por proposal)");

  // 6. integrar_borrador — apply
  console.log("\n[6] yo_integrar_borrador — apply (merge real)");
  const applied = await yoIntegrarBorrador(tmp, {
    draft_id: d1.draft_id,
    accion: "apply",
    target_path: "yo/global/insights.md",
  });
  assert(applied.accion === "apply", "accion=apply");
  assert(applied.paragraphs_to_append === 2, `paragraphs_to_append=2 (got ${applied.paragraphs_to_append})`);
  assert(fs.existsSync(join(tmp, "yo/global/insights.md")), "target existe post-apply");
  assert(!fs.existsSync(join(tmp, d1.path)), "draft archivado post-apply");

  // 7. descartar el flagged
  console.log("\n[7] yo_descartar_borrador — flagged");
  const disc = await yoDescartarBorrador(tmp, {
    draft_id: d2.draft_id,
    reason: "test E2E",
  });
  assert(disc.archived_to.startsWith("yo/.archive/discarded/"), "archived_to → yo/.archive/discarded/");

  // 8. status post-cierre
  console.log("\n[8] yo_status");
  const status = await yoStatus(tmp);
  assert(status.drafts_pending === 0, `drafts_pending=0 (got ${status.drafts_pending})`);
  assert(status.drafts_flagged === 0, `drafts_flagged=0 (got ${status.drafts_flagged})`);
  assert(status.archives.integrated >= 1, "archives.integrated >= 1");
  assert(status.archives.discarded >= 1, "archives.discarded >= 1");
  assert(status.audit_log_today_path.endsWith(".jsonl"), "audit_log_today_path .jsonl");
  assert(status.audit_log_today_path.includes("audit-2026-"), "audit log usa rotación mensual (FIX M6)");

  // 9. leer_archivo allowlist
  console.log("\n[9] yo_leer_archivo — allowlist");
  const r = await yoLeerArchivo(tmp, { path: "yo/global/insights.md" });
  assert(r.size_bytes > 0, "archivo existe + size > 0");
  let denied = false;
  try {
    await yoLeerArchivo(tmp, { path: "memory/anything.md" });
  } catch { denied = true; }
  assert(denied, "memory/ DENIED");

  // Idempotencia: re-integrar con apply otro draft idéntico no duplica
  console.log("\n[10] idempotencia exact_match (FIX M1)");
  const d3 = await yoAgregarBorrador(tmp, {
    title: "Re-test mismo contenido",
    body: "Primer insight real de la Session 2. Validar que SHA-256 normalizado por párrafo cubre el caso de re-integrar el mismo draft sin duplicados.\n\nFix M2 default proposal evita corromper memoria curada.",
    kind: "insight",
    scope: "global",
    importance: "high",
    confidence: "high",
    source_ref: [{ type: "session", ref: "session-2" }],
    session_id: "session-2",
  });
  const reapplied = await yoIntegrarBorrador(tmp, {
    draft_id: d3.draft_id,
    accion: "apply",
    target_path: "yo/global/insights.md",
  });
  assert(reapplied.paragraphs_to_append === 0, `idempotencia: 0 nuevos párrafos (got ${reapplied.paragraphs_to_append})`);
  assert(reapplied.paragraphs_already_present === 2, "2 párrafos already_present");

  console.log(`\n[E2E] DONE — ${pass} passed, ${fail} failed`);
} finally {
  try { rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
}

if (fail > 0) process.exit(1);
