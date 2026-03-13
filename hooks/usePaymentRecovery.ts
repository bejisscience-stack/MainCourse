import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Self-healing hook: calls /api/payments/keepz/verify-pending on mount
 * to recover any payments where the Keepz callback never arrived.
 * Calls onRecovered() if any enrollments were granted so callers can
 * revalidate their data.
 */
export function usePaymentRecovery(
  userId: string | null,
  onRecovered?: () => void,
) {
  const hasRun = useRef(false);

  useEffect(() => {
    if (!userId || hasRun.current) return;
    hasRun.current = true;

    (async () => {
      try {
        let {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          const {
            data: { session: refreshed },
          } = await supabase.auth.refreshSession();
          session = refreshed;
        }
        if (!session?.access_token) return;

        const res = await fetch("/api/payments/keepz/verify-pending", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;

        const data = await res.json();
        if (data.recovered > 0) {
          console.log(
            `[PaymentRecovery] Recovered ${data.recovered} payment(s)`,
          );
          onRecovered?.();
        }
      } catch {
        // Silent — this is a best-effort background check
      }
    })();
  }, [userId, onRecovered]);
}
