import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface Profile {
  id: string;
  balance: number;
  bank_account_number?: string | null;
  [key: string]: any;
}

interface UseRealtimeUserProfileOptions {
  userId: string | null;
  onProfileUpdated?: (profile: Profile) => void;
  onBalanceChanged?: (newBalance: number, oldBalance: number) => void;
}

/**
 * Hook to subscribe to real-time updates for a user's profile
 * Useful for catching balance changes and other profile updates
 */
export function useRealtimeUserProfile({
  userId,
  onProfileUpdated,
  onBalanceChanged,
}: UseRealtimeUserProfileOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const onProfileUpdatedRef = useRef(onProfileUpdated);
  const onBalanceChangedRef = useRef(onBalanceChanged);

  useEffect(() => {
    onProfileUpdatedRef.current = onProfileUpdated;
    onBalanceChangedRef.current = onBalanceChanged;
  }, [onProfileUpdated, onBalanceChanged]);

  useEffect(() => {
    if (!userId) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const channel = supabase
      .channel(`profile:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          if (!payload.new || typeof payload.new !== "object") {
            return;
          }

          const newProfile = payload.new as Profile;
          const oldProfile = payload.old as Partial<Profile> | null;

          // Check for balance change
          if (
            onBalanceChangedRef.current &&
            oldProfile?.balance !== undefined &&
            newProfile.balance !== oldProfile.balance
          ) {
            onBalanceChangedRef.current(newProfile.balance, oldProfile.balance);
          }

          // Always call onProfileUpdated
          if (onProfileUpdatedRef.current) {
            onProfileUpdatedRef.current(newProfile);
          }
        },
      )
      .subscribe((status, err) => {
        const connected = status === "SUBSCRIBED";
        setIsConnected(connected);

        if (status === "CHANNEL_ERROR") {
          console.error("[RT Profile] Channel error:", err);
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);

  return { isConnected };
}
