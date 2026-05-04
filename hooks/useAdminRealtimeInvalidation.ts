import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export const ADMIN_ANALYTICS_TABLES = [
  "keepz_payments",
  "enrollment_requests",
  "bundle_enrollment_requests",
  "profiles",
  "referrals",
  "projects",
  "project_submissions",
  "submission_reviews",
  "messages",
  "enrollments",
  "balance_transactions",
  "withdrawal_requests",
  "courses",
  "course_bundles",
  "coming_soon_emails",
  "email_send_history",
  "platform_settings",
] as const;

interface UseAdminRealtimeInvalidationOptions {
  channelName: string;
  enabled?: boolean;
  tables?: readonly string[];
  debounceMs?: number;
  onChange: () => void;
}

export function useAdminRealtimeInvalidation({
  channelName,
  enabled = true,
  tables = ADMIN_ANALYTICS_TABLES,
  debounceMs = 400,
  onChange,
}: UseAdminRealtimeInvalidationOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const onChangeRef = useRef(onChange);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled) {
      setIsConnected(false);
      return;
    }

    let channel = supabase.channel(channelName);
    const scheduleChange = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        onChangeRef.current();
      }, debounceMs);
    };

    for (const table of tables) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        scheduleChange,
      );
    }

    channel.subscribe((status) => {
      setIsConnected(status === "SUBSCRIBED");
    });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsConnected(false);
      supabase.removeChannel(channel);
    };
  }, [channelName, debounceMs, enabled, tables]);

  return { isConnected };
}
