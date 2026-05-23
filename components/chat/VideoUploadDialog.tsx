"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useI18n } from "@/contexts/I18nContext";

interface VideoUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProjectSubmissionData) => Promise<void>;
  channelId?: string;
  initialData?: Partial<ProjectSubmissionData>;
}

export interface ProjectCriteria {
  text: string;
  rpm: number; // Rate Per Match
  platform?: string; // Platform name (optional, for platform-specific criteria)
}

export interface ProjectResourceInput {
  type: "image" | "video" | "link";
  title?: string;
  url?: string;
  file?: File;
}

export interface ProjectSubmissionData {
  videoLink?: string;
  videoFile?: File;
  budget: number;
  minViews: number;
  maxViews: number;
  name: string;
  description: string;
  platforms: string[];
  criteria: ProjectCriteria[];
  resources: ProjectResourceInput[];
  startDate: string;
  endDate: string;
}

type ResourceListItem = {
  id: string;
  type: "image" | "video" | "link";
  title?: string;
  url?: string;
  file?: File;
  fileName?: string;
};

const SOCIAL_MEDIA_PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
];

const DURATION_PRESETS = [
  { days: 7, key: "duration1Week" as const },
  { days: 14, key: "duration2Weeks" as const },
  { days: 30, key: "duration1Month" as const },
];

type PlatformCriteriaItem = { text: string; rpm: string };

type PlatformCardState = {
  enabled: boolean;
  items: PlatformCriteriaItem[];
  draftText: string;
  draftRpm: string;
};

type PlatformCriteriaState = Record<string, PlatformCardState>;

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(base: Date, days: number): string {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return formatLocalDate(next);
}

function createInitialPlatformState(): PlatformCriteriaState {
  return Object.fromEntries(
    SOCIAL_MEDIA_PLATFORMS.map((p) => [
      p.id,
      { enabled: false, items: [], draftText: "", draftRpm: "" },
    ]),
  );
}

function platformStateFromInitialData(
  initialData?: Partial<ProjectSubmissionData>,
): PlatformCriteriaState {
  const state = createInitialPlatformState();
  if (!initialData) return state;

  for (const platformId of initialData.platforms ?? []) {
    if (state[platformId]) {
      state[platformId].enabled = true;
    }
  }

  for (const criterion of initialData.criteria ?? []) {
    const platformId =
      criterion.platform ??
      initialData.platforms?.find((p) => state[p]?.enabled) ??
      SOCIAL_MEDIA_PLATFORMS[0].id;
    if (state[platformId]) {
      state[platformId].items.push({
        text: criterion.text,
        rpm: criterion.rpm.toString(),
      });
    }
  }

  return state;
}

function getEnabledPlatforms(state: PlatformCriteriaState): string[] {
  return SOCIAL_MEDIA_PLATFORMS.filter((p) => state[p.id]?.enabled).map(
    (p) => p.id,
  );
}

function flattenCriteria(state: PlatformCriteriaState): ProjectCriteria[] {
  const result: ProjectCriteria[] = [];
  for (const platform of SOCIAL_MEDIA_PLATFORMS) {
    const card = state[platform.id];
    if (!card?.enabled) continue;
    for (const item of card.items) {
      result.push({
        text: item.text,
        rpm: parseFloat(item.rpm) || 0,
        platform: platform.id,
      });
    }
  }
  return result;
}

