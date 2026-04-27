// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = import("@supabase/supabase-js").SupabaseClient<any, any, any>;

/**
 * Resuelve project_slug desde un hint (basename del cwd).
 * 1. Lookup en yo.projects por repo_basename (lowercase).
 * 2. Fallback: basename normalizado (lowercase, trim).
 * 3. Si hint vacío, null.
 */
export async function resolveProjectSlug(
  hint: string,
  client: AnySupabaseClient,
): Promise<string | null> {
  const normalized = (hint || "").trim().toLowerCase();
  if (!normalized) return null;

  const { data } = await (client as any)
    .schema("yo")
    .from("projects")
    .select("slug")
    .eq("repo_basename", normalized)
    .maybeSingle();

  if (data?.slug) return data.slug;
  return normalized;
}
