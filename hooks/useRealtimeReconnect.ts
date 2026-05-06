import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

// One shared monitor channel detects websocket disconnect → reconnect
// transitions and notifies all subscribers. Used in lieu of HTTP polling
// as a safety net for missed Realtime events.
const reconnectListeners = new Set<() => void>();
let monitorChannel: ReturnType<typeof supabase.channel> | null = null;
let lastStatus: "connected" | "disconnected" = "disconnected";
let hasEverConnected = false;

function ensureMonitor() {
  if (monitorChannel || typeof window === "undefined") return;

  monitorChannel = supabase
    .channel("app:reconnect-monitor")
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        // Only fire after a real disconnect → reconnect transition,
        // never on the initial connect.
        if (hasEverConnected && lastStatus === "disconnected") {
          for (const fn of reconnectListeners) {
            try {
              fn();
            } catch (err) {
              console.warn("[realtime-reconnect] listener error", err);
            }
          }
        }
        hasEverConnected = true;
        lastStatus = "connected";
      } else if (
        status === "CLOSED" ||
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT"
      ) {
        lastStatus = "disconnected";
      }
    });
}

/**
 * Fires `onReconnect` once whenever the Supabase Realtime websocket
 * reconnects after a drop. Use to issue a single catch-up fetch instead
 * of running an HTTP polling timer.
 *
 * The callback is held in a ref so callers can pass an inline function
 * without retriggering the effect.
 */
export function useRealtimeReconnect(onReconnect: () => void) {
  const cbRef = useRef(onReconnect);
  useEffect(() => {
    cbRef.current = onReconnect;
  }, [onReconnect]);

  useEffect(() => {
    ensureMonitor();
    const wrapper = () => {
      cbRef.current();
    };
    reconnectListeners.add(wrapper);
    return () => {
      reconnectListeners.delete(wrapper);
    };
  }, []);
}
