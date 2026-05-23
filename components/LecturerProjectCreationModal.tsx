"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/contexts/I18nContext";
import VideoUploadDialog, {
  type ProjectSubmissionData,
} from "@/components/chat/VideoUploadDialog";
import {
  prepareProjectResourcesForInsert,
  resourceExtensionForFile,
} from "@/lib/project-resources";

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
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const thumbnailPreview = useMemo(() => {
    if (!thumbnailFile) return null;
    return URL.createObjectURL(thumbnailFile);
  }, [thumbnailFile]);

  useEffect(() => {
    return () => {
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    };
  }, [thumbnailPreview]);

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

      const storedResources = await prepareProjectResourcesForInsert(
        data.resources,
        async (file, storagePath) => {
          const { error: upErr } = await supabase.storage
            .from("chat-media")
            .upload(storagePath, file, {
              cacheControl: "3600",
              upsert: false,
            });
          if (upErr) {
            throw new Error(`Failed to upload resource: ${upErr.message}`);
          }
        },
        (file, type) => {
          const ext = resourceExtensionForFile(file, type);
          return `standalone-projects/${session.user.id}/resource-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
        },
      );

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
          resources: storedResources,
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
        className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) resetAndClose();
        }}
      >
        <div
          className="relative w-full max-w-md bg-navy-950/90 border border-navy-800/60 rounded-2xl shadow-soft-xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={resetAndClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 bg-navy-800/70 hover:bg-navy-700 rounded-full flex items-center justify-center text-gray-300 transition-colors"
            aria-label={t("common.close") || "Close"}
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

          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-gray-100 mb-1 pr-10">
                {t("lecturerProjects.thumbnailStepTitle") ||
                  "Add a project thumbnail"}
              </h2>
              <p className="text-sm text-gray-500">
                {t("lecturerProjects.thumbnailStepHelp") ||
                  "Pick an image that represents this project. You can also skip and add one later."}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  {t("lecturerProjects.thumbnailStepProgress") || "Step 1 of 2"}
                </span>
                <span className="text-gray-300">
                  {t("lecturerProjects.thumbnailStepLabel") || "Thumbnail"}
                </span>
              </div>
              <div className="w-full h-1 bg-navy-800/60 rounded-full overflow-hidden">
                <div className="h-full w-1/2 bg-emerald-400/80 transition-all" />
              </div>
            </div>

            <label
              htmlFor="project-thumbnail-input"
              onDragOver={(e) => {
                e.preventDefault();
                if (!isUploadingThumb) setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (isUploadingThumb) return;
                const f = e.dataTransfer.files?.[0];
                if (f) handleThumbnailPick(f);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                isDragging
                  ? "border-emerald-400 bg-emerald-500/10"
                  : "border-navy-700/80 bg-navy-900/40 hover:border-emerald-500/50 hover:bg-navy-900/60"
              } ${isUploadingThumb ? "pointer-events-none opacity-70" : ""}`}
            >
              {thumbnailPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnailPreview}
                  alt=""
                  className="mb-3 max-h-44 w-full rounded-xl object-contain"
                />
              ) : (
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-800/60 text-emerald-400">
                  <svg
                    className="h-7 w-7"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              )}

              <span className="text-sm font-semibold text-gray-200">
                {thumbnailFile
                  ? thumbnailFile.name
                  : t("lecturerProjects.thumbnailDropHint") ||
                    "Click to upload or drag and drop"}
              </span>
              <span className="mt-1 text-xs text-gray-500">
                {t("lecturerProjects.thumbnailFormats") ||
                  "JPG, PNG, or WEBP · Recommended 16:9"}
              </span>

              <input
                id="project-thumbnail-input"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={isUploadingThumb}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleThumbnailPick(f);
                }}
              />
            </label>

            {isUploadingThumb && (
              <div className="flex items-center gap-2 rounded-xl border border-navy-800/60 bg-navy-900/50 px-4 py-3 text-sm text-gray-400">
                <svg
                  className="h-4 w-4 animate-spin text-emerald-400"
                  xmlns="http://www.w3.org/2000/svg"
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
                <span>
                  {t("lecturerProjects.thumbnailUploading") || "Uploading..."}
                </span>
              </div>
            )}

            {thumbError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {thumbError}
              </div>
            )}

            {thumbnailUrl && !isUploadingThumb && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                <svg
                  className="h-4 w-4 shrink-0"
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
                <span>
                  {t("lecturerProjects.thumbnailUploaded") ||
                    "Thumbnail ready."}
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-navy-800/60">
              <button
                type="button"
                onClick={resetAndClose}
                className="px-4 py-2 text-sm font-semibold text-gray-300 bg-navy-900/60 border border-navy-800/60 rounded-lg hover:bg-navy-800/70 transition-colors"
              >
                {t("common.cancel") || "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => setStep("form")}
                disabled={isUploadingThumb}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-500/90 rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {thumbnailUrl
                  ? t("common.continue") || "Continue"
                  : t("lecturerProjects.skipThumbnail") || "Skip & continue"}
              </button>
            </div>
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
