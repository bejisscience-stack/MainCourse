"use client";

import { useReportWebVitals } from "next/web-vitals";
import { usePostHog } from "posthog-js/react";

export default function WebVitalsReporter() {
  const posthog = usePostHog();

  useReportWebVitals((metric) => {
    if (!posthog) return;
    posthog.capture("$web_vitals", {
      name: metric.name,
      value: metric.value,
      delta: metric.delta,
      id: metric.id,
      rating: metric.rating,
      navigation_type: metric.navigationType,
    });
  });

  return null;
}
