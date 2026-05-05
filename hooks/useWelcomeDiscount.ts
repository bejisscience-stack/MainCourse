"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/hooks/useUser";
import { isWelcomeWindowActive } from "@/lib/pricing";

interface WelcomeDiscountState {
  active: boolean;
  expiresAt: Date | null;
  secondsRemaining: number | null;
}

function computeState(
  expiresIso: string | null | undefined,
): WelcomeDiscountState {
  if (!expiresIso)
    return { active: false, expiresAt: null, secondsRemaining: null };
  const expiresAt = new Date(expiresIso);
  const ms = expiresAt.getTime() - Date.now();
  if (Number.isNaN(expiresAt.getTime()) || ms <= 0) {
    return { active: false, expiresAt, secondsRemaining: 0 };
  }
  return {
    active: true,
    expiresAt,
    secondsRemaining: Math.floor(ms / 1000),
  };
}

/**
 * Returns the current user's welcome-discount state and ticks every second
 * while the window is active. Logged-out users get { active: false, ... }.
 */
export function useWelcomeDiscount(): WelcomeDiscountState {
  const { profile } = useUser();
  const expiresIso = profile?.welcome_discount_expires_at ?? null;

  const [state, setState] = useState<WelcomeDiscountState>(() =>
    computeState(expiresIso),
  );

  useEffect(() => {
    setState(computeState(expiresIso));

    if (!isWelcomeWindowActive(expiresIso)) return;

    const interval = setInterval(() => {
      setState((prev) => {
        const next = computeState(expiresIso);
        // Stop the interval once the window flips inactive.
        if (!next.active && prev.active) {
          clearInterval(interval);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresIso]);

  return state;
}
