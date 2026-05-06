import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Subscribes to live changes on the `channels` table for a given course
 * and to renames/deletes on the `courses` row itself. Fires `onChange`
 * (debounced) whenever something relevant changes so the caller can
 * re-fetch its server/channel structure.
 */
export function useRealtimeChannels(
  courseId: string | null,
  onChange: () => void,
) {
  const cbRef = useRef(onChange);
  useEffect(() => {
    cbRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!courseId) return;

    let pending: NodeJS.Timeout | null = null;
    const fire = () => {
      if (pending) clearTimeout(pending);
      // Debounce: many writes in a row (bulk channel inserts) collapse
      // into one refetch.
      pending = setTimeout(() => {
        pending = null;
        cbRef.current();
      }, 250);
    };

    const channel = supabase
      .channel(`course-structure:${courseId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channels",
          filter: `course_id=eq.${courseId}`,
        },
        fire,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "courses",
          filter: `id=eq.${courseId}`,
        },
        fire,
      )
      .subscribe();

    return () => {
      if (pending) clearTimeout(pending);
      supabase.removeChannel(channel);
    };
  }, [courseId]);
}
