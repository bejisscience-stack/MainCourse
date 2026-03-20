"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Course } from "./CourseCard";
import { useI18n } from "@/contexts/I18nContext";
import { useUser } from "@/hooks/useUser";
import { supabase } from "@/lib/supabase";
import { getReferral } from "@/lib/referral-storage";
import { useSavedCards, type SavedCard } from "@/hooks/useSavedCards";
import { calculateStudentPrice } from "@/lib/currency";
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
  if (!mask) return "•••• ••••";
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
  const {
    cards,
    isLoading: cardsLoading,
    deleteCard,
    mutate: mutateSavedCards,
  } = useSavedCards();
  const [mounted, setMounted] = useState(false);

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
  const paymentInFlightRef = useRef(false);

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
      paymentInFlightRef.current = false;

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
            paymentInFlightRef.current = false;
            setTokenPaymentStatus("success");
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
            paymentInFlightRef.current = false;
          }
        } catch {
          // Continue polling on network errors
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          paymentInFlightRef.current = false;
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
      if (paymentInFlightRef.current) return;
      paymentInFlightRef.current = true;

      setError(null);
      setPayingWithCardId(savedCardId);
      setTokenPaymentStatus("processing");

      try {
        let enrollmentRequestId: string;
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
          const errData = await orderResponse.json();
          throw new Error(errData.error || "Failed to process payment");
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
        paymentInFlightRef.current = false;
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
      if (paymentInFlightRef.current) return;
      paymentInFlightRef.current = true;

      setError(null);
      setIsSubmitting(true);
      setSelectedMethod(method);

      try {
        let enrollmentRequestId: string;
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
          const errData = await orderResponse.json();
          throw new Error(errData.error || "Failed to create payment");
        }
        const { checkoutUrl } = await orderResponse.json();

        window.location.href = checkoutUrl;
      } catch (err: any) {
        console.error("Enrollment payment error:", err);
        setError(err.message || "Something went wrong. Please try again.");
        setIsSubmitting(false);
        setSelectedMethod(null);
        paymentInFlightRef.current = false;
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

  const price = calculateStudentPrice(course.price || 0);
  const isPayDisabled =
    isSubmitting ||
    referralValidation === "validating" ||
    tokenPaymentStatus === "processing" ||
    paymentInFlightRef.current;
  const hasSavedCards = cards.length > 0;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/70 dark:bg-black/85 z-[9999] flex items-center justify-center p-4 animate-fade-in"
      onClick={() => {
        if (!isSubmitting && tokenPaymentStatus !== "processing") onClose();
      }}
    >
      <div
        className="relative w-full max-w-md bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex-1 pr-4">
            <h2 className="text-xl font-bold text-charcoal-950 dark:text-white leading-tight">
              {course.title}
            </h2>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              ₾{price.toFixed(2)}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting || tokenPaymentStatus === "processing"}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-50"
            aria-label={t("common.close")}
          >
            <svg
              className="w-5 h-5"
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
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 dark:border-navy-700/50" />

        {/* Inline payment processing overlay */}
        {tokenPaymentStatus === "processing" && (
          <div className="p-6 flex flex-col items-center gap-3 animate-fade-in">
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
          <div className="p-6 flex flex-col items-center gap-3 animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-emerald-500"
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

        {/* Main content — hidden during inline processing/success */}
        {tokenPaymentStatus !== "processing" &&
          tokenPaymentStatus !== "success" && (
            <>
              {/* Referral Code */}
              <div className="px-6 pt-4 pb-3">
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
                    className={`w-full px-4 py-3 text-base bg-gray-50 dark:bg-navy-800 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-charcoal-950 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 ${
                      referralCode ? "pr-16" : "pr-4"
                    } ${
                      referralValidation === "valid"
                        ? "border-emerald-500 dark:border-emerald-400"
                        : referralValidation === "invalid"
                          ? "border-red-500 dark:border-red-400"
                          : "border-gray-200 dark:border-navy-600 focus:border-emerald-500 dark:focus:border-emerald-400"
                    }`}
                    maxLength={20}
                  />
                  {referralCode && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setReferralCode("");
                          setReferralValidation("idle");
                          setReferralMessage("");
                        }}
                        className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-navy-600 transition-colors"
                      >
                        <svg
                          className="h-4 w-4 text-gray-400"
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
                          className="animate-spin h-4 w-4 text-gray-400"
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
                          className="h-4 w-4 text-emerald-500"
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
                          className="h-4 w-4 text-red-500"
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
                    className={`text-xs mt-1.5 ${
                      referralValidation === "valid"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : referralValidation === "invalid"
                          ? "text-red-600 dark:text-red-400"
                          : "text-gray-500"
                    }`}
                  >
                    {referralMessage}
                  </p>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100 dark:border-navy-700/50" />

              {/* Saved Cards Section */}
              {hasSavedCards && (
                <div className="p-6 pt-5 pb-2">
                  <p className="text-xs font-semibold text-charcoal-700 dark:text-gray-400 uppercase tracking-wider mb-3">
                    {t("paymentMethod.savedCards")}
                  </p>
                  <div className="space-y-2">
                    {cards.map((card) => (
                      <div
                        key={card.id}
                        className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-navy-700 bg-gray-50 dark:bg-navy-800/50 hover:border-emerald-500/30 dark:hover:border-emerald-500/20 transition-colors"
                      >
                        {/* Card info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-charcoal-900 dark:text-white">
                              {card.cardBrand || "Card"}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {formatCardMask(card.cardMask)}
                            </span>
                          </div>
                          {card.expirationDate && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                              {card.expirationDate}
                            </p>
                          )}
                        </div>

                        {/* Pay button */}
                        <button
                          onClick={() => handlePayWithSavedCard(card.id)}
                          disabled={
                            isPayDisabled || payingWithCardId === card.id
                          }
                          className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {payingWithCardId === card.id ? (
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
                          ) : (
                            t("paymentMethod.payWithSavedCard")
                          )}
                        </button>

                        {/* Delete button */}
                        <button
                          onClick={() => handleDeleteCard(card.id)}
                          disabled={deletingCardId === card.id || isPayDisabled}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-navy-700 transition-colors disabled:opacity-50"
                          title={t("paymentMethod.deleteCard")}
                        >
                          {deletingCardId === card.id ? (
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
                          ) : (
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
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* "Or pay with new method" divider */}
                  <div className="flex items-center gap-3 mt-4 mb-1">
                    <div className="flex-1 border-t border-gray-200 dark:border-navy-700" />
                    <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                      {t("paymentMethod.orPayWithNewMethod")}
                    </span>
                    <div className="flex-1 border-t border-gray-200 dark:border-navy-700" />
                  </div>
                </div>
              )}

              {/* Pay Button (redirect flow) */}
              <div className={`p-6 ${hasSavedCards ? "pt-2" : "pt-5"} pb-4`}>
                <button
                  onClick={() => handlePay("all")}
                  disabled={isPayDisabled}
                  className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold text-base transition-all ${
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
                        className="animate-spin w-5 h-5"
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
                        className="w-5 h-5"
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
                      {t("paymentMethod.pay", {
                        amount: `₾${price.toFixed(2)}`,
                      })}
                    </>
                  )}
                </button>

                {/* Save card checkbox */}
                <label className="flex items-center gap-2.5 mt-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveCardChecked}
                    onChange={(e) => setSaveCardChecked(e.target.checked)}
                    disabled={isSubmitting}
                    className="w-4 h-4 rounded border-gray-300 dark:border-navy-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 bg-gray-50 dark:bg-navy-800 disabled:opacity-50"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {t("paymentMethod.saveCardForFuture")}
                  </span>
                </label>

                {/* Accepted methods hint */}
                <div className="flex items-center justify-center gap-3 mt-3">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {t("paymentMethod.acceptedMethods")}
                  </span>
                  <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
                    {/* Card icon */}
                    <svg
                      className="w-4 h-4"
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
                    {/* Bank icon */}
                    <svg
                      className="w-4 h-4"
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
                    {/* QR/Mobile icon */}
                    <svg
                      className="w-4 h-4"
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
            </>
          )}

        {/* Error display */}
        {error && (
          <div className="px-6 pb-4">
            <div className="p-3 rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              {tokenPaymentStatus === "failed" && (
                <button
                  onClick={() => {
                    setError(null);
                    setTokenPaymentStatus(null);
                    setPayingWithCardId(null);
                    paymentInFlightRef.current = false;
                  }}
                  className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline mt-1"
                >
                  {t("paymentMethod.tryAgain")}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Bottom padding */}
        <div className="pb-2" />
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
