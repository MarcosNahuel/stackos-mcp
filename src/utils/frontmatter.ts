/**
 * Parsea YAML frontmatter básico de archivos SKILL.md.
 * Extrae name y description del bloque --- ... ---
 */
export interface SkillFrontmatter {
  name: string;
  description: string;
}

export function parseFrontmatter(content: string): SkillFrontmatter | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yaml = match[1];

  const nameMatch = yaml.match(/^name:\s*(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim() : "";

  // description puede ser multiline (con indentación)
  const descMatch = yaml.match(
    /^description:\s*(.*(?:\n(?:\s{2,}.+)*))/m
  );
  let description = "";
  if (descMatch) {
    description = descMatch[1]
      .split("\n")
      .map((line) => line.trim())
      .join(" ")
      .trim();
  }

  if (!name) return null;

  return { name, description };
}
