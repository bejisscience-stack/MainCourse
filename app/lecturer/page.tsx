"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export default function LecturerRootPage() {
  const router = useRouter();

  useEffect(() => {
    const checkAndRedirect = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          router.push("/login");
          return;
        }

        // Fetch profile to check role and approval status
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, is_approved, lecturer_status")
          .eq("id", currentUser.id)
          .single();

        if (
          profile?.lecturer_status === "approved" ||
          (profile?.role === "lecturer" && profile?.is_approved === true)
        ) {
          router.push("/lecturer/dashboard");
        } else if (profile?.lecturer_status === "pending") {
          router.push("/lecturer/pending");
        } else {
          router.push("/");
        }
      } catch (error) {
        console.error("Error checking user:", error);
        router.push("/");
      }
    };

    checkAndRedirect();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-navy-900"></div>
        <p className="mt-4 text-navy-600">Redirecting...</p>
      </div>
    </div>
  );
}
