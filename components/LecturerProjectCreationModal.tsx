"use client";

import { useCallback, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/contexts/I18nContext";
import VideoUploadDialog, {
  type ProjectSubmissionData,
} from "@/components/chat/VideoUploadDialog";

interface LecturerProjectCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

// Wraps VideoUploadDialog for the standalone (no-course) project flow.
//
// Flow:
//   1. Lecturer picks an optional thumbnail file (uploaded to chat-media at
//      standalone-projects/{user_id}/thumb-{ts}.{ext}). Required because
//      standalone projects have no course thumbnail to fall back to in cards.
//   2. After thumbnail is chosen, opens VideoUploadDialog. Its onSubmit
//      handler uploads the project video to the same path namespace, then
//      POSTs to /api/lecturer/projects.
//   3. If the API returns a Keepz checkoutUrl, redirects there.
//
// All video upload + project insert logic lives here (not in VideoUploadDialog)
// so the existing in-chat creation path in ChatArea.tsx stays untouched.
export default function LecturerProjectCreationModal({
  isOpen,
  onClose,
  onCreated,
}: LecturerProjectCreationModalProps) {
  const { t } = useI18n();
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isUploadingThumb, setIsUploadingThumb] = useState(false);
  const [thumbError, setThumbError] = useState<string | null>(null);
  const [step, setStep] = useState<"thumbnail" | "form">("thumbnail");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetAndClose = useCallback(() => {
    setThumbnailFile(null);
    setThumbnailUrl(null);
    setIsUploadingThumb(false);
    setThumbError(null);
    setStep("thumbnail");
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  }, [onClose]);

  const handleThumbnailPick = async (file: File) => {
    setThumbError(null);
    if (!file.type.startsWith("image/")) {
      setThumbError(
        t("lecturerProjects.thumbnailMustBeImage") ||
          "Thumbnail must be an image.",
      );
      return;
    }
    setThumbnailFile(file);
    setIsUploadingThumb(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error("Not authenticated");
      }
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `standalone-projects/${session.user.id}/thumb-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("chat-media")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;
      setThumbnailUrl(path);
    } catch (err: any) {
      setThumbError(err?.message || "Failed to upload thumbnail");
      setThumbnailFile(null);
      setThumbnailUrl(null);
    } finally {
      setIsUploadingThumb(false);
    }
  };

  const handleSubmit = useCallback(
    async (data: ProjectSubmissionData) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token || !session.user) {
        throw new Error("Not authenticated. Please log in again.");
      }

      // Upload the video file (if present) to the standalone path namespace.
      let videoPath: string | null = data.videoLink || null;
      if (data.videoFile) {
        const ext =
          data.videoFile.name.split(".").pop()?.toLowerCase() || "mp4";
        const path = `standalone-projects/${session.user.id}/video-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("chat-media")
          .upload(path, data.videoFile, {
            cacheControl: "3600",
            upsert: false,
          });
        if (upErr) {
          throw new Error(`Failed to upload video: ${upErr.message}`);
        }
        videoPath = path;
      }

      const resp = await fetch("/api/lecturer/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          thumbnailUrl,
          videoLink: videoPath,
          budget: data.budget,
          minViews: data.minViews,
          maxViews: data.maxViews,
          platforms: data.platforms,
          startDate: data.startDate,
          endDate: data.endDate,
          criteria: data.criteria,
        }),
      });

      const result = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(result?.error || "Failed to create project");
      }

      // Paid project — redirect to Keepz checkout.
      if (result?.needsPayment && result?.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }

      onCreated();
      resetAndClose();
    },
    [thumbnailUrl, onCreated, resetAndClose],
  );

  if (!isOpen) return null;

  if (step === "thumbnail") {
    return (
      <div
        className="fixed inset-0 bg-charcoal-950/95 backdrop-blur-md z-[9999] flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) resetAndClose();
        }}
      >
        <div className="w-full max-w-md bg-white dark:bg-navy-900 rounded-2xl p-6 space-y-4 shadow-2xl">
          <h2 className="text-lg font-semibold text-charcoal-950 dark:text-white">
            {t("lecturerProjects.thumbnailStepTitle") ||
              "Add a project thumbnail"}
          </h2>
          <p className="text-sm text-charcoal-600 dark:text-gray-400">
            {t("lecturerProjects.thumbnailStepHelp") ||
              "Pick an image that represents this project. You can also skip and add one later."}
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="block w-full text-sm text-charcoal-700 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 dark:file:bg-emerald-500/10 dark:file:text-emerald-300"
            disabled={isUploadingThumb}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleThumbnailPick(f);
            }}
          />

          {isUploadingThumb && (
            <p className="text-xs text-charcoal-500 dark:text-gray-400">
              {t("lecturerProjects.thumbnailUploading") || "Uploading..."}
            </p>
          )}
          {thumbError && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {thumbError}
            </p>
          )}
          {thumbnailUrl && !isUploadingThumb && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              {t("lecturerProjects.thumbnailUploaded") || "Thumbnail ready."}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={resetAndClose}
              className="px-4 py-2 text-sm font-medium text-charcoal-600 dark:text-gray-300 hover:bg-charcoal-50 dark:hover:bg-navy-800 rounded-lg"
            >
              {t("common.cancel") || "Cancel"}
            </button>
            <button
              type="button"
              onClick={() => setStep("form")}
              disabled={isUploadingThumb}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 rounded-lg"
            >
              {thumbnailUrl
                ? t("common.continue") || "Continue"
                : t("lecturerProjects.skipThumbnail") || "Skip & continue"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <VideoUploadDialog
      isOpen={true}
      onClose={resetAndClose}
      onSubmit={handleSubmit}
    />
  );
}
