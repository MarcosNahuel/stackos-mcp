import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Lee la metodología SDD-STACKOS completa o las reglas universales.
 * Documentos clave para entender cómo funciona el sistema.
 */
export function leerMetodologia(
  root: string,
  documento: "sdd-stackos" | "reglas-universales" | "engram-usage"
): string {
  const paths: Record<string, string> = {
    "sdd-stackos": join(root, "docs", "sdd-stackos-methodology.md"),
    "reglas-universales": join(root, "standards", "reglas-universales.md"),
    "engram-usage": join(root, "standards", "engram-usage.md"),
  };

  const filePath = paths[documento];
  if (!filePath || !existsSync(filePath)) {
    throw new Error(
      `Documento "${documento}" no encontrado. Disponibles: sdd-stackos, reglas-universales, engram-usage`
    );
  }

  return readFileSync(filePath, "utf-8");
}
