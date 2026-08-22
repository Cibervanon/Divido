import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Credenciales públicas (anon/publishable): solo permiten escuchar canales
// Realtime. Storage y BD siempre pasan por la API, nunca por este cliente.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(url!, anonKey!, {
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null;
