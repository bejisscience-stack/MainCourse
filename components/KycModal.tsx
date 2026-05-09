"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/contexts/I18nContext";
import { useKycSubmission } from "@/hooks/useKycSubmission";
import type { KycDocType, KycSubmission } from "@/types/kyc";

interface KycModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Latest submission (used when reopening in pending or rejected state) */
  submission?: KycSubmission | null;
  /** Current KYC status; controls which screen we open into */
  currentStatus?: "not_submitted" | "pending" | "verified" | "rejected";
  /** Called once submission finishes successfully */
  onSubmitted?: () => void;
}

type Step =
  | "doc-type"
  | "doc-front"
  | "doc-back"
  | "phone"
  | "selfie"
  | "review"
  | "pending";

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB
const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Accepts (after stripping spaces and hyphens):
//   - 9 digits starting with 5  (e.g. 5XXXXXXXX)
//   - exactly 12 digits          (e.g. 995XXXXXXXXX)
//   - "+" followed by 12 digits  (e.g. +995XXXXXXXXX)
const PHONE_REGEX = /^(?:5\d{8}|\+?\d{12})$/;

function normalizePhone(raw: string): string {
  const s = raw.replace(/[\s-]/g, "");
  if (/^5\d{8}$/.test(s)) return `+995${s}`;
  if (/^\d{12}$/.test(s)) return `+${s}`;
  return s;
}

function buildSteps(docType: KycDocType | null): Step[] {
  if (docType === "passport") {
    return ["doc-type", "doc-front", "phone", "selfie", "review"];
  }
  return ["doc-type", "doc-front", "doc-back", "phone", "selfie", "review"];
}

function bytesToMb(n: number): string {
  return (n / (1024 * 1024)).toFixed(1);
}

