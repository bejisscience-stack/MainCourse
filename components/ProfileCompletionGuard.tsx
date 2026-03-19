"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";

const EXEMPT_PATHS = [
  "/complete-profile",
  "/login",
  "/signup",
  "/auth/",
  "/coming-soon",
  "/reset-password",
  "/privacy-policy",
  "/terms-and-conditions",
  "/refund-policy",
  "/personal-info-security",
];

export default function ProfileCompletionGuard() {
  const { user, profile, isLoading } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !user || !profile) return;

    const isExempt = EXEMPT_PATHS.some((p) => pathname.startsWith(p));
    if (isExempt) return;

    if (profile.profile_completed !== true) {
      router.replace("/complete-profile");
    }
  }, [isLoading, user, profile, pathname, router]);

  return null;
}
