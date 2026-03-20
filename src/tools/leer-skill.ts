import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Lee el contenido completo de un skill específico (SKILL.md).
 * Permite a un alumno estudiar el workflow completo de cualquier skill.
 */
export function leerSkill(root: string, nombre: string): string {
  // Sanitizar nombre
  const safe = nombre.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
  const skillFile = join(root, ".claude", "skills", safe, "SKILL.md");

  if (!existsSync(skillFile)) {
    // Intentar con nombre original (case-sensitive)
    const skillFile2 = join(root, ".claude", "skills", nombre, "SKILL.md");
    if (!existsSync(skillFile2)) {
      throw new Error(
        `Skill "${nombre}" no encontrado. Usá listar_skills para ver los disponibles.`
      );
    }
    return readFileSync(skillFile2, "utf-8");
  }

  return readFileSync(skillFile, "utf-8");
}
