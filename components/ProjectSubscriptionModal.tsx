'use client';

import { useState } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { useProjectAccess } from '@/hooks/useProjectAccess';
import { useUser } from '@/hooks/useUser';
import { createBrowserClient } from '@/lib/supabase/client';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from 'sonner';

interface ProjectSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  courseId?: string;
}

const BANK_ACCOUNT = 'GE00BG0000000013231';
const SUBSCRIPTION_PRICE = 10.0;

/**
 * Modal for project subscription purchase workflow.
 * 4 views:
 * 1. Status (if pending/active/rejected)
 * 2. Payment (default)
 * 3. Loading
 * 4. Error
 */
export default function ProjectSubscriptionModal({
  isOpen,
  onClose,
  onSuccess,
  courseId,
}: ProjectSubscriptionModalProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const { user } = useUser();
  const { subscription, hasActiveSubscription } = useProjectAccess(user?.id);

  const [step, setStep] = useState<'status' | 'payment' | 'upload' | 'loading' | 'error'>('payment');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createBrowserClient();

  // Show status view if user has existing subscription
  if (subscription) {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 bg-navy-950/80 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-navy-900/95 border border-navy-800/60 rounded-2xl shadow-soft-xl p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-200"
          >
            ✕
          </button>
          <h2 className="text-2xl font-bold text-white mb-4">{t('projectSubscription')}</h2>
        <div className="space-y-4">
          {subscription.status === 'pending' && (
            <div className={`p-4 rounded-lg border-2 ${
              theme.isDark ? 'border-blue-500 bg-blue-500/10' : 'border-blue-400 bg-blue-50'
            }`}>
              <p className={`text-sm font-semibold ${theme.isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                {t('pendingApproval')}
              </p>
              <p className={`text-xs ${theme.isDark ? 'text-blue-200' : 'text-blue-600'} mt-1`}>
                {t('subscriptionPendingMessage')}
              </p>
            </div>
          )}

          {subscription.status === 'active' && subscription.expires_at && (
            <div className={`p-4 rounded-lg border-2 ${
              theme.isDark ? 'border-green-500 bg-green-500/10' : 'border-green-400 bg-green-50'
            }`}>
              <p className={`text-sm font-semibold ${theme.isDark ? 'text-green-300' : 'text-green-700'}`}>
                {t('subscriptionActive')}
              </p>
              <p className={`text-xs ${theme.isDark ? 'text-green-200' : 'text-green-600'} mt-1`}>
                {t('expiresOn')} {new Date(subscription.expires_at).toLocaleDateString()}
              </p>
            </div>
          )}

          {subscription.status === 'rejected' && (
            <div className={`p-4 rounded-lg border-2 ${
              theme.isDark ? 'border-red-500 bg-red-500/10' : 'border-red-400 bg-red-50'
            }`}>
              <p className={`text-sm font-semibold ${theme.isDark ? 'text-red-300' : 'text-red-700'}`}>
                {t('subscriptionRejected')}
              </p>
              <p className={`text-xs ${theme.isDark ? 'text-red-200' : 'text-red-600'} mt-2`}>
                {t('subscriptionRejectedMessage')}
              </p>
              <button
                onClick={() => {
                  setStep('payment');
                  setScreenshotFile(null);
                  setScreenshotPreview(null);
                }}
                className="mt-3 w-full px-4 py-2 bg-navy-800/70 text-gray-300 rounded-lg hover:bg-navy-700 font-semibold"
              >
                {t('tryAgain')}
              </button>
            </div>
          )}

          <button onClick={onClose} className="w-full px-4 py-2 bg-navy-800/70 text-gray-300 rounded-lg hover:bg-navy-700 font-semibold">
            {t('close')}
          </button>
        </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const generateReferenceCode = () => {
    // Generate 5-char unique code from userId
    const hash = user.id.split('-')[0].toUpperCase();
    return hash.substring(0, 5);
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError(t('invalidFileType'));
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError(t('fileTooLarge'));
      return;
    }

    setScreenshotFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setScreenshotPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!screenshotFile) {
      setError(t('screenshotRequired'));
      return;
    }

    setIsSubmitting(true);
    setStep('loading');

    try {
      // Upload screenshot to Supabase Storage
      const filename = `${user.id}/${Date.now()}-${screenshotFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('payment-screenshots')
        .upload(filename, screenshotFile);

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('payment-screenshots')
        .getPublicUrl(filename);

      // Create subscription request
      const response = await fetch('/api/project-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_screenshot: urlData.publicUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('submissionFailed'));
      }

      toast.success(t('subscriptionSubmitted'));
      onSuccess?.();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('unknownError');
      setError(message);
      setStep('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-navy-950/80 z-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-navy-900/95 border border-navy-800/60 rounded-2xl shadow-soft-xl p-6 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-200"
        >
          ✕
        </button>
        <h2 className="text-2xl font-bold text-white mb-6">{t('projectSubscription')}</h2>
      <div className="space-y-6">
        {/* Price Display */}
        <div className={`text-center p-4 rounded-lg ${theme.isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            {t('subscriptionPrice')}
          </p>
          <p className="text-3xl font-bold text-emerald-600">₾{SUBSCRIPTION_PRICE.toFixed(2)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">per month</p>
        </div>

        {/* Bank Account Section */}
        <div>
          <label className="block text-sm font-semibold mb-2">
            {t('bankAccount')}
          </label>
          <div className="flex items-center gap-2">
            <code className={`flex-1 p-3 rounded font-mono text-sm ${
              theme.isDark ? 'bg-gray-800 text-gray-100' : 'bg-gray-100 text-gray-900'
            }`}>
              {BANK_ACCOUNT}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(BANK_ACCOUNT);
                toast.success(t('copied'));
              }}
              className={`px-3 py-2 rounded font-semibold text-sm transition ${
                theme.isDark
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white'
              }`}
            >
              {t('copy')}
            </button>
          </div>
        </div>

        {/* Reference Code */}
        <div>
          <label className="block text-sm font-semibold mb-2">
            {t('referenceCode')}
          </label>
          <div className="flex items-center gap-2">
            <code className={`flex-1 p-3 rounded font-mono text-sm text-center tracking-widest font-bold ${
              theme.isDark ? 'bg-gray-800 text-emerald-400' : 'bg-gray-100 text-emerald-600'
            }`}>
              {generateReferenceCode()}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(generateReferenceCode());
                toast.success(t('copied'));
              }}
              className={`px-3 py-2 rounded font-semibold text-sm transition ${
                theme.isDark
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white'
              }`}
            >
              {t('copy')}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
            {t('referenceCodeDescription')}
          </p>
        </div>

        {/* Screenshot Upload */}
        <div>
          <label className="block text-sm font-semibold mb-2">
            {t('paymentScreenshot')}
          </label>

          {screenshotPreview ? (
            <div className="space-y-2">
              <img
                src={screenshotPreview}
                alt="Preview"
                className={`w-full rounded-lg border-2 max-h-64 object-contain ${
                  theme.isDark ? 'border-gray-700' : 'border-gray-300'
                }`}
              />
              <button
                onClick={() => {
                  setScreenshotFile(null);
                  setScreenshotPreview(null);
                }}
                className="text-sm text-red-500 hover:text-red-600 font-semibold"
              >
                {t('remove')}
              </button>
            </div>
          ) : (
            <label className={`block p-6 rounded-lg border-2 border-dashed cursor-pointer transition ${
              theme.isDark
                ? 'border-gray-700 hover:border-emerald-600 bg-gray-800/50 hover:bg-gray-800'
                : 'border-gray-300 hover:border-emerald-500 bg-gray-50 hover:bg-gray-100'
            }`}>
              <input
                type="file"
                accept="image/*"
                onChange={handleScreenshotChange}
                className="hidden"
              />
              <div className="text-center">
                <p className="text-sm font-semibold">{t('dragDropImage')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {t('imageSizeLimit')}
                </p>
              </div>
            </label>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className={`p-3 rounded-lg border ${
            theme.isDark
              ? 'border-red-500/50 bg-red-500/10 text-red-300'
              : 'border-red-400 bg-red-50 text-red-700'
          }`}>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-navy-800/70 text-gray-300 rounded-lg hover:bg-navy-700 font-semibold disabled:opacity-50"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!screenshotFile || isSubmitting}
            className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold disabled:opacity-50"
          >
            {isSubmitting ? t('submitting') : t('submit')}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
