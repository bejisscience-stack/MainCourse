"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/contexts/I18nContext";
import Navigation from "@/components/Navigation";
import BackgroundShapes from "@/components/BackgroundShapes";

export default function LecturerPendingPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkApproval = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          router.push("/login");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, is_approved, lecturer_status")
          .eq("id", currentUser.id)
          .single();

        if (!profile || !profile.lecturer_status) {
          router.push("/");
          return;
        }

        // If already approved, redirect to dashboard
        if (profile.is_approved === true) {
          router.push("/lecturer/dashboard");
          return;
        }

        setChecking(false);
      } catch (error) {
        console.error("Error checking approval status:", error);
        setChecking(false);
      }
    };

    checkApproval();

    // Poll every 10 seconds to check if approved
    const interval = setInterval(checkApproval, 10000);
    return () => clearInterval(interval);
  }, [router]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  if (checking) {
    return (
      <main className="relative min-h-screen bg-white overflow-hidden">
        <BackgroundShapes />
        <Navigation />
        <div className="relative z-10 pt-24 pb-16 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-navy-900 mb-4"></div>
            <p className="text-navy-700">{t("common.loading")}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-white overflow-hidden">
      <BackgroundShapes />
      <Navigation />
      <div className="relative z-10 pt-24 pb-16 flex items-center justify-center min-h-[60vh]">
        <div className="max-w-lg mx-auto px-4 text-center">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 space-y-6">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
              <svg
                className="w-8 h-8 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-navy-900">
              {t("lecturerPending.title")}
            </h1>
            <p className="text-gray-600 leading-relaxed">
              {t("lecturerPending.description")}
            </p>
            <p className="text-sm text-gray-500">
              {t("lecturerPending.emailNotice")}
            </p>
            <button
              onClick={handleSignOut}
              className="px-6 py-3 bg-navy-900 text-white rounded-lg font-semibold hover:bg-navy-800 transition-colors"
            >
              {t("nav.signOut")}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
