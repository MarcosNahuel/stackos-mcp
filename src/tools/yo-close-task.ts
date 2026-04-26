import { getYoSupabase } from "../utils/yo-supabase.js";

export interface YoCloseTaskResult {
  id: string;
  status: string;
  closed_at: string;
}

export async function yoCloseTask(
  id: string,
  resolution?: string
): Promise<YoCloseTaskResult> {
  if (!id || !id.trim()) {
    throw new Error("id de task es obligatorio.");
  }

  const supabase = getYoSupabase();

  // Patch metadata only si se pasó resolution. Hacemos merge en cliente.
  let metadataPatch: Record<string, unknown> | undefined;
  if (resolution && resolution.trim()) {
    const { data: existing, error: fetchErr } = await supabase
      .from("tasks")
      .select("metadata")
      .eq("id", id)
      .single();
    if (fetchErr) {
      throw new Error(`Error leyendo task ${id}: ${fetchErr.message}`);
    }
    const prevMeta =
      (existing?.metadata as Record<string, unknown> | null) ?? {};
    metadataPatch = { ...prevMeta, resolution };
  }

  const update: Record<string, unknown> = {
    status: "done",
    closed_at: new Date().toISOString(),
  };
  if (metadataPatch) update.metadata = metadataPatch;

  const { data, error } = await supabase
    .from("tasks")
    .update(update)
    .eq("id", id)
    .select("id, status, closed_at")
    .single();

  if (error) {
    throw new Error(`Error cerrando task ${id}: ${error.message}`);
  }
  if (!data) {
    throw new Error(`Task ${id} no encontrada.`);
  }

  return {
    id: data.id,
    status: data.status,
    closed_at: data.closed_at,
  };
}
