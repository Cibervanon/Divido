import { useEffect, useRef } from "react";
import { supabase, supabaseEnabled } from "../lib/supabase";

/**
 * Suscripción a los cambios de un grupo vía Supabase Realtime (broadcast).
 * La API publica eventos tras cada mutación; aquí solo reaccionamos
 * refrescando datos por la vía segura (llamadas HTTP propias).
 */
export function useGroupChannel(groupId: string | undefined, onEvent: () => void) {
  const cb = useRef(onEvent);
  cb.current = onEvent;

  useEffect(() => {
    const client = supabase;
    if (!groupId || !supabaseEnabled || !client) return;
    const channel = client.channel(`grp:${groupId}`);
    channel.on("broadcast", { event: "*" }, () => cb.current());
    channel.subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [groupId]);
}

/** Canal personal por usuario: refresca la campana de notificaciones al vuelo. */
export function useUserChannel(userId: string | null | undefined, onEvent: () => void) {
  const cb = useRef(onEvent);
  cb.current = onEvent;

  useEffect(() => {
    const client = supabase;
    if (!userId || !supabaseEnabled || !client) return;
    const channel = client.channel(`usr:${userId}`);
    channel.on("broadcast", { event: "*" }, () => cb.current());
    channel.subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [userId]);
}
