import { sha256 } from "./yo-fs.js";

export interface ParagraphRecord {
  text: string;
  hash: string;
  index: number;
}

/**
 * Normaliza un párrafo para hashing (idempotencia exacta, FIX M1).
 *
 * NO es dedupe semántico — es exact_match: dos párrafos con el mismo texto
 * (módulo whitespace y unicode normalization) producen el mismo hash y por
 * lo tanto se consideran idempotentes para evitar duplicar al integrar.
 *
 * Reglas:
 *  - Trim leading/trailing whitespace.
 *  - Colapsa runs de whitespace internos a un solo espacio.
 *  - NFC unicode normalization.
 *  - Preserva case (code/headings importan).
 */
export function normalizeParagraph(p: string): string {
  return p.normalize("NFC").trim().replace(/\s+/g, " ");
}

/**
 * Split de un body markdown en párrafos por `\n\s*\n`. Filtra párrafos vacíos.
 */
export function splitParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Devuelve registros con texto, hash y posición ordinal.
 */
export function paragraphRecords(body: string): ParagraphRecord[] {
  return splitParagraphs(body).map((text, index) => ({
    text,
    hash: sha256(normalizeParagraph(text)),
    index,
  }));
}

export interface ExactIdempotencyResult {
  /** Párrafos del draft que aún no existen en target (van a integrarse). */
  toAppend: ParagraphRecord[];
  /** Párrafos del draft que ya existen en target (skip por idempotencia). */
  alreadyPresent: ParagraphRecord[];
  /** Hashes presentes en target (informativo). */
  targetHashes: string[];
}

/**
 * Compara párrafos del draft contra los del target.
 * Si un párrafo del draft tiene un hash igual a uno presente en target,
 * se considera idempotente (no se re-aplica). El resto va a `toAppend`.
 *
 * NOTA (FIX M1): este es exact_idempotency, no dedupe semántico. Paráfrasis
 * y reordenamientos van a `toAppend`. Si necesitás detección semántica,
 * Cycle 1 V2 con embeddings.
 */
export function exactIdempotency(
  draftBody: string,
  targetBody: string
): ExactIdempotencyResult {
  const draftRecords = paragraphRecords(draftBody);
  const targetRecords = paragraphRecords(targetBody);
  const targetHashes = new Set(targetRecords.map((r) => r.hash));

  const toAppend: ParagraphRecord[] = [];
  const alreadyPresent: ParagraphRecord[] = [];
  for (const dr of draftRecords) {
    if (targetHashes.has(dr.hash)) {
      alreadyPresent.push(dr);
    } else {
      toAppend.push(dr);
    }
  }
  return {
    toAppend,
    alreadyPresent,
    targetHashes: Array.from(targetHashes),
  };
}
