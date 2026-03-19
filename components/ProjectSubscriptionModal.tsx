"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/contexts/I18nContext";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { useUser } from "@/hooks/useUser";
import { supabase } from "@/lib/supabase";
import { useSavedCards } from "@/hooks/useSavedCards";

interface ProjectSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  courseId?: string;
}

const SUBSCRIPTION_PRICE = 10;

function formatCardMask(mask: string): string {
  const last4 = mask.replace(/\*/g, "").slice(-4);
  return `•••• ${last4}`;
}

export default function ProjectSubscriptionModal({
  isOpen,
  onClose,
  onSuccess,
  courseId,
}: ProjectSubscriptionModalProps) {
  const { t } = useI18n();
  const { user } = useUser();
  const { subscription } = useProjectAccess(user?.id);
  const { cards, deleteCard } = useSavedCards();

  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [saveCardChecked, setSaveCardChecked] = useState(false);
  const [tokenPaymentStatus, setTokenPaymentStatus] = useState<
    null | "processing" | "success" | "failed"
  >(null);
  const [payingWithCardId, setPayingWithCardId] = useState<string | null>(null);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsRedirecting(false);
      setSaveCardChecked(false);
      setTokenPaymentStatus(null);
      setPayingWithCardId(null);
      setIsRetrying(false);
    }
  }, [isOpen]);

  // ESC key + body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        !isRedirecting &&
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
  }, [isOpen, isRedirecting, tokenPaymentStatus, onClose]);

  // Cleanup poll timer
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const getAuthToken = useCallback(async (): Promise<string> => {
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
    return session.access_token;
  }, []);

  // Poll payment status for saved card payments
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
          window.location.href = `/payment/success?paymentId=${paymentId}`;
        }
      }, 2000);
    },
    [onSuccess, onClose, t],
  );

  const createSubscriptionAndGetId = useCallback(
    async (token: string): Promise<string> => {
      const subResponse = await fetch("/api/project-subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ payment_method: "keepz" }),
      });
      if (!subResponse.ok) {
        const errData = await subResponse.json();
        throw new Error(errData.error || "Failed to create subscription");
      }
      const sub = await subResponse.json();
      return sub.id;
    },
    [],
  );

  // Redirect flow (new card)
  const handleKeepzPayment = useCallback(async () => {
    setIsRedirecting(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const subscriptionId = await createSubscriptionAndGetId(token);

      const orderResponse = await fetch("/api/payments/keepz/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentType: "project_subscription",
          referenceId: subscriptionId,
          saveCard: saveCardChecked || undefined,
        }),
      });
      if (!orderResponse.ok) {
        const errData = await orderResponse.json();
        throw new Error(errData.error || "Failed to create payment");
      }
      const { checkoutUrl } = await orderResponse.json();
      window.location.href = checkoutUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment failed";
      setError(message);
      setIsRedirecting(false);
    }
  }, [getAuthToken, createSubscriptionAndGetId, saveCardChecked]);

  // Saved card flow (inline)
  const handlePayWithSavedCard = useCallback(
    async (savedCardId: string) => {
      setError(null);
      setPayingWithCardId(savedCardId);
      setTokenPaymentStatus("processing");
      try {
        const token = await getAuthToken();
        const subscriptionId = await createSubscriptionAndGetId(token);

        const orderResponse = await fetch("/api/payments/keepz/create-order", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            paymentType: "project_subscription",
            referenceId: subscriptionId,
            savedCardId,
          }),
        });
        if (!orderResponse.ok) {
          const errData = await orderResponse.json();
          throw new Error(errData.error || "Failed to process payment");
        }
        const orderData = await orderResponse.json();
        if (orderData.processing) {
          pollPaymentStatus(orderData.paymentId, token);
        } else if (orderData.checkoutUrl) {
          window.location.href = orderData.checkoutUrl;
        }
      } catch (err: any) {
        setError(err.message || "Something went wrong. Please try again.");
        setTokenPaymentStatus("failed");
        setPayingWithCardId(null);
      }
    },
    [getAuthToken, createSubscriptionAndGetId, pollPaymentStatus],
  );

  // Retry payment for existing pending subscription (skip creating new sub)
  const handleRetryPayment = useCallback(async () => {
    if (!subscription?.id) return;
    setIsRetrying(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const orderResponse = await fetch("/api/payments/keepz/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentType: "project_subscription",
          referenceId: subscription.id,
        }),
      });
      if (!orderResponse.ok) {
        const errData = await orderResponse.json();
        throw new Error(errData.error || "Failed to create payment");
      }
      const { checkoutUrl } = await orderResponse.json();
      window.location.href = checkoutUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment failed";
      setError(message);
      setIsRetrying(false);
    }
  }, [subscription, getAuthToken]);

  const handleDeleteCard = useCallback(
    async (cardId: string) => {
      if (!confirm(t("paymentMethod.deleteCardConfirm"))) return;
      setDeletingCardId(cardId);
      const success = await deleteCard(cardId);
      setDeletingCardId(null);
      if (!success) setError("Failed to remove card");
    },
    [deleteCard, t],
  );

  if (!isOpen || !mounted || typeof document === "undefined") return null;
  if (!user) return null;

  const isPayDisabled = isRedirecting || tokenPaymentStatus === "processing";
  const hasSavedCards = cards.length > 0;
  const priceFormatted = `₾${SUBSCRIPTION_PRICE.toFixed(1)}`;

  // Status view for existing subscriptions
  const renderStatusView = () => {
    if (!subscription) return null;

    const statusConfig = {
      pending: {
        icon: (
          <svg
            className="w-6 h-6 text-amber-400"
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
        ),
        bg: "bg-amber-500/10 border-amber-500/30",
        title:
          subscription?.payment_method === "keepz"
            ? t("projectSubscription.pendingPaymentTitle")
            : t("projectSubscription.pendingTitle"),
        message:
          subscription?.payment_method === "keepz"
            ? t("projectSubscription.pendingPaymentMessage")
            : t("projectSubscription.pendingMessage"),
        titleColor: "text-amber-300",
        messageColor: "text-amber-200/70",
        showRetry: subscription?.payment_method === "keepz",
      },
      active: {
        icon: (
          <svg
            className="w-6 h-6 text-emerald-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ),
        bg: "bg-emerald-500/10 border-emerald-500/30",
        title: t("projectSubscription.activeTitle"),
        message: subscription.expires_at
          ? t("projectSubscription.activeUntil", {
              date: new Date(subscription.expires_at).toLocaleDateString(),
            })
          : "",
        titleColor: "text-emerald-300",
        messageColor: "text-emerald-200/70",
      },
      rejected: {
        icon: (
          <svg
            className="w-6 h-6 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ),
        bg: "bg-red-500/10 border-red-500/30",
        title: t("projectSubscription.rejectedTitle"),
        message: t("projectSubscription.rejectedMessage"),
        titleColor: "text-red-300",
        messageColor: "text-red-200/70",
      },
    };

    const config =
      statusConfig[subscription.status as keyof typeof statusConfig];
    if (!config) return null;

    return (
      <div className="p-6">
        <div
          className={`flex items-start gap-4 p-4 rounded-xl border ${config.bg}`}
        >
          <div className="shrink-0 mt-0.5">{config.icon}</div>
          <div>
            <p className={`text-sm font-semibold ${config.titleColor}`}>
              {config.title}
            </p>
            {config.message && (
              <p className={`text-xs mt-1 ${config.messageColor}`}>
                {config.message}
              </p>
            )}
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="mt-3 p-3 rounded-xl border border-red-800/50 bg-red-900/20">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Retry payment button for Keepz pending subscriptions */}
        {"showRetry" in config && config.showRetry && (
          <button
            onClick={handleRetryPayment}
            disabled={isRetrying}
            className={`w-full mt-4 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
              isRetrying
                ? "bg-emerald-500 text-white cursor-wait"
                : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg hover:shadow-emerald-500/25"
            }`}
          >
            {isRetrying ? (
              <span className="flex items-center justify-center gap-2">
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
              </span>
            ) : (
              t("projectSubscription.retryPayment")
            )}
          </button>
        )}

        <button
          onClick={onClose}
          disabled={isRetrying}
          className="w-full mt-2 px-4 py-2.5 bg-navy-800/70 text-gray-300 rounded-xl hover:bg-navy-700 font-medium transition-colors text-sm disabled:opacity-50"
        >
          {t("close")}
        </button>
      </div>
    );
  };

  // Payment view
  const renderPaymentView = () => (
    <>
      {/* Inline payment processing */}
      {tokenPaymentStatus === "processing" && (
        <div className="p-8 flex flex-col items-center gap-3 animate-fade-in">
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
          <p className="text-sm font-medium text-gray-300">
            {t("paymentMethod.savedCardProcessing")}
          </p>
        </div>
      )}

      {tokenPaymentStatus === "success" && (
        <div className="p-8 flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-12 h-12 rounded-full bg-emerald-900/30 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-emerald-400"
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
          <p className="text-sm font-medium text-emerald-400">
            {t("paymentMethod.savedCardSuccess")}
          </p>
        </div>
      )}

      {tokenPaymentStatus !== "processing" &&
        tokenPaymentStatus !== "success" && (
          <>
            {/* Price Hero */}
            <div className="px-6 pt-5 pb-4">
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-600/20 via-emerald-500/10 to-navy-800/50 border border-emerald-500/20 p-6 text-center">
                <div className="relative z-10">
                  <p className="text-4xl font-bold text-white tracking-tight">
                    {priceFormatted}
                    <span className="text-lg font-normal text-gray-400 ml-1">
                      / {t("projectSubscription.monthlyPrice")}
                    </span>
                  </p>
                </div>
                {/* Decorative glow */}
                <div className="absolute -top-8 -right-8 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
                <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl" />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-navy-700/50" />

            {/* Saved Cards */}
            {hasSavedCards && (
              <div className="px-6 pt-5 pb-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  {t("paymentMethod.savedCards")}
                </p>
                <div className="space-y-2">
                  {cards.map((card) => (
                    <div
                      key={card.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-navy-700 bg-navy-800/50 hover:border-emerald-500/20 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">
                            {card.cardBrand || "Card"}
                          </span>
                          <span className="text-sm text-gray-400">
                            {formatCardMask(card.cardMask)}
                          </span>
                        </div>
                        {card.expirationDate && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {card.expirationDate}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handlePayWithSavedCard(card.id)}
                        disabled={isPayDisabled || payingWithCardId === card.id}
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
                      <button
                        onClick={() => handleDeleteCard(card.id)}
                        disabled={deletingCardId === card.id || isPayDisabled}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-navy-700 transition-colors disabled:opacity-50"
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
                {/* Divider */}
                <div className="flex items-center gap-3 mt-4 mb-1">
                  <div className="flex-1 border-t border-navy-700" />
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {t("paymentMethod.orPayWithNewMethod")}
                  </span>
                  <div className="flex-1 border-t border-navy-700" />
                </div>
              </div>
            )}

            {/* Pay Button (redirect flow) */}
            <div className={`px-6 ${hasSavedCards ? "pt-2" : "pt-5"} pb-4`}>
              <button
                onClick={handleKeepzPayment}
                disabled={isPayDisabled}
                className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold text-base transition-all ${
                  isRedirecting
                    ? "bg-emerald-500 text-white cursor-wait"
                    : isPayDisabled
                      ? "bg-navy-700 text-gray-500 cursor-not-allowed"
                      : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg hover:shadow-xl hover:shadow-emerald-500/25 hover:-translate-y-0.5"
                }`}
              >
                {isRedirecting ? (
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
                    {t("paymentMethod.pay", { amount: priceFormatted })}
                  </>
                )}
              </button>

              {/* Save card checkbox */}
              <label className="flex items-center gap-2.5 mt-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={saveCardChecked}
                  onChange={(e) => setSaveCardChecked(e.target.checked)}
                  disabled={isRedirecting}
                  className="w-4 h-4 rounded border-navy-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 bg-navy-800 disabled:opacity-50"
                />
                <span className="text-xs text-gray-400">
                  {t("paymentMethod.saveCardForFuture")}
                </span>
              </label>

              {/* Accepted methods */}
              <div className="flex items-center justify-center gap-3 mt-3">
                <span className="text-xs text-gray-500">
                  {t("paymentMethod.acceptedMethods")}
                </span>
                <div className="flex items-center gap-2 text-gray-500">
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

      {/* Error */}
      {error && (
        <div className="px-6 pb-4">
          <div className="p-3 rounded-xl border border-red-800/50 bg-red-900/20">
            <p className="text-sm text-red-300">{error}</p>
            {tokenPaymentStatus === "failed" && (
              <button
                onClick={() => {
                  setError(null);
                  setTokenPaymentStatus(null);
                  setPayingWithCardId(null);
                }}
                className="text-sm font-medium text-red-400 hover:underline mt-1"
              >
                {t("paymentMethod.tryAgain")}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="pb-2" />
    </>
  );

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4 animate-fade-in"
      onClick={() => {
        if (!isRedirecting && tokenPaymentStatus !== "processing") onClose();
      }}
    >
      <div
        className="relative w-full max-w-md bg-navy-900 border border-navy-700 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <h2 className="text-xl font-bold text-white leading-tight">
            {t("projectSubscription.title")}
          </h2>
          <button
            onClick={onClose}
            disabled={isRedirecting || tokenPaymentStatus === "processing"}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-navy-800 transition-colors disabled:opacity-50"
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
        <div className="border-t border-navy-700/50" />

        {subscription ? renderStatusView() : renderPaymentView()}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
