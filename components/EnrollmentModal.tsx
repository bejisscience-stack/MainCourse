"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { usePostHog } from "posthog-js/react";
import type { Course } from "./CourseCard";
import { useI18n } from "@/contexts/I18nContext";
import { useUser } from "@/hooks/useUser";
import { supabase } from "@/lib/supabase";
import { getReferral } from "@/lib/referral-storage";
import { useSavedCards, type SavedCard } from "@/hooks/useSavedCards";
import { usePaymentRecovery } from "@/hooks/usePaymentRecovery";

type KeepzMethod = "all";

interface EnrollmentModalProps {
  course: Course;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialReferralCode?: string;
  enrollmentMode?: "course" | "bundle";
  isReEnrollment?: boolean;
}

function formatCardMask(mask: string): string {
  // "411111******1111" → "**** 1111"
  const last4 = mask.replace(/\*/g, "").slice(-4);
  return `•••• ${last4}`;
}

export default function EnrollmentModal({
  course,
  isOpen,
  onClose,
  onSuccess,
  initialReferralCode,
  enrollmentMode = "course",
  isReEnrollment = false,
}: EnrollmentModalProps) {
  const { t } = useI18n();
  const { profile } = useUser();
  const posthog = usePostHog();
  const {
    cards,
    isLoading: cardsLoading,
    deleteCard,
    mutate: mutateSavedCards,
  } = useSavedCards();
  const [mounted, setMounted] = useState(false);

  // Track enrollment modal open
  useEffect(() => {
    if (isOpen && posthog) {
      posthog.capture("enrollment_started", {
        course_id: course.id,
        course_title: course.title,
        enrollment_mode: enrollmentMode,
        is_re_enrollment: isReEnrollment,
        price: course.price,
      });
    }
  }, [
    isOpen,
    course.id,
    course.title,
    enrollmentMode,
    isReEnrollment,
    course.price,
    posthog,
  ]);

  // Recover any stuck payments when modal opens
  usePaymentRecovery(isOpen ? profile?.id || null : null, onSuccess);

  const [referralCode, setReferralCode] = useState("");
  const [referralValidation, setReferralValidation] = useState<
    "idle" | "validating" | "valid" | "invalid"
  >("idle");
  const [referralMessage, setReferralMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<KeepzMethod | null>(
    null,
  );
  const [saveCardChecked, setSaveCardChecked] = useState(false);

  // Inline payment processing state (for saved card payments)
  const [tokenPaymentStatus, setTokenPaymentStatus] = useState<
    null | "processing" | "success" | "failed"
  >(null);
  const [payingWithCardId, setPayingWithCardId] = useState<string | null>(null);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Reset state and auto-fill referral when opened
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsSubmitting(false);
      setReferralValidation("idle");
      setReferralMessage("");
      setSelectedMethod(null);
      setTokenPaymentStatus(null);
      setPayingWithCardId(null);
      setSaveCardChecked(false);

      // Auto-fill referral code: props > persistent storage > profile
      let code = initialReferralCode || "";
      if (!code) {
        const persistent = getReferral();
        if (persistent) code = persistent;
      }
      if (!code && profile?.signup_referral_code) {
        code = profile.signup_referral_code;
      }
      setReferralCode(code);
    }
  }, [isOpen, course, profile, initialReferralCode]);

  // ESC key and body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        !isSubmitting &&
        tokenPaymentStatus !== "processing"
      )
        onClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, isSubmitting, tokenPaymentStatus, onClose]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const validateReferralCode = useCallback(async (code: string) => {
    if (!code.trim()) {
      setReferralValidation("idle");
      setReferralMessage("");
      return;
    }
    setReferralValidation("validating");
    setReferralMessage("");
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
      if (!session?.access_token) {
        setReferralValidation("invalid");
        setReferralMessage("Please log in to validate referral code");
        return;
      }
      const response = await fetch("/api/validate-referral-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ referralCode: code.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setReferralValidation("invalid");
        setReferralMessage(data.error || "Failed to validate referral code");
      } else if (data.valid) {
        setReferralValidation("valid");
        setReferralMessage("Valid referral code");
      } else {
        setReferralValidation("invalid");
        setReferralMessage("Invalid referral code");
      }
    } catch {
      setReferralValidation("invalid");
      setReferralMessage("Failed to validate referral code");
    }
  }, []);

  const handleReferralChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.toUpperCase().trim();
      setReferralCode(value);
      setReferralValidation("idle");
      setReferralMessage("");

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (!value) return;

      debounceTimerRef.current = setTimeout(() => {
        validateReferralCode(value);
      }, 500);
    },
    [validateReferralCode],
  );

  // Poll payment status for saved card (inline) payments
  const pollPaymentStatus = useCallback(
    async (paymentId: string, token: string) => {
      let attempts = 0;
      const maxAttempts = 15;

      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

      pollIntervalRef.current = setInterval(async () => {
        attempts++;
        try {
          const res = await fetch(
            `/api/payments/keepz/status?paymentId=${paymentId}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          if (!res.ok) return;

          const data = await res.json();
          if (data.status === "success") {
            clearInterval(pollIntervalRef.current!);
            pollIntervalRef.current = null;
            setTokenPaymentStatus("success");
            posthog?.capture("enrollment_completed", {
              course_id: course.id,
              course_title: course.title,
              enrollment_mode: enrollmentMode,
              payment_method: "saved_card",
              price: course.price,
            });
            // Auto-close and trigger success after brief delay
            setTimeout(() => {
              onSuccess?.();
              onClose();
            }, 1500);
          } else if (data.status === "failed") {
            clearInterval(pollIntervalRef.current!);
            pollIntervalRef.current = null;
            setTokenPaymentStatus("failed");
            setError(t("paymentMethod.savedCardFailed"));
          }
        } catch {
          // Continue polling on network errors
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          // Payment might still succeed via callback — redirect to status page
          window.location.href = `/payment/success?paymentId=${paymentId}`;
        }
      }, 2000);
    },
    [onSuccess, onClose, t],
  );

  // Pay with saved card (no redirect)
  const handlePayWithSavedCard = useCallback(
    async (savedCardId: string) => {
      setError(null);
      setPayingWithCardId(savedCardId);
      setTokenPaymentStatus("processing");

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
        if (!session?.access_token) throw new Error("Not authenticated");
        const token = session.access_token;

        let enrollmentRequestId: string;

        if (enrollmentMode === "bundle") {
          const enrollResponse = await fetch(
            "/api/bundle-enrollment-requests",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                bundleId: course.id,
                payment_method: "keepz",
                referralCode: referralCode.trim() || undefined,
              }),
            },
          );
          if (!enrollResponse.ok) {
            const errData = await enrollResponse.json();
            throw new Error(
              errData.error || "Failed to create enrollment request",
            );
          }
          const { request } = await enrollResponse.json();
          enrollmentRequestId = request.id;
        } else {
          const enrollResponse = await fetch("/api/enrollment-requests", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              courseId: course.id,
              payment_method: "keepz",
              referralCode: referralCode.trim() || undefined,
              isReEnrollment: isReEnrollment || undefined,
            }),
          });
          if (!enrollResponse.ok) {
            const errData = await enrollResponse.json();
            throw new Error(
              errData.error || "Failed to create enrollment request",
            );
          }
          const { request } = await enrollResponse.json();
          enrollmentRequestId = request.id;
        }

        const paymentType =
          enrollmentMode === "bundle"
            ? "bundle_enrollment"
            : "course_enrollment";
        const orderResponse = await fetch("/api/payments/keepz/create-order", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            paymentType,
            referenceId: enrollmentRequestId,
            savedCardId,
          }),
        });

        if (!orderResponse.ok) {
          let errMsg = "Failed to process payment";
          try {
            const errData = await orderResponse.json();
            errMsg = errData.error || errMsg;
          } catch {
            if (orderResponse.status === 504)
              errMsg = "Payment gateway timed out. Please try again.";
          }
          throw new Error(errMsg);
        }

        const orderData = await orderResponse.json();

        if (orderData.processing) {
          // Token charge — poll for result
          pollPaymentStatus(orderData.paymentId, token);
        } else if (orderData.checkoutUrl) {
          // Fallback: redirect (shouldn't happen with cardToken, but handle gracefully)
          window.location.href = orderData.checkoutUrl;
        }
      } catch (err: any) {
        console.error("Saved card payment error:", err);
        setError(err.message || "Something went wrong. Please try again.");
        setTokenPaymentStatus("failed");
        setPayingWithCardId(null);
      }
    },
    [
      course.id,
      enrollmentMode,
      referralCode,
      isReEnrollment,
      pollPaymentStatus,
    ],
  );

  // Regular pay (redirect flow)
  const handlePay = useCallback(
    async (method: KeepzMethod) => {
      setError(null);
      setIsSubmitting(true);
      setSelectedMethod(method);

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
        if (!session?.access_token) throw new Error("Not authenticated");
        const token = session.access_token;

        let enrollmentRequestId: string;

        if (enrollmentMode === "bundle") {
          const enrollResponse = await fetch(
            "/api/bundle-enrollment-requests",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                bundleId: course.id,
                payment_method: "keepz",
                referralCode: referralCode.trim() || undefined,
              }),
            },
          );
          if (!enrollResponse.ok) {
            const errData = await enrollResponse.json();
            throw new Error(
              errData.error || "Failed to create enrollment request",
            );
          }
          const { request } = await enrollResponse.json();
          enrollmentRequestId = request.id;
        } else {
          const enrollResponse = await fetch("/api/enrollment-requests", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              courseId: course.id,
              payment_method: "keepz",
              referralCode: referralCode.trim() || undefined,
              isReEnrollment: isReEnrollment || undefined,
            }),
          });
          if (!enrollResponse.ok) {
            const errData = await enrollResponse.json();
            throw new Error(
              errData.error || "Failed to create enrollment request",
            );
          }
          const { request } = await enrollResponse.json();
          enrollmentRequestId = request.id;
        }

        const paymentType =
          enrollmentMode === "bundle"
            ? "bundle_enrollment"
            : "course_enrollment";
        const orderResponse = await fetch("/api/payments/keepz/create-order", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            paymentType,
            referenceId: enrollmentRequestId,
            keepzMethod: method,
            saveCard: saveCardChecked || undefined,
          }),
        });
        if (!orderResponse.ok) {
          let errMsg = "Failed to create payment";
          try {
            const errData = await orderResponse.json();
            errMsg = errData.error || errMsg;
          } catch {
            if (orderResponse.status === 504)
              errMsg = "Payment gateway timed out. Please try again.";
          }
          throw new Error(errMsg);
        }
        const { checkoutUrl } = await orderResponse.json();

        posthog?.capture("payment_initiated", {
          course_id: course.id,
          course_title: course.title,
          enrollment_mode: enrollmentMode,
          payment_method: method,
          price: course.price,
        });

        window.location.href = checkoutUrl;
      } catch (err: any) {
        console.error("Enrollment payment error:", err);
        posthog?.capture("payment_failed", {
          course_id: course.id,
          enrollment_mode: enrollmentMode,
          error: err.message,
        });
        setError(err.message || "Something went wrong. Please try again.");
        setIsSubmitting(false);
        setSelectedMethod(null);
      }
    },
    [course.id, enrollmentMode, referralCode, isReEnrollment, saveCardChecked],
  );

  const handleDeleteCard = useCallback(
    async (cardId: string) => {
      if (!confirm(t("paymentMethod.deleteCardConfirm"))) return;
      setDeletingCardId(cardId);
      const success = await deleteCard(cardId);
      setDeletingCardId(null);
      if (!success) {
        setError("Failed to remove card");
      }
    },
    [deleteCard, t],
  );

  if (!isOpen || !mounted || typeof document === "undefined") return null;

  const price = course.price || 0;
  const isPayDisabled =
    isSubmitting ||
    referralValidation === "validating" ||
    tokenPaymentStatus === "processing";
  const hasSavedCards = cards.length > 0;

  // Course type badge styling
  const courseTypeStyles: Record<
    string,
    { bg: string; text: string; border: string; gradient: string }
  > = {
    Editing: {
      bg: "bg-purple-100/90 dark:bg-purple-500/20",
      text: "text-purple-700 dark:text-purple-300",
      border: "border-purple-200/60 dark:border-purple-500/30",
      gradient: "from-purple-600 via-purple-800 to-charcoal-950",
    },
    "Content Creation": {
      bg: "bg-cyan-100/90 dark:bg-cyan-500/20",
      text: "text-cyan-700 dark:text-cyan-300",
      border: "border-cyan-200/60 dark:border-cyan-500/30",
      gradient: "from-cyan-600 via-cyan-800 to-charcoal-950",
    },
    "Website Creation": {
      bg: "bg-amber-100/90 dark:bg-amber-500/20",
      text: "text-amber-700 dark:text-amber-300",
      border: "border-amber-200/60 dark:border-amber-500/30",
      gradient: "from-amber-600 via-amber-800 to-charcoal-950",
    },
  };
  const typeStyle =
    courseTypeStyles[course.course_type] || courseTypeStyles.Editing;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/70 dark:bg-black/85 z-[9999] flex items-center justify-center p-3 md:p-6 animate-fade-in"
      onClick={() => {
        if (!isSubmitting && tokenPaymentStatus !== "processing") onClose();
      }}
    >
      <div
        className="relative w-full max-w-md md:max-w-3xl bg-white dark:bg-navy-900 border border-gray-200/80 dark:border-navy-700/80 rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button — floats above everything */}
        <button
          onClick={onClose}
          disabled={isSubmitting || tokenPaymentStatus === "processing"}
          className="absolute top-3 right-3 z-30 p-2 rounded-full bg-black/30 dark:bg-black/50 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/50 transition-all disabled:opacity-50"
          aria-label={t("common.close")}
        >
          <svg
            className="w-4 h-4"
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
        </button>

        {/* Two-panel grid: payment left, media right (stacked on mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-5 max-h-[90vh]">
          {/* ===== MEDIA PANEL (right on desktop, top on mobile) ===== */}
          <div className="relative md:col-span-3 md:order-2 h-48 md:h-auto md:min-h-[420px] bg-charcoal-950 overflow-hidden">
            {course.intro_video_url ? (
              <video
                src={course.intro_video_url}
                poster={course.thumbnail_url || undefined}
                controls
                playsInline
                preload="metadata"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : course.thumbnail_url ? (
              <img
                src={course.thumbnail_url}
                alt={course.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div
                className={`absolute inset-0 bg-gradient-to-br ${typeStyle.gradient}`}
              >
                <div className="absolute inset-0 flex items-center justify-center opacity-15">
                  {course.course_type === "Editing" && (
                    <svg
                      className="w-24 h-24 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  )}
                  {course.course_type === "Content Creation" && (
                    <svg
                      className="w-24 h-24 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                  {course.course_type === "Website Creation" && (
                    <svg
                      className="w-24 h-24 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                      />
                    </svg>
                  )}
                </div>
              </div>
            )}

            {/* Bottom gradient scrim */}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

            {/* Course info overlay */}
            <div className="absolute inset-x-0 bottom-0 p-5 md:p-6 z-10">
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold ${typeStyle.bg} ${typeStyle.text} border ${typeStyle.border} backdrop-blur-sm mb-2.5`}
              >
                {course.course_type}
              </div>
              <h2 className="text-lg md:text-xl font-bold text-white leading-tight line-clamp-2 drop-shadow-md">
                {course.title}
              </h2>
              <p className="text-sm text-white/70 mt-1">{course.creator}</p>
            </div>
          </div>

          {/* ===== PAYMENT PANEL (left on desktop, bottom on mobile) ===== */}
          <div className="relative md:col-span-2 md:order-1 flex flex-col overflow-y-auto md:max-h-[90vh]">
            {/* Processing overlay — scoped to payment panel */}
            {tokenPaymentStatus === "processing" && (
              <div className="absolute inset-0 z-20 bg-white/90 dark:bg-navy-900/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 animate-fade-in">
                <svg
                  className="animate-spin w-8 h-8 text-emerald-500"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <p className="text-sm font-medium text-charcoal-800 dark:text-gray-300">
                  {t("paymentMethod.savedCardProcessing")}
                </p>
              </div>
            )}

            {tokenPaymentStatus === "success" && (
              <div className="absolute inset-0 z-20 bg-white/90 dark:bg-navy-900/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 animate-fade-in">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <svg
                    className="w-7 h-7 text-emerald-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  {t("paymentMethod.savedCardSuccess")}
                </p>
              </div>
            )}

            {/* Price header */}
            <div className="p-5 pb-4 md:pt-6">
              <div className="flex items-baseline gap-2.5">
                <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
                  ₾{price.toFixed(2)}
                </span>
                {course.original_price && course.original_price > price && (
                  <span className="text-base text-gray-400 dark:text-gray-500 line-through">
                    ₾{course.original_price.toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-navy-700/50" />

            {/* Referral Code */}
            <div className="px-5 pt-4 pb-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                {t("payment.referralCode")}{" "}
                <span className="text-gray-400 dark:text-gray-500 font-normal">
                  ({t("common.optional")})
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={referralCode}
                  onChange={handleReferralChange}
                  placeholder={
                    t("payment.referralCodePlaceholder") ||
                    "Enter referral code"
                  }
                  disabled={isSubmitting}
                  className={`w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-navy-800 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-charcoal-950 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 ${referralCode ? "pr-14" : "pr-3.5"} ${
                    referralValidation === "valid"
                      ? "border-emerald-500 dark:border-emerald-400"
                      : referralValidation === "invalid"
                        ? "border-red-500 dark:border-red-400"
                        : "border-gray-200 dark:border-navy-600 focus:border-emerald-500 dark:focus:border-emerald-400"
                  }`}
                  maxLength={20}
                />
                {referralCode && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setReferralCode("");
                        setReferralValidation("idle");
                        setReferralMessage("");
                      }}
                      className="p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-navy-600 transition-colors"
                    >
                      <svg
                        className="h-3.5 w-3.5 text-gray-400"
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
                    </button>
                    {referralValidation === "validating" && (
                      <svg
                        className="animate-spin h-3.5 w-3.5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    )}
                    {referralValidation === "valid" && (
                      <svg
                        className="h-3.5 w-3.5 text-emerald-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                    {referralValidation === "invalid" && (
                      <svg
                        className="h-3.5 w-3.5 text-red-500"
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
                    )}
                  </div>
                )}
              </div>
              {referralMessage && (
                <p
                  className={`text-xs mt-1 ${referralValidation === "valid" ? "text-emerald-600 dark:text-emerald-400" : referralValidation === "invalid" ? "text-red-600 dark:text-red-400" : "text-gray-500"}`}
                >
                  {referralMessage}
                </p>
              )}
            </div>

            <div className="border-t border-gray-100 dark:border-navy-700/50" />

            {/* Saved Cards Section */}
            {hasSavedCards && (
              <div className="px-5 pt-4 pb-2">
                <p className="text-[10px] font-semibold text-charcoal-700 dark:text-gray-400 uppercase tracking-wider mb-2.5">
                  {t("paymentMethod.savedCards")}
                </p>
                <div className="space-y-1.5">
                  {cards.map((card) => (
                    <div
                      key={card.id}
                      className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 dark:border-navy-700 bg-gray-50 dark:bg-navy-800/50 hover:border-emerald-500/30 dark:hover:border-emerald-500/20 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-charcoal-900 dark:text-white">
                            {card.cardBrand || "Card"}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatCardMask(card.cardMask)}
                          </span>
                        </div>
                        {card.expirationDate && (
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                            {card.expirationDate}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handlePayWithSavedCard(card.id)}
                        disabled={isPayDisabled || payingWithCardId === card.id}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {payingWithCardId === card.id ? (
                          <svg
                            className="animate-spin w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                        ) : (
                          t("paymentMethod.payWithSavedCard")
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteCard(card.id)}
                        disabled={deletingCardId === card.id || isPayDisabled}
                        className="p-1 rounded-md text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-navy-700 transition-colors disabled:opacity-50"
                        title={t("paymentMethod.deleteCard")}
                      >
                        {deletingCardId === card.id ? (
                          <svg
                            className="animate-spin w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2.5 mt-3 mb-1">
                  <div className="flex-1 border-t border-gray-200 dark:border-navy-700" />
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {t("paymentMethod.orPayWithNewMethod")}
                  </span>
                  <div className="flex-1 border-t border-gray-200 dark:border-navy-700" />
                </div>
              </div>
            )}

            {/* Pay Button (redirect flow) */}
            <div className={`px-5 ${hasSavedCards ? "pt-2" : "pt-4"} pb-4`}>
              <button
                onClick={() => handlePay("all")}
                disabled={isPayDisabled}
                className={`w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm transition-all ${
                  isSubmitting
                    ? "bg-emerald-500 text-white cursor-wait"
                    : isPayDisabled
                      ? "bg-gray-200 dark:bg-navy-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                      : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg hover:shadow-xl hover:shadow-emerald-500/25 hover:-translate-y-0.5"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {t("paymentMethod.redirecting")}
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    {t("paymentMethod.pay", { amount: `₾${price.toFixed(2)}` })}
                  </>
                )}
              </button>

              <label className="flex items-center gap-2 mt-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={saveCardChecked}
                  onChange={(e) => setSaveCardChecked(e.target.checked)}
                  disabled={isSubmitting}
                  className="w-3.5 h-3.5 rounded border-gray-300 dark:border-navy-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 bg-gray-50 dark:bg-navy-800 disabled:opacity-50"
                />
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {t("paymentMethod.saveCardForFuture")}
                </span>
              </label>

              <div className="flex items-center justify-center gap-2.5 mt-3 pb-1">
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {t("paymentMethod.acceptedMethods")}
                </span>
                <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    />
                  </svg>
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Error display */}
            {error && (
              <div className="px-5 pb-4">
                <div className="p-2.5 rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20">
                  <p className="text-xs text-red-700 dark:text-red-300">
                    {error}
                  </p>
                  {tokenPaymentStatus === "failed" && (
                    <button
                      onClick={() => {
                        setError(null);
                        setTokenPaymentStatus(null);
                        setPayingWithCardId(null);
                      }}
                      className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline mt-1"
                    >
                      {t("paymentMethod.tryAgain")}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
