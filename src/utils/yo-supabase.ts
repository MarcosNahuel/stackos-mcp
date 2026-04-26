import { createClient } from "@supabase/supabase-js";

type YoClient = ReturnType<typeof createYoClient>;

let cachedClient: YoClient | null = null;

function createYoClient(url: string, serviceKey: string) {
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: { schema: "yo" },
  });
}

/**
 * Singleton cliente Supabase para el sistema "yo".
 * Lee las env vars YO_SUPABASE_URL y YO_SUPABASE_SERVICE_KEY.
 * El cliente queda configurado para operar contra el schema `yo`.
 */
export function getYoSupabase(): YoClient {
  if (cachedClient) return cachedClient;

  const url = process.env.YO_SUPABASE_URL;
  const serviceKey = process.env.YO_SUPABASE_SERVICE_KEY;

  if (!url) {
    throw new Error(
      "YO_SUPABASE_URL no está definida. Configurar la env var apuntando al project Supabase del sistema yo."
    );
  }
  if (!serviceKey) {
    throw new Error(
      "YO_SUPABASE_SERVICE_KEY no está definida. Configurar la env var con la service role key del project Supabase del sistema yo."
    );
  }

  cachedClient = createYoClient(url, serviceKey);
  return cachedClient;
}
