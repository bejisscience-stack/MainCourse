"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/contexts/I18nContext";
import { supabase } from "@/lib/supabase";

function PaymentFailedContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("paymentId");
  const [redirectPath, setRedirectPath] = useState("/courses");

  useEffect(() => {
    if (!paymentId) return;

    const fetchCourseId = async () => {
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

      try {
        const res = await fetch(
          `/api/payments/keepz/status?paymentId=${paymentId}`,
          {
            headers: { Authorization: `Bearer ${session.access_token}` },
          },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.courseId) {
          setRedirectPath(`/courses/${data.courseId}`);
        }
      } catch {
        // Keep default /courses
      }
    };

    fetchCourseId();
  }, [paymentId]);

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-navy-900/95 border border-navy-800/60 rounded-2xl shadow-soft-xl p-8 text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          {t("paymentMethod.paymentFailed")}
        </h1>
        <p className="text-gray-400 mb-6">
          {t("paymentMethod.paymentFailedMessage")}
        </p>
        <button
          onClick={() => router.push(redirectPath)}
          className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold"
        >
          {t("paymentMethod.tryAgain")}
        </button>
      </div>
    </div>
  );
}

export default function PaymentFailedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-navy-950" />}>
      <PaymentFailedContent />
    </Suspense>
  );
}