export default function VideoUploadDialog({
  isOpen,
  onClose,
  onSubmit,
  channelId,
  initialData,
}: VideoUploadDialogProps) {
  const { t } = useI18n();
  const [videoLink, setVideoLink] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [budget, setBudget] = useState("");
  const [minViews, setMinViews] = useState("0");
  const [maxViews, setMaxViews] = useState("100000");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [platformCriteriaState, setPlatformCriteriaState] =
    useState<PlatformCriteriaState>(createInitialPlatformState);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeDurationPreset, setActiveDurationPreset] = useState<
    number | null
  >(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [resources, setResources] = useState<ResourceListItem[]>([]);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resourceImageRef = useRef<HTMLInputElement>(null);
  const resourceVideoRef = useRef<HTMLInputElement>(null);

  const steps = ["Video", "Budget", "Details", "Criteria", "Resources"];
  const isLastStep = currentStep === steps.length - 1;

  const enabledPlatforms = useMemo(
    () => getEnabledPlatforms(platformCriteriaState),
    [platformCriteriaState],
  );

  const criteria = useMemo(
    () => flattenCriteria(platformCriteriaState),
    [platformCriteriaState],
  );

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setVideoLink("");
      setVideoFile(null);
      setBudget("");
      setMinViews("0");
      setMaxViews("100000");
      setName("");
      setDescription("");
      setPlatformCriteriaState(createInitialPlatformState());
      setStartDate("");
      setEndDate("");
      setActiveDurationPreset(null);
      setResources([]);
      setLinkTitle("");
      setLinkUrl("");
      setErrors({});
      setSubmitSuccess(false);
      setCurrentStep(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (resourceImageRef.current) resourceImageRef.current.value = "";
      if (resourceVideoRef.current) resourceVideoRef.current.value = "";
    }
  }, [isOpen]);

  // Initialize form with initialData when dialog opens
  useEffect(() => {
    if (isOpen && initialData) {
      if (initialData.videoLink) setVideoLink(initialData.videoLink);
      if (initialData.budget !== undefined)
        setBudget(initialData.budget.toString());
      if (initialData.minViews !== undefined)
        setMinViews(initialData.minViews.toString());
      if (initialData.maxViews !== undefined)
        setMaxViews(initialData.maxViews.toString());
      if (initialData.name) setName(initialData.name);
      if (initialData.description) setDescription(initialData.description);
      setPlatformCriteriaState(platformStateFromInitialData(initialData));
      if (initialData.startDate) setStartDate(initialData.startDate);
      if (initialData.endDate) setEndDate(initialData.endDate);
    }
  }, [isOpen, initialData]);

  // Close modal on ESC key press and handle body scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        if (!file.type.startsWith("video/")) {
          setErrors((prev) => ({
            ...prev,
            videoFile: "Please select a video file",
          }));
          return;
        }
        setVideoFile(file);
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors.videoFile;
          return newErrors;
        });
      }
    },
    [],
  );

  const handlePlatformToggle = useCallback((platformId: string) => {
    setPlatformCriteriaState((prev) => ({
      ...prev,
      [platformId]: {
        ...prev[platformId],
        enabled: !prev[platformId].enabled,
      },
    }));
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.platforms;
      return newErrors;
    });
  }, []);

  const handlePlatformDraftChange = useCallback(
    (platformId: string, field: "draftText" | "draftRpm", value: string) => {
      setPlatformCriteriaState((prev) => ({
        ...prev,
        [platformId]: { ...prev[platformId], [field]: value },
      }));
    },
    [],
  );

  const handleAddPlatformCriterion = useCallback((platformId: string) => {
    setPlatformCriteriaState((prev) => {
      const card = prev[platformId];
      const text = card.draftText.trim();
      if (!text) return prev;
      return {
        ...prev,
        [platformId]: {
          ...card,
          items: [...card.items, { text, rpm: card.draftRpm }],
          draftText: "",
          draftRpm: "",
        },
      };
    });
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.criteria;
      return newErrors;
    });
  }, []);

  const handleRemovePlatformCriterion = useCallback(
    (platformId: string, index: number) => {
      setPlatformCriteriaState((prev) => ({
        ...prev,
        [platformId]: {
          ...prev[platformId],
          items: prev[platformId].items.filter((_, i) => i !== index),
        },
      }));
    },
    [],
  );

  const handleAddResourceLink = useCallback(() => {
    const url = linkUrl.trim();
    if (!url) {
      setErrors((prev) => ({
        ...prev,
        resources: "Please enter a link URL",
      }));
      return;
    }
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      setErrors((prev) => ({
        ...prev,
        resources: "Please enter a valid http(s) link",
      }));
      return;
    }
    setResources((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: "link",
        title: linkTitle.trim() || undefined,
        url,
      },
    ]);
    setLinkTitle("");
    setLinkUrl("");
    setErrors((prev) => {
      const next = { ...prev };
      delete next.resources;
      return next;
    });
  }, [linkTitle, linkUrl]);

  const handleAddResourceFile = useCallback(
    (type: "image" | "video", file: File) => {
      const valid =
        type === "image"
          ? file.type.startsWith("image/")
          : file.type.startsWith("video/");
      if (!valid) {
        setErrors((prev) => ({
          ...prev,
          resources:
            type === "image"
              ? "Please select an image file"
              : "Please select a video file",
        }));
        return;
      }
      setResources((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type,
          title: file.name,
          file,
          fileName: file.name,
        },
      ]);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.resources;
        return next;
      });
    },
    [],
  );

  const handleRemoveResource = useCallback((id: string) => {
    setResources((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const applyDurationPreset = useCallback((days: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setStartDate(formatLocalDate(today));
    setEndDate(addDays(today, days));
    setActiveDurationPreset(days);
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.startDate;
      delete newErrors.endDate;
      return newErrors;
    });
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    const budgetNum = parseFloat(budget);
    if (budget === "" || isNaN(budgetNum) || budgetNum < 0) {
      newErrors.budget = "Budget must be 0 or a positive number";
    }

    const minViewsNum = parseInt(minViews, 10);
    if (minViews === "" || isNaN(minViewsNum) || minViewsNum < 0) {
      newErrors.minViews = "Minimum views must be a non-negative number";
    }

    const maxViewsNum = parseInt(maxViews, 10);
    if (!maxViews || isNaN(maxViewsNum)) {
      newErrors.maxViews = "Maximum views is required";
    } else if (!isNaN(minViewsNum) && maxViewsNum <= minViewsNum) {
      newErrors.maxViews = "Maximum views must be greater than minimum views";
    }

    if (!name.trim()) {
      newErrors.name = "Project name is required";
    }

    if (!description.trim()) {
      newErrors.description = "Project description is required";
    }

    if (enabledPlatforms.length === 0) {
      newErrors.platforms = "Please select at least one social media platform";
    }

    if (criteria.length > 0) {
      const invalidCriteria = criteria.some((c) => c.rpm <= 0);
      if (invalidCriteria) {
        newErrors.criteria =
          "All criteria must have an RPM value greater than 0";
      }
    }

    if (!startDate.trim()) {
      newErrors.startDate = "Start date is required";
    }

    if (!endDate.trim()) {
      newErrors.endDate = "End date is required";
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end < start) {
        newErrors.endDate = "End date must be after or equal to start date";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [
    budget,
    minViews,
    maxViews,
    name,
    description,
    enabledPlatforms,
    criteria,
    startDate,
    endDate,
  ]);

  const validateStep = useCallback(
    (step: number): boolean => {
      const newErrors: Record<string, string> = {};

      if (step === 1) {
        const budgetNum = parseFloat(budget);
        if (!budget || isNaN(budgetNum) || budgetNum <= 0) {
          newErrors.budget = "Budget must be a positive number";
        }

        const minViewsNum = parseInt(minViews, 10);
        if (minViews === "" || isNaN(minViewsNum) || minViewsNum < 0) {
          newErrors.minViews = "Minimum views must be a non-negative number";
        }

        const maxViewsNum = parseInt(maxViews, 10);
        if (!maxViews || isNaN(maxViewsNum)) {
          newErrors.maxViews = "Maximum views is required";
        } else if (!isNaN(minViewsNum) && maxViewsNum <= minViewsNum) {
          newErrors.maxViews =
            "Maximum views must be greater than minimum views";
        }
      }

      if (step === 2) {
        if (!name.trim()) {
          newErrors.name = "Project name is required";
        }
        if (!description.trim()) {
          newErrors.description = "Project description is required";
        }
        if (!startDate) {
          newErrors.startDate = "Start date is required";
        }
        if (!endDate) {
          newErrors.endDate = "End date is required";
        } else if (startDate && new Date(endDate) < new Date(startDate)) {
          newErrors.endDate = "End date must be after or equal to start date";
        }
      }

      if (step === 3) {
        if (enabledPlatforms.length === 0) {
          newErrors.platforms =
            "Please select at least one social media platform";
        }
        if (criteria.length > 0) {
          const hasInvalidRpm = criteria.some((c) => !c.rpm || c.rpm <= 0);
          if (hasInvalidRpm) {
            newErrors.criteria =
              "All criteria must have an RPM value greater than 0";
          }
        }
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
    [
      budget,
      minViews,
      maxViews,
      name,
      description,
      enabledPlatforms,
      criteria,
      startDate,
      endDate,
    ],
  );

  const handleNext = useCallback(() => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  }, [currentStep, steps.length, validateStep]);

  const handleBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (currentStep < steps.length - 1) {
        handleNext();
        return;
      }

      if (!validateForm()) {
        return;
      }

      setIsSubmitting(true);
      setErrors({});

      try {
        const submissionData: ProjectSubmissionData = {
          videoLink: videoLink.trim() || undefined,
          videoFile: videoFile || undefined,
          budget: parseFloat(budget),
          minViews: parseInt(minViews, 10),
          maxViews: parseInt(maxViews, 10),
          name: name.trim(),
          description: description.trim(),
          platforms: enabledPlatforms,
          criteria,
          resources: resources.map((r) => ({
            type: r.type,
            title: r.title,
            url: r.url,
            file: r.file,
          })),
          startDate: startDate.trim(),
          endDate: endDate.trim(),
        };

        await onSubmit(submissionData);

        setSubmitSuccess(true);

        setTimeout(() => {
          onClose();
        }, 1500);
      } catch (error: any) {
        setErrors({
          submit:
            error.message || "Failed to submit project. Please try again.",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      currentStep,
      steps.length,
      handleNext,
      videoLink,
      videoFile,
      budget,
      minViews,
      maxViews,
      name,
      description,
      enabledPlatforms,
      criteria,
      resources,
      startDate,
      endDate,
      validateForm,
      onSubmit,
      onClose,
    ],
  );

  const videoSummary = videoLink
    ? t("projects.videoLinkProvided")
    : videoFile?.name || t("projects.videoNone");

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-navy-950/80 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-2xl bg-navy-950/90 border border-navy-800/60 rounded-2xl shadow-soft-xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 bg-navy-800/70 hover:bg-navy-700 rounded-full flex items-center justify-center text-gray-300 transition-colors"
          aria-label="Close dialog"
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

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-6 overflow-y-auto chat-scrollbar flex-1 min-h-0"
        >
          <div>
            <h2 className="text-2xl font-bold text-gray-100 mb-1">
              {t("projects.createVideoProject")}
            </h2>
            <p className="text-gray-500 text-sm">
              {t("projects.fillDetailsBelow")}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                Step {currentStep + 1} of {steps.length}
              </span>
              <span className="text-gray-300">{steps[currentStep]}</span>
            </div>
            <div className="w-full h-1 bg-navy-800/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400/80 transition-all"
                style={{
                  width: `${((currentStep + 1) / steps.length) * 100}%`,
                }}
              />
            </div>
          </div>

          {submitSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 px-4 py-3 rounded-xl">
              <div className="flex items-center gap-2">
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>{t("projects.projectSubmittedSuccess")}</span>
              </div>
            </div>
          )}

          {errors.submit && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-4 py-3 rounded-xl">
              {errors.submit}
            </div>
          )}

          {currentStep === 0 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-100">Video</h3>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t("projects.videoLink")}
                </label>
                <input
                  type="url"
                  value={videoLink}
                  onChange={(e) => setVideoLink(e.target.value)}
                  placeholder="https://example.com/video"
                  className="w-full px-4 py-2.5 bg-navy-900/60 text-white rounded-xl border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t("projects.uploadVideo")}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-500 file:text-white hover:file:bg-emerald-400 cursor-pointer"
                />
                {videoFile && (
                  <p className="mt-2 text-sm text-gray-400">
                    Selected: {videoFile.name} (
                    {(videoFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
                {errors.videoFile && (
                  <p className="mt-1 text-sm text-red-400">
                    {errors.videoFile}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {t("projects.provideVideoLinkOrFile")}
                </p>
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-100">
                Budget & Views
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t("projects.budgetGEL")}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={budget}
                  onChange={(e) => {
                    setBudget(e.target.value);
                    setErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.budget;
                      return newErrors;
                    });
                  }}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 bg-navy-900/60 text-white rounded-xl border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent"
                />
                {errors.budget && (
                  <p className="mt-1 text-sm text-red-400">{errors.budget}</p>
                )}
              </div>

              <div className="space-y-3">
                <div className="text-sm font-semibold text-gray-200">
                  {t("projects.viewCountRange")}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t("projects.minimumViews")}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={minViews}
                      onChange={(e) => {
                        setMinViews(e.target.value);
                        setErrors((prev) => {
                          const newErrors = { ...prev };
                          delete newErrors.minViews;
                          delete newErrors.maxViews;
                          return newErrors;
                        });
                      }}
                      placeholder="0"
                      className="w-full px-4 py-2.5 bg-navy-900/60 text-white rounded-xl border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent"
                    />
                    {errors.minViews && (
                      <p className="mt-1 text-sm text-red-400">
                        {errors.minViews}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      {t("projects.minimumViewsHelper")}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t("projects.maximumViews")}
                    </label>
                    <input
                      type="number"
                      min={minViews ? parseInt(minViews, 10) + 1 : undefined}
                      value={maxViews}
                      onChange={(e) => {
                        setMaxViews(e.target.value);
                        setErrors((prev) => {
                          const newErrors = { ...prev };
                          delete newErrors.maxViews;
                          return newErrors;
                        });
                      }}
                      placeholder="100000"
                      className="w-full px-4 py-2.5 bg-navy-900/60 text-white rounded-xl border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent"
                    />
                    {errors.maxViews && (
                      <p className="mt-1 text-sm text-red-400">
                        {errors.maxViews}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      {t("projects.mustBeGreaterThanMinimum")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-100">
                Project Details
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t("projects.projectName")}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.name;
                      return newErrors;
                    });
                  }}
                  placeholder={t("projects.enterProjectName")}
                  className="w-full px-4 py-2.5 bg-navy-900/60 text-white rounded-xl border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-400">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t("projects.description")}{" "}
                  <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.description;
                      return newErrors;
                    });
                  }}
                  placeholder={t("projects.enterProjectDescription")}
                  rows={4}
                  className="w-full px-4 py-2.5 bg-navy-900/60 text-white rounded-xl border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent resize-none"
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-400">
                    {errors.description}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div className="text-sm font-semibold text-gray-200">
                  {t("projects.projectDuration")}
                </div>

                <div className="flex flex-wrap gap-2">
                  {DURATION_PRESETS.map(({ days, key }) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => applyDurationPreset(days)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                        activeDurationPreset === days
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-200"
                          : "bg-navy-900/60 border-navy-800/60 text-gray-300 hover:border-navy-700/70"
                      }`}
                    >
                      {t(`projects.${key}`)}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t("projects.startDate")}
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setActiveDurationPreset(null);
                        setErrors((prev) => {
                          const newErrors = { ...prev };
                          delete newErrors.startDate;
                          delete newErrors.endDate;
                          return newErrors;
                        });
                      }}
                      min={formatLocalDate(new Date())}
                      className="w-full px-4 py-2.5 bg-navy-900/60 text-white rounded-xl border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent"
                    />
                    {errors.startDate && (
                      <p className="mt-1 text-sm text-red-400">
                        {errors.startDate}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t("projects.endDate")}
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setActiveDurationPreset(null);
                        setErrors((prev) => {
                          const newErrors = { ...prev };
                          delete newErrors.endDate;
                          return newErrors;
                        });
                      }}
                      min={startDate || formatLocalDate(new Date())}
                      className="w-full px-4 py-2.5 bg-navy-900/60 text-white rounded-xl border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent"
                    />
                    {errors.endDate && (
                      <p className="mt-1 text-sm text-red-400">
                        {errors.endDate}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      {t("projects.mustBeAfterOrEqualStartDate")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-100">
                Criteria
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  {t("projects.criteriaOptional")}
                </label>

                <div className="space-y-3">
                  {SOCIAL_MEDIA_PLATFORMS.map((platform) => {
                    const card = platformCriteriaState[platform.id];
                    return (
                      <div
                        key={platform.id}
                        className={`rounded-xl border p-4 transition-colors ${
                          card.enabled
                            ? "border-emerald-500/40 bg-emerald-500/5"
                            : "border-navy-800/60 bg-navy-900/40"
                        }`}
                      >
                        <label className="flex items-center gap-3 cursor-pointer mb-3">
                          <input
                            type="checkbox"
                            checked={card.enabled}
                            onChange={() => handlePlatformToggle(platform.id)}
                            className="w-4 h-4 text-emerald-500 bg-navy-900 border-navy-700 rounded focus:ring-emerald-400 focus:ring-2"
                          />
                          <span className="text-white font-medium">
                            {platform.label}
                          </span>
                          <span className="text-xs text-gray-500">
                            {t("projects.includePlatform")}
                          </span>
                        </label>

                        {card.enabled && (
                          <div className="space-y-3 pl-7">
                            {card.items.length > 0 ? (
                              <div className="space-y-2">
                                {card.items.map((item, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center gap-2 p-2 bg-navy-900/50 rounded-lg border border-navy-800/60"
                                  >
                                    <span className="flex-1 text-sm text-white">
                                      {item.text}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                      {t("projects.criterionRpm")}:{" "}
                                      {item.rpm || "0"}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRemovePlatformCriterion(
                                          platform.id,
                                          index,
                                        )
                                      }
                                      className="text-red-300 hover:text-red-200 transition-colors p-1"
                                      title="Remove criteria"
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
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500">
                                {t("projects.noCriteriaAdded")}
                              </p>
                            )}

                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                type="text"
                                value={card.draftText}
                                onChange={(e) =>
                                  handlePlatformDraftChange(
                                    platform.id,
                                    "draftText",
                                    e.target.value,
                                  )
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddPlatformCriterion(platform.id);
                                  }
                                }}
                                placeholder={t("projects.addCriterion")}
                                className="flex-1 px-3 py-2 bg-navy-900/60 text-white rounded-lg border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent text-sm"
                              />
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={card.draftRpm}
                                onChange={(e) =>
                                  handlePlatformDraftChange(
                                    platform.id,
                                    "draftRpm",
                                    e.target.value,
                                  )
                                }
                                placeholder={t("projects.criterionRpm")}
                                className="w-full sm:w-28 px-3 py-2 bg-navy-900/60 text-white rounded-lg border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent text-sm"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleAddPlatformCriterion(platform.id)
                                }
                                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-500/90 rounded-lg hover:bg-emerald-500 transition-colors"
                              >
                                {t("common.add")}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {errors.platforms && (
                  <p className="mt-2 text-sm text-red-400">
                    {errors.platforms}
                  </p>
                )}
                {errors.criteria && (
                  <p className="mt-2 text-sm text-red-400">{errors.criteria}</p>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  {t("projects.addCriteriaDescription")}
                </p>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-100">
                {t("projects.resourcesStepTitle")}
              </h3>
              <p className="text-sm text-gray-500">
                {t("projects.resourcesStepHelp")}
              </p>

              <div className="space-y-4">
                <div className="rounded-xl border border-navy-800/60 bg-navy-900/40 p-4 space-y-3">
                  <p className="text-sm font-medium text-gray-200">
                    {t("projects.addResourceLink")}
                  </p>
                  <input
                    type="text"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    placeholder={t("projects.resourceLinkTitle")}
                    className="w-full px-3 py-2 bg-navy-900/60 text-white rounded-lg border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 text-sm"
                  />
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder={t("projects.resourceLinkPlaceholder")}
                      className="flex-1 px-3 py-2 bg-navy-900/60 text-white rounded-lg border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleAddResourceLink}
                      className="px-4 py-2 text-sm font-semibold text-white bg-emerald-500/90 rounded-lg hover:bg-emerald-500 transition-colors"
                    >
                      {t("common.add")}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-navy-800/60 bg-navy-900/40 p-4">
                    <p className="text-sm font-medium text-gray-200 mb-2">
                      {t("projects.uploadResourceImage")}
                    </p>
                    <input
                      ref={resourceImageRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAddResourceFile("image", file);
                        if (resourceImageRef.current)
                          resourceImageRef.current.value = "";
                      }}
                      className="block w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-500 file:text-white hover:file:bg-emerald-400 cursor-pointer"
                    />
                  </div>
                  <div className="rounded-xl border border-navy-800/60 bg-navy-900/40 p-4">
                    <p className="text-sm font-medium text-gray-200 mb-2">
                      {t("projects.uploadResourceVideo")}
                    </p>
                    <input
                      ref={resourceVideoRef}
                      type="file"
                      accept="video/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAddResourceFile("video", file);
                        if (resourceVideoRef.current)
                          resourceVideoRef.current.value = "";
                      }}
                      className="block w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-500 file:text-white hover:file:bg-emerald-400 cursor-pointer"
                    />
                  </div>
                </div>

                {resources.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-200">
                      {t("projects.addedResources")}
                    </p>
                    {resources.map((resource) => (
                      <div
                        key={resource.id}
                        className="flex items-center gap-3 p-3 bg-navy-900/50 rounded-xl border border-navy-800/60"
                      >
                        <span className="text-xs uppercase tracking-wide text-emerald-300 font-semibold w-14 shrink-0">
                          {resource.type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">
                            {resource.title ||
                              resource.fileName ||
                              resource.url}
                          </p>
                          {resource.url && resource.type === "link" && (
                            <p className="text-xs text-gray-500 truncate">
                              {resource.url}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveResource(resource.id)}
                          className="text-red-300 hover:text-red-200 transition-colors p-1 shrink-0"
                          title="Remove resource"
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
                      </div>
                    ))}
                  </div>
                )}

                {errors.resources && (
                  <p className="text-sm text-red-400">{errors.resources}</p>
                )}
              </div>

              <div className="rounded-xl border border-navy-800/60 bg-navy-900/50 p-4 text-sm text-gray-300">
                <p className="text-sm font-semibold text-gray-200 mb-3">
                  {t("projects.reviewSummary")}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-gray-500">Video:</span> {videoSummary}
                  </div>
                  <div>
                    <span className="text-gray-500">Budget:</span>{" "}
                    {budget ? `₾${budget}` : "-"}
                  </div>
                  <div>
                    <span className="text-gray-500">Views:</span>{" "}
                    {minViews && maxViews ? `${minViews} - ${maxViews}` : "-"}
                  </div>
                  <div>
                    <span className="text-gray-500">Dates:</span>{" "}
                    {startDate && endDate ? `${startDate} → ${endDate}` : "-"}
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-gray-500">Platforms:</span>{" "}
                    {enabledPlatforms.length
                      ? enabledPlatforms.join(", ")
                      : "-"}
                  </div>
                  {criteria.length > 0 && (
                    <div className="sm:col-span-2 space-y-1">
                      <span className="text-gray-500">Criteria:</span>
                      {SOCIAL_MEDIA_PLATFORMS.filter(
                        (p) => platformCriteriaState[p.id]?.items.length,
                      ).map((platform) => (
                        <div key={platform.id} className="pl-2">
                          <span className="text-emerald-300 text-xs">
                            {platform.label}:
                          </span>{" "}
                          {platformCriteriaState[platform.id].items
                            .map((c) => c.text)
                            .join(", ")}
                        </div>
                      ))}
                    </div>
                  )}
                  {resources.length > 0 && (
                    <div className="sm:col-span-2">
                      <span className="text-gray-500">Resources:</span>{" "}
                      {resources.length}{" "}
                      {resources.length === 1 ? "item" : "items"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-navy-800/60">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 0 || isSubmitting}
              className="px-4 py-2 text-sm font-semibold text-gray-300 bg-navy-900/60 border border-navy-800/60 rounded-lg hover:bg-navy-800/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-semibold text-gray-300 bg-navy-900/60 border border-navy-800/60 rounded-lg hover:bg-navy-800/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={isSubmitting || submitSuccess}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-500/90 rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-white"
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
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>{t("projects.submitting")}</span>
                  </>
                ) : submitSuccess ? (
                  <span>{t("projects.submitted")}</span>
                ) : (
                  <span>
                    {isLastStep
                      ? Number(budget) > 0
                        ? t("projects.payAndPublish", { amount: budget }) ||
                          `Pay & Publish ₾${budget}`
                        : t("projects.submitProject") || "Submit project"
                      : "Next"}
                  </span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
