import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface UseRealtimeAdminWithdrawalRequestsOptions {
  enabled?: boolean;
  onChange?: () => void;
  onConnectionChange?: (connected: boolean) => void;
}

/**
 * Hook to subscribe to real-time updates for ALL withdrawal requests (admin view).
 * Fires `onChange` on any INSERT/UPDATE so the consumer can revalidate via the
 * canonical API endpoint (which decrypts profile PII server-side). We don't
 * embed `profiles(...)` here because `withdrawal_requests.user_id` references
 * `auth.users(id)`, not `public.profiles(id)`, so PostgREST cannot resolve it.
 */
export function useRealtimeAdminWithdrawalRequests({
  enabled = true,
  onChange,
  onConnectionChange,
}: UseRealtimeAdminWithdrawalRequestsOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const onChangeRef = useRef(onChange);
  const onConnectionChangeRef = useRef(onConnectionChange);

  useEffect(() => {
    onChangeRef.current = onChange;
    onConnectionChangeRef.current = onConnectionChange;
  }, [onChange, onConnectionChange]);

  useEffect(() => {
    if (!enabled) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    console.log("[RT Admin Withdrawal] Setting up subscription");

    const channel = supabase
      .channel("admin:withdrawal_requests")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "withdrawal_requests",
        },
        (payload) => {
          console.log("[RT Admin Withdrawal] INSERT received:", payload);

          if (
            !payload.new ||
            typeof payload.new !== "object" ||
            !("id" in payload.new)
          ) {
            console.error(
              "[RT Admin Withdrawal] Invalid payload: missing new.id",
            );
            return;
          }

          onChangeRef.current?.();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "withdrawal_requests",
        },
        (payload) => {
          console.log("[RT Admin Withdrawal] UPDATE received:", payload);

          if (
            !payload.new ||
            typeof payload.new !== "object" ||
            !("id" in payload.new)
          ) {
            console.error(
              "[RT Admin Withdrawal] Invalid payload: missing new.id",
            );
            return;
          }

          onChangeRef.current?.();
        },
      )
      .subscribe((status, err) => {
        console.log("[RT Admin Withdrawal] Subscription status:", status, err);

        const connected = status === "SUBSCRIBED";
        setIsConnected(connected);
        onConnectionChangeRef.current?.(connected);

        if (status === "CHANNEL_ERROR") {
          console.error("[RT Admin Withdrawal] Channel error:", err);
        } else if (status === "TIMED_OUT") {
          console.warn(
            "[RT Admin Withdrawal] Connection timed out, will retry...",
          );
        } else if (status === "CLOSED") {
          console.log("[RT Admin Withdrawal] Channel closed");
        }
      });

    channelRef.current = channel;

    return () => {
      console.log("[RT Admin Withdrawal] Cleaning up subscription");
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled]);

  return { isConnected };
}