export default function KycModal({
  isOpen,
  onClose,
  submission,
  currentStatus = "not_submitted",
  onSubmitted,
}: KycModalProps) {
  const { t } = useI18n();
  const { submitKyc, isSubmitting } = useKycSubmission();

  // ---------- mount + portal ----------
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // ---------- form state ----------
  const [docType, setDocType] = useState<KycDocType | null>(null);
  const [docFront, setDocFront] = useState<File | null>(null);
  const [docFrontPreview, setDocFrontPreview] = useState<string | null>(null);
  const [docBack, setDocBack] = useState<File | null>(null);
  const [docBackPreview, setDocBackPreview] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // selfie
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const selfieFileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Token bumped on every stop / new request so an in-flight getUserMedia
  // promise that resolves AFTER the user navigates or closes the modal can
  // detect that it's stale and stop the tracks instead of leaking the camera.
  const cameraReqRef = useRef(0);
  const mountedRef = useRef(true);
  const [permState, setPermState] = useState<
    | "idle"
    | "requesting"
    | "granted"
    | "denied-browser"
    | "denied-os"
    | "busy"
    | "notfound"
    | "insecure"
    | "unavailable"
  >("idle");
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  // step state — start screen depends on currentStatus
  const [step, setStep] = useState<Step>("doc-type");
  const [showRejectedScreen, setShowRejectedScreen] = useState(false);

  const steps = useMemo(() => buildSteps(docType), [docType]);

  // Compute progress index excluding 'pending' (which is post-submit)
  const stepIndex = Math.max(0, steps.indexOf(step));
  const progressPercent = Math.round(((stepIndex + 1) / steps.length) * 100);

  // ---------- preview refs ----------
  // Hold latest preview values in a ref so cleanup paths (which run with stale
  // closures) can revoke the *current* URLs.
  const previewsRef = useRef<{
    front: string | null;
    back: string | null;
    selfie: string | null;
  }>({ front: null, back: null, selfie: null });

  useEffect(() => {
    previewsRef.current.front = docFrontPreview;
  }, [docFrontPreview]);
  useEffect(() => {
    previewsRef.current.back = docBackPreview;
  }, [docBackPreview]);
  useEffect(() => {
    previewsRef.current.selfie = selfiePreview;
  }, [selfiePreview]);

  // ---------- form reset helper ----------
  // Revokes preview blob URLs and clears all form state. Called when the modal
  // closes (isOpen=false) and on the rejected-state reset path. The component
  // stays mounted in settings/page.tsx (parent just renders null based on the
  // gate) so an unmount-only cleanup wouldn't run on close.
  const resetForm = useCallback(() => {
    const { front, back, selfie } = previewsRef.current;
    if (front) URL.revokeObjectURL(front);
    if (back) URL.revokeObjectURL(back);
    if (selfie) URL.revokeObjectURL(selfie);
    previewsRef.current = { front: null, back: null, selfie: null };
    setDocType(null);
    setDocFront(null);
    setDocFrontPreview(null);
    setDocBack(null);
    setDocBackPreview(null);
    setPhone("");
    setSelfieBlob(null);
    setSelfiePreview(null);
    setSubmitError(null);
    setFileError(null);
    setPhoneError(null);
  }, []);

  // ---------- open/reset behaviour ----------
  useEffect(() => {
    if (!isOpen) {
      // Modal closed (parent flipped showKycModal to false). Clear blob URLs
      // and form state so the next open starts fresh and we don't leak
      // ObjectURLs for the lifetime of the page.
      resetForm();
      stopCameraImpl();
      return;
    }
    setSubmitError(null);
    setFileError(null);
    setPhoneError(null);
    if (currentStatus === "pending") {
      setStep("pending");
      setShowRejectedScreen(false);
    } else if (currentStatus === "rejected") {
      setShowRejectedScreen(true);
      setStep("doc-type");
      // User must redo every step — drop everything including preview URLs.
      resetForm();
    } else {
      setShowRejectedScreen(false);
      setStep("doc-type");
    }
  }, [isOpen, currentStatus, resetForm]);

  // ---------- mount tracking + final unmount cleanup ----------
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const { front, back, selfie } = previewsRef.current;
      if (front) URL.revokeObjectURL(front);
      if (back) URL.revokeObjectURL(back);
      if (selfie) URL.revokeObjectURL(selfie);
      stopCameraImpl();
    };
    // Run-once mount/unmount cleanup. Deps intentionally empty: stopCameraImpl
    // only touches refs, and revoking the latest object URLs at unmount is the
    // whole point — re-running the cleanup mid-lifecycle would be wrong.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCameraImpl = () => {
    // Bump request token so any in-flight getUserMedia promise observes that
    // it's stale on resolve and stops the tracks itself.
    cameraReqRef.current += 1;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // ---------- camera ----------
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermState("unavailable");
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setPermState("insecure");
      return;
    }
    setFileError(null);
    setPermState("requesting");
    const myReqId = ++cameraReqRef.current;

    const tryGet = (constraints: MediaStreamConstraints) =>
      navigator.mediaDevices.getUserMedia(constraints);

    try {
      let stream: MediaStream;
      try {
        stream = await tryGet({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (firstErr: any) {
        // Loosen constraints only for hardware/constraint errors. Permission
        // errors must propagate so we don't double-prompt or mask them.
        const name = firstErr?.name;
        const retryable =
          name === "OverconstrainedError" ||
          name === "ConstraintNotSatisfiedError" ||
          name === "NotFoundError" ||
          name === "NotReadableError";
        if (!retryable) throw firstErr;
        stream = await tryGet({ video: true, audio: false });
      }
      // The user may have already closed the modal, navigated, or moved past
      // the selfie step while the permission prompt was open. If so, drop the
      // stream immediately rather than leaking the camera.
      if (!mountedRef.current || cameraReqRef.current !== myReqId) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      // Recheck after the play() await — same race window
      if (!mountedRef.current || cameraReqRef.current !== myReqId) {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        return;
      }
      setPermState("granted");
    } catch (err: any) {
      if (!mountedRef.current || cameraReqRef.current !== myReqId) return;
      // Surface the DOMException name to devtools so support can diagnose
      // without round-trips. No PII, no media bytes.
      // eslint-disable-next-line no-console
      console.warn("[KYC] getUserMedia failed:", err?.name, err?.message);

      const name = err?.name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        // Distinguish browser-level block from OS-level block. If the browser
        // thinks permission is granted but the call still fails, the block is
        // at the OS / antivirus / hardware layer.
        let osLevel = false;
        try {
          const status = await navigator.permissions?.query?.({
            name: "camera" as PermissionName,
          });
          if (status?.state === "granted") osLevel = true;
        } catch {
          /* Permissions API not supported (Safari < 16) */
        }
        setPermState(osLevel ? "denied-os" : "denied-browser");
        return;
      }
      if (
        name === "NotReadableError" ||
        name === "TrackStartError" ||
        name === "AbortError"
      ) {
        setPermState("busy");
        return;
      }
      if (
        name === "NotFoundError" ||
        name === "OverconstrainedError" ||
        name === "DevicesNotFoundError"
      ) {
        setPermState("notfound");
        return;
      }
      if (name === "SecurityError") {
        setPermState("insecure");
        return;
      }
      setPermState("unavailable");
    }
  }, []);

  const captureSelfie = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (selfiePreview) URL.revokeObjectURL(selfiePreview);
        setSelfieBlob(blob);
        setSelfiePreview(URL.createObjectURL(blob));
        stopCameraImpl();
        setPermState("idle");
      },
      "image/jpeg",
      0.9,
    );
  }, [selfiePreview]);

  const retakeSelfie = useCallback(() => {
    if (selfiePreview) URL.revokeObjectURL(selfiePreview);
    setSelfieBlob(null);
    setSelfiePreview(null);
    void startCamera();
  }, [selfiePreview, startCamera]);

  const handleSelfieUpload = (file: File | null) => {
    setFileError(null);
    if (!file) return;
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      setFileError(t("kyc.errors.invalidImage"));
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError(
        t("kyc.errors.fileTooLarge", { max: bytesToMb(MAX_FILE_BYTES) }),
      );
      return;
    }
    stopCameraImpl();
    if (selfiePreview) URL.revokeObjectURL(selfiePreview);
    setSelfieBlob(file);
    setSelfiePreview(URL.createObjectURL(file));
    setPermState("idle");
  };

  // Manage camera lifecycle. isOpen is in deps so closing the modal stops the
  // stream even when the parent flips showKycModal directly without going
  // through handleClose. startCamera/stopCameraImpl are deliberately omitted
  // from deps: stopCameraImpl is recreated every render (would cause a
  // stream-restart loop), and we only want this effect to fire on the precise
  // lifecycle transitions captured here, not on every callback identity bump.
  useEffect(() => {
    if (isOpen && step === "selfie" && !selfieBlob) {
      void startCamera();
    } else {
      stopCameraImpl();
      setPermState((curr) =>
        curr === "requesting" || curr === "granted" ? "idle" : curr,
      );
    }
    return () => {
      stopCameraImpl();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, step, selfieBlob]);

  // ---------- close handling ----------
  const handleClose = useCallback(() => {
    if (isSubmitting || permState === "requesting") return;
    stopCameraImpl();
    onClose();
  }, [isSubmitting, permState, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, handleClose]);

  // ---------- file handlers ----------
  const handleFile = useCallback(
    (kind: "front" | "back", file: File | null) => {
      setFileError(null);
      if (!file) return;
      if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
        setFileError(t("kyc.errors.invalidImage"));
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setFileError(
          t("kyc.errors.fileTooLarge", { max: bytesToMb(MAX_FILE_BYTES) }),
        );
        return;
      }
      const url = URL.createObjectURL(file);
      if (kind === "front") {
        if (docFrontPreview) URL.revokeObjectURL(docFrontPreview);
        setDocFront(file);
        setDocFrontPreview(url);
      } else {
        if (docBackPreview) URL.revokeObjectURL(docBackPreview);
        setDocBack(file);
        setDocBackPreview(url);
      }
    },
    [t, docFrontPreview, docBackPreview],
  );

  // ---------- step navigation ----------
  const canAdvance = useMemo(() => {
    switch (step) {
      case "doc-type":
        return !!docType;
      case "doc-front":
        return !!docFront;
      case "doc-back":
        return !!docBack;
      case "phone":
        return PHONE_REGEX.test(phone.replace(/[\s-]/g, ""));
      case "selfie":
        return !!selfieBlob;
      case "review":
        return true;
      default:
        return false;
    }
  }, [step, docType, docFront, docBack, phone, selfieBlob]);

  const goNext = useCallback(() => {
    if (!canAdvance) {
      if (step === "phone" && !PHONE_REGEX.test(phone.replace(/[\s-]/g, ""))) {
        setPhoneError(t("kyc.errors.invalidPhone"));
      }
      return;
    }
    setPhoneError(null);
    const i = steps.indexOf(step);
    if (i < 0 || i >= steps.length - 1) return;
    setStep(steps[i + 1]);
  }, [canAdvance, step, steps, phone, t]);

  const goBack = useCallback(() => {
    const i = steps.indexOf(step);
    if (i <= 0) return;
    setStep(steps[i - 1]);
  }, [step, steps]);

  // ---------- submit ----------
  const handleSubmit = useCallback(async () => {
    if (!docType || !docFront || !selfieBlob) return;
    setSubmitError(null);
    try {
      await submitKyc({
        docType,
        docFront,
        docBack: docType === "passport" ? null : docBack,
        selfie: selfieBlob,
        phone: normalizePhone(phone),
      });
      setStep("pending");
      onSubmitted?.();
    } catch (e: any) {
      setSubmitError(e?.message || t("kyc.errors.submitFailed"));
    }
  }, [
    docType,
    docFront,
    docBack,
    selfieBlob,
    phone,
    submitKyc,
    onSubmitted,
    t,
  ]);

  // ---------- early returns ----------
  if (!isOpen || !mounted) return null;

  const docTypeLabels: Record<KycDocType, string> = {
    id_card: t("kyc.steps.docType.idCard"),
    passport: t("kyc.steps.docType.passport"),
    drivers_license: t("kyc.steps.docType.driversLicense"),
  };

  // ---------- screens ----------

  const RejectedScreen = (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-2xl border border-red-300 bg-red-50 p-5 dark:border-red-800 dark:bg-red-900/20">
        <svg
          className="mt-0.5 h-6 w-6 flex-shrink-0 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="text-red-900 dark:text-red-200">
          <p className="font-semibold">{t("kyc.steps.rejected.title")}</p>
          {submission?.admin_notes ? (
            <p className="mt-2 text-sm">
              <span className="font-medium">
                {t("kyc.steps.rejected.adminNote")}:
              </span>{" "}
              {submission.admin_notes}
            </p>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setShowRejectedScreen(false)}
        className="w-full rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-600"
      >
        {t("kyc.steps.rejected.resubmit")}
      </button>
    </div>
  );

  const DocTypeScreen = (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-charcoal-950 dark:text-white">
          {t("kyc.steps.docType.title")}
        </h3>
        <p className="mt-1 text-charcoal-600 dark:text-gray-400">
          {t("kyc.steps.docType.subtitle")}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(
          [
            ["id_card", t("kyc.steps.docType.idCardDesc")],
            ["passport", t("kyc.steps.docType.passportDesc")],
            ["drivers_license", t("kyc.steps.docType.driversLicenseDesc")],
          ] as Array<[KycDocType, string]>
        ).map(([type, desc]) => {
          const selected = docType === type;
          return (
            <button
              type="button"
              key={type}
              onClick={() => setDocType(type)}
              className={`flex flex-col items-start rounded-2xl border p-4 text-left transition-colors ${
                selected
                  ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500 dark:bg-emerald-900/20"
                  : "border-charcoal-200 bg-white hover:border-emerald-300 dark:border-navy-600 dark:bg-navy-700/40 dark:hover:border-emerald-500"
              }`}
            >
              <span className="text-base font-semibold text-charcoal-950 dark:text-white">
                {docTypeLabels[type]}
              </span>
              <span className="mt-1 text-sm text-charcoal-600 dark:text-gray-400">
                {desc}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const fileInput = (kind: "front" | "back") => {
    const preview = kind === "front" ? docFrontPreview : docBackPreview;
    const file = kind === "front" ? docFront : docBack;
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-2xl font-bold text-charcoal-950 dark:text-white">
            {kind === "front"
              ? t("kyc.steps.docFront.title")
              : t("kyc.steps.docBack.title")}
          </h3>
          <p className="mt-1 text-charcoal-600 dark:text-gray-400">
            {kind === "front"
              ? t("kyc.steps.docFront.helper")
              : t("kyc.steps.docBack.helper")}
          </p>
        </div>

        <label
          htmlFor={`kyc-doc-${kind}`}
          className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-charcoal-300 bg-charcoal-50/50 p-6 text-center transition-colors hover:border-emerald-400 dark:border-navy-600 dark:bg-navy-700/40"
        >
          {preview ? (
            // blob: URL — next/image can't optimize blobs and these are
            // revoked on unmount, so caching would point at a dead URL.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={kind}
              className="mb-3 max-h-64 rounded-xl object-contain"
            />
          ) : (
            <svg
              className="mb-3 h-12 w-12 text-charcoal-400 dark:text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 16.5V19a2 2 0 002 2h14a2 2 0 002-2v-2.5M16 8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
          )}
          <span className="text-sm font-medium text-charcoal-800 dark:text-gray-200">
            {file ? file.name : t("kyc.steps.docFront.choose")}
          </span>
          <span className="mt-1 text-xs text-charcoal-500 dark:text-gray-500">
            JPG / PNG / WEBP · ≤ {bytesToMb(MAX_FILE_BYTES)} MB
          </span>
          <input
            id={`kyc-doc-${kind}`}
            type="file"
            accept={ACCEPTED_MIME_TYPES.join(",")}
            className="hidden"
            onChange={(e) => handleFile(kind, e.target.files?.[0] ?? null)}
          />
        </label>

        {fileError ? (
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {fileError}
          </div>
        ) : null}
      </div>
    );
  };

  const PhoneScreen = (
    <div className="space-y-4">
      <div>
        <h3 className="text-2xl font-bold text-charcoal-950 dark:text-white">
          {t("kyc.steps.phone.title")}
        </h3>
        <p className="mt-1 text-charcoal-600 dark:text-gray-400">
          {t("kyc.steps.phone.helper")}
        </p>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-charcoal-800 dark:text-gray-300">
          {t("kyc.steps.phone.label")}
        </span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setPhoneError(null);
          }}
          placeholder="5XX XXX XXX  /  995XXXXXXXXX  /  +995XXXXXXXXX"
          className="w-full rounded-xl border border-charcoal-300 bg-white px-4 py-3 text-base text-charcoal-950 placeholder-charcoal-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-navy-600 dark:bg-navy-700 dark:text-white dark:placeholder-gray-500"
        />
      </label>
      {phoneError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{phoneError}</p>
      ) : null}
    </div>
  );

  const SelfieScreen = (
    <div className="space-y-4">
      <div>
        <h3 className="text-2xl font-bold text-charcoal-950 dark:text-white">
          {t("kyc.steps.selfie.title")}
        </h3>
        <p className="mt-1 text-charcoal-600 dark:text-gray-400">
          {t("kyc.steps.selfie.subtitle")}
        </p>
      </div>

      {selfiePreview ? (
        <div className="space-y-3">
          {/* blob: URL from camera capture — next/image can't optimize blobs
              and the URL is revoked on unmount. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selfiePreview}
            alt="selfie"
            className="h-[260px] w-full rounded-2xl object-cover sm:h-[320px]"
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={retakeSelfie}
              className="flex-1 rounded-xl border border-charcoal-300 bg-white px-4 py-3 font-medium text-charcoal-950 hover:bg-charcoal-50 dark:border-navy-600 dark:bg-navy-700 dark:text-white dark:hover:bg-navy-600"
            >
              {t("kyc.steps.selfie.retake")}
            </button>
            <button
              type="button"
              onClick={() => selfieFileInputRef.current?.click()}
              className="flex-1 rounded-xl border border-charcoal-300 bg-white px-4 py-3 font-medium text-charcoal-950 hover:bg-charcoal-50 dark:border-navy-600 dark:bg-navy-700 dark:text-white dark:hover:bg-navy-600"
            >
              {t("kyc.steps.selfie.uploadFromDevice")}
            </button>
            <input
              ref={selfieFileInputRef}
              type="file"
              accept={ACCEPTED_MIME_TYPES.join(",")}
              className="hidden"
              onChange={(e) => {
                handleSelfieUpload(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-2xl bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-[260px] w-full object-cover sm:h-[320px]"
            />
            {permState === "requesting" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-sm text-white">
                <svg
                  className="h-8 w-8 animate-spin"
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
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                <span>{t("kyc.steps.selfie.requesting")}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void startCamera()}
              disabled={permState === "requesting"}
              className="flex-1 rounded-xl border border-charcoal-300 bg-white px-4 py-3 font-medium text-charcoal-950 hover:bg-charcoal-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-navy-600 dark:bg-navy-700 dark:text-white dark:hover:bg-navy-600"
            >
              {t("kyc.steps.selfie.startCamera")}
            </button>
            <button
              type="button"
              onClick={() => selfieFileInputRef.current?.click()}
              className="flex-1 rounded-xl border border-charcoal-300 bg-white px-4 py-3 font-medium text-charcoal-950 hover:bg-charcoal-50 dark:border-navy-600 dark:bg-navy-700 dark:text-white dark:hover:bg-navy-600"
            >
              {t("kyc.steps.selfie.uploadFromDevice")}
            </button>
            <input
              ref={selfieFileInputRef}
              type="file"
              accept={ACCEPTED_MIME_TYPES.join(",")}
              className="hidden"
              onChange={(e) => {
                handleSelfieUpload(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </div>

          {permState === "requesting" ? (
            <div className="rounded-xl border border-charcoal-200 bg-charcoal-50 px-4 py-3 text-sm text-charcoal-700 dark:border-navy-600 dark:bg-navy-700/40 dark:text-gray-300">
              {t("kyc.steps.selfie.requesting")}
            </div>
          ) : null}

          {permState === "denied-browser" ||
          permState === "denied-os" ||
          permState === "busy" ||
          permState === "notfound" ||
          permState === "insecure" ||
          permState === "unavailable" ? (
            <div className="space-y-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              <p className="whitespace-pre-line">
                {t(
                  permState === "denied-browser"
                    ? "kyc.errors.cameraDeniedBrowser"
                    : permState === "denied-os"
                      ? "kyc.errors.cameraDeniedOs"
                      : permState === "busy"
                        ? "kyc.errors.cameraBusy"
                        : permState === "notfound"
                          ? "kyc.errors.cameraNotFound"
                          : permState === "insecure"
                            ? "kyc.errors.cameraInsecure"
                            : "kyc.errors.cameraUnavailable",
                )}
              </p>
              {permState !== "notfound" && permState !== "insecure" ? (
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                >
                  {t("kyc.steps.selfie.startCamera")}
                </button>
              ) : null}
            </div>
          ) : null}

          {permState === "granted" ? (
            <button
              type="button"
              onClick={captureSelfie}
              className="w-full rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-600"
            >
              {t("kyc.steps.selfie.capture")}
            </button>
          ) : null}

          <canvas ref={canvasRef} className="hidden" />
        </>
      )}

      {fileError ? (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {fileError}
        </div>
      ) : null}
    </div>
  );

  const ReviewScreen = (
    <div className="space-y-5">
      <div>
        <h3 className="text-2xl font-bold text-charcoal-950 dark:text-white">
          {t("kyc.steps.review.title")}
        </h3>
        <p className="mt-1 text-charcoal-600 dark:text-gray-400">
          {t("kyc.steps.review.subtitle")}
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-charcoal-200 bg-charcoal-50/50 p-4 dark:border-navy-600 dark:bg-navy-700/40">
        <div className="flex justify-between">
          <span className="text-charcoal-600 dark:text-gray-400">
            {t("kyc.steps.review.docType")}
          </span>
          <span className="font-semibold text-charcoal-950 dark:text-white">
            {docType ? docTypeLabels[docType] : "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-charcoal-600 dark:text-gray-400">
            {t("kyc.steps.review.phone")}
          </span>
          <span className="font-semibold text-charcoal-950 dark:text-white">
            {phone}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* All three previews are blob: URLs — next/image can't optimize
              blobs, and they're revoked on unmount. */}
          {docFrontPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={docFrontPreview}
              alt="front"
              className="aspect-square w-full rounded-lg object-cover"
            />
          ) : null}
          {docType !== "passport" && docBackPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={docBackPreview}
              alt="back"
              className="aspect-square w-full rounded-lg object-cover"
            />
          ) : null}
          {selfiePreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selfiePreview}
              alt="selfie"
              className="aspect-square w-full rounded-lg object-cover"
            />
          ) : null}
        </div>
      </div>

      {submitError ? (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {submitError}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? (
          <>
            <svg
              className="h-4 w-4 animate-spin text-white"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                className="opacity-25"
              />
              <path
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                className="opacity-75"
              />
            </svg>
            <span>{t("kyc.steps.review.submitting")}</span>
          </>
        ) : (
          <span>{t("kyc.steps.review.submit")}</span>
        )}
      </button>
    </div>
  );

  const PendingScreen = (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
        <svg
          className="h-10 w-10 text-emerald-500"
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
      <div>
        <h3 className="text-2xl font-bold text-charcoal-950 dark:text-white">
          {t("kyc.steps.review.pendingTitle")}
        </h3>
        <p className="mt-2 text-charcoal-600 dark:text-gray-400">
          {t("kyc.steps.review.pendingBody")}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-600"
      >
        {t("kyc.nav.close")}
      </button>
    </div>
  );

  let body: React.ReactNode;
  if (showRejectedScreen) {
    body = RejectedScreen;
  } else if (step === "doc-type") body = DocTypeScreen;
  else if (step === "doc-front") body = fileInput("front");
  else if (step === "doc-back") body = fileInput("back");
  else if (step === "phone") body = PhoneScreen;
  else if (step === "selfie") body = SelfieScreen;
  else if (step === "review") body = ReviewScreen;
  else body = PendingScreen;

  const showFooter =
    !showRejectedScreen && step !== "pending" && step !== "review";

  const dialogContent = (
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto bg-black/80 p-4 dark:bg-black/90 sm:p-6"
      onClick={handleClose}
    >
      <div
        className="relative mx-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-charcoal-200 bg-white shadow-2xl dark:border-navy-600 dark:bg-navy-800"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          disabled={isSubmitting || permState === "requesting"}
          aria-label={t("common.close") || "Close"}
          className="absolute right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-charcoal-100 text-charcoal-600 shadow-lg transition-colors hover:bg-charcoal-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-navy-700 dark:text-gray-300 dark:hover:bg-navy-600"
        >
          <svg
            className="h-5 w-5"
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

        <div className="max-h-[88vh] overflow-y-auto px-4 py-8 sm:px-6 sm:py-10">
          {/* Header + progress */}
          {step !== "pending" ? (
            <div className="mb-8 space-y-3">
              <h2 className="text-3xl font-bold text-charcoal-950 dark:text-white">
                {t("kyc.modal.title")}
              </h2>
              <p className="text-charcoal-600 dark:text-gray-400">
                {t("kyc.modal.subtitle")}
              </p>

              {!showRejectedScreen ? (
                <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-charcoal-100 dark:bg-navy-700">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <div>{body}</div>

          {showFooter ? (
            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={goBack}
                disabled={steps.indexOf(step) === 0}
                className="rounded-xl border border-charcoal-300 bg-white px-6 py-3 font-medium text-charcoal-950 transition-colors hover:bg-charcoal-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-navy-600 dark:bg-navy-700 dark:text-white dark:hover:bg-navy-600"
              >
                {t("kyc.nav.back")}
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!canAdvance}
                className="rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("kyc.nav.next")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
}
