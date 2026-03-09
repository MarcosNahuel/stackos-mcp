import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { parseFrontmatter, type SkillFrontmatter } from "../utils/frontmatter.js";

export const listarSkillsDef = {
  name: "listar_skills",
  description:
    "Lista todos los skills y metodologías disponibles en STACKOS. Cada skill es una automatización que puede ejecutarse con Claude Code.",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
};

export function listarSkills(root: string): SkillFrontmatter[] {
  const skillsDir = join(root, ".claude", "skills");
  const results: SkillFrontmatter[] = [];

  let entries: string[];
  try {
    entries = readdirSync(skillsDir);
  } catch {
    throw new Error(`No se encontró el directorio de skills: ${skillsDir}`);
  }

  for (const entry of entries) {
    if (entry.startsWith("_") || entry.startsWith(".")) continue;

    const entryPath = join(skillsDir, entry);
    try {
      if (!statSync(entryPath).isDirectory()) continue;
    } catch {
      continue;
    }

    const skillFile = join(entryPath, "SKILL.md");
    let content: string;
    try {
      content = readFileSync(skillFile, "utf-8");
    } catch {
      continue;
    }

    const frontmatter = parseFrontmatter(content);
    if (frontmatter) {
      results.push(frontmatter);
    }
  }

  return results;
}
