import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface UseRealtimeKycQueueOptions {
  enabled?: boolean;
  onChange: () => void;
}

/**
 * Subscribes to live changes on `kyc_submissions` for the admin queue.
 * The table is added to supabase_realtime in migration 225. RLS gates
 * who can subscribe, so non-admins receive no events.
 */
export function useRealtimeKycQueue({
  enabled = true,
  onChange,
}: UseRealtimeKycQueueOptions) {
  const cbRef = useRef(onChange);
  useEffect(() => {
    cbRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel("admin-kyc-submissions-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "kyc_submissions",
        },
        () => {
          cbRef.current();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled]);
}
