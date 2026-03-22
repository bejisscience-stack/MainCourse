"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { useCourses } from "@/hooks/useCourses";
import { supabase } from "@/lib/supabase";

export default function AdminSettings() {
  const { t } = useI18n();
  const {
    minWithdrawal,
    subscriptionPrice,
    featuredCourseId,
    updatedAt,
    isLoading,
    mutate,
  } = usePlatformSettings();
  const { courses } = useCourses("All");

  const [minWithdrawalInput, setMinWithdrawalInput] = useState("");
  const [subscriptionPriceInput, setSubscriptionPriceInput] = useState("");
  const [featuredCourseInput, setFeaturedCourseInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Sync inputs when data loads
  useEffect(() => {
    if (!isLoading) {
      setMinWithdrawalInput(String(minWithdrawal));
      setSubscriptionPriceInput(String(subscriptionPrice));
      setFeaturedCourseInput(featuredCourseId || "");
    }
  }, [minWithdrawal, subscriptionPrice, featuredCourseId, isLoading]);

  const handleSave = async () => {
    setMessage(null);
    const minVal = parseFloat(minWithdrawalInput);
    const subVal = parseFloat(subscriptionPriceInput);

    if (isNaN(minVal) || minVal <= 0) {
      setMessage({
        type: "error",
        text: t("adminSettings.invalidMinWithdrawal"),
      });
      return;
    }
    if (isNaN(subVal) || subVal <= 0) {
      setMessage({
        type: "error",
        text: t("adminSettings.invalidSubscriptionPrice"),
      });
      return;
    }

    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          min_withdrawal_gel: minVal,
          subscription_price_gel: subVal,
          featured_course_id: featuredCourseInput || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }

      await mutate();
      setMessage({ type: "success", text: t("adminSettings.saved") });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900 mb-4"></div>
        <p className="text-navy-700">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-navy-900 mb-6">
          {t("adminSettings.title")}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Min Withdrawal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("adminSettings.minWithdrawal")}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                ₾
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={minWithdrawalInput}
                onChange={(e) => setMinWithdrawalInput(e.target.value)}
                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-transparent text-navy-900"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t("adminSettings.minWithdrawalHint")}
            </p>
          </div>

          {/* Subscription Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("adminSettings.subscriptionPrice")}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                ₾
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={subscriptionPriceInput}
                onChange={(e) => setSubscriptionPriceInput(e.target.value)}
                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-transparent text-navy-900"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t("adminSettings.subscriptionPriceHint")}
            </p>
          </div>

          {/* Featured Course */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("adminSettings.featuredCourse")}
            </label>
            <select
              value={featuredCourseInput}
              onChange={(e) => setFeaturedCourseInput(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-transparent text-navy-900 bg-white"
            >
              <option value="">{t("adminSettings.featuredCourseNone")}</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title} ({course.course_type})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {t("adminSettings.featuredCourseHint")}
            </p>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mt-4 px-4 py-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Save + Last Updated */}
        <div className="mt-6 flex items-center justify-between">
          <div>
            {updatedAt && (
              <p className="text-xs text-gray-500">
                {t("adminSettings.lastUpdated")}:{" "}
                {new Date(updatedAt).toLocaleString()}
              </p>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-navy-900 text-white font-semibold rounded-lg hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? t("common.loading") : t("adminSettings.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
