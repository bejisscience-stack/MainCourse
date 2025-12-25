'use client';

import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { EnrollmentWizardData } from '../EnrollmentWizard';
import { useI18n } from '@/contexts/I18nContext';

interface EnrollmentStepReviewProps {
  course: EnrollmentWizardData['course'];
  data: EnrollmentWizardData;
  updateData: (updates: Partial<EnrollmentWizardData>) => void;
  onSubmit: (uploadedUrls: string[]) => Promise<void>;
}

export default function EnrollmentStepReview({
  course,
  data,
  updateData,
  onSubmit,
}: EnrollmentStepReviewProps) {

// Generate a unique 5-digit code from course ID
function generateCourseCode(courseId: string): string {
  let hash = 0;
  for (let i = 0; i < courseId.length; i++) {
    const char = courseId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  let num = Math.abs(hash);
  
  for (let i = 0; i < 5; i++) {
    code += chars[num % chars.length];
    num = Math.floor(num / chars.length);
  }
  
  return code;
}

  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const courseCode = useMemo(() => generateCourseCode(course.id), [course.id]);

  const formatPrice = useMemo(() => {
    return (price: number) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(price);
  }, []);

  const formattedPrice = useMemo(() => formatPrice(course.price), [formatPrice, course.price]);

  const handleSubmit = useCallback(async () => {
    if (data.uploadedImages.length === 0) {
      setUploadError(t('payment.pleaseUploadScreenshot'));
      return;
    }

    setIsSubmitting(true);
    setUploadError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Upload images to storage
      const uploadedUrls: string[] = [];

      for (const imageData of data.uploadedImages) {
        if (imageData.url) {
          // Already uploaded
          uploadedUrls.push(imageData.url);
          continue;
        }

        const fileExt = imageData.file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `payment-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${course.id}/${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('payment-screenshots')
          .upload(filePath, imageData.file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('Upload error details:', uploadError);
          throw new Error(`Failed to upload ${imageData.file.name}: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from('payment-screenshots')
          .getPublicUrl(filePath);

        if (urlData?.publicUrl) {
          uploadedUrls.push(urlData.publicUrl);
        }
      }

      // Call onSubmit with the uploaded URLs directly
      await onSubmit(uploadedUrls);
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(err.message || t('payment.failedToUpload'));
      setIsSubmitting(false);
    }
  }, [data.uploadedImages, course.id, onSubmit, updateData, t]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <h3 className="text-2xl font-bold text-charcoal-950 dark:text-white mb-2">
          {t('enrollment.stepReviewTitle')}
        </h3>
        <p className="text-charcoal-600 dark:text-gray-400">
          {t('enrollment.stepReviewDescription')}
        </p>
      </div>

      {/* Review Summary */}
      <div className="space-y-4">
        {/* Course Information */}
        <div className="bg-charcoal-50/50 dark:bg-navy-700/50 rounded-lg p-5 border border-charcoal-200 dark:border-navy-600">
          <h4 className="text-lg font-semibold text-charcoal-950 dark:text-white mb-3">
            {t('enrollment.reviewCourseInfo')}
          </h4>
          <div className="space-y-2">
            <p className="text-charcoal-950 dark:text-white font-medium">{course.title}</p>
            <p className="text-sm text-charcoal-600 dark:text-gray-400">
              {t('payment.creator')}: {course.creator}
            </p>
            <p className="text-sm text-charcoal-600 dark:text-gray-400">
              {t('payment.price')}: {formattedPrice}
            </p>
          </div>
        </div>

        {/* Payment Details */}
        <div className="bg-gray-50 dark:bg-navy-700/50 rounded-lg p-5 border border-gray-200 dark:border-navy-600">
          <h4 className="text-lg font-semibold text-charcoal-950 dark:text-white mb-3">
            {t('enrollment.reviewPaymentDetails')}
          </h4>
          <div className="space-y-2">
            <div>
              <p className="text-sm text-charcoal-500 dark:text-gray-400 mb-1">
                {t('payment.accountNumber')}
              </p>
              <p className="text-base font-mono text-charcoal-950 dark:text-white">
                GE00BG0000000013231
              </p>
            </div>
            <div>
              <p className="text-sm text-charcoal-500 dark:text-gray-400 mb-1">
                {t('payment.uniqueCourseCode')}
              </p>
              <p className="text-lg font-mono font-semibold text-charcoal-950 dark:text-white">
                {courseCode}
              </p>
            </div>
          </div>
        </div>

        {/* Referral Code */}
        {data.referralCode && (
          <div className="bg-emerald-50 dark:bg-emerald-500/20 rounded-lg p-5 border border-emerald-200 dark:border-emerald-800">
            <h4 className="text-lg font-semibold text-emerald-900 dark:text-emerald-300 mb-2">
              {t('payment.referralCode')}
            </h4>
            <p className="text-base font-mono text-emerald-800 dark:text-emerald-200">
              {data.referralCode}
            </p>
          </div>
        )}

        {/* Uploaded Screenshots */}
        <div className="bg-gray-50 dark:bg-navy-700/50 rounded-lg p-5 border border-gray-200 dark:border-navy-600">
          <h4 className="text-lg font-semibold text-charcoal-950 dark:text-white mb-3">
            {t('enrollment.reviewScreenshots')} ({data.uploadedImages.length})
          </h4>
          {data.uploadedImages.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {data.uploadedImages.map((imageData, index) => (
                <div key={index} className="relative">
                  <img
                    src={imageData.preview}
                    alt={`Screenshot ${index + 1}`}
                    className="w-full h-32 object-cover rounded border border-gray-200 dark:border-navy-600"
                  />
                  <div className="absolute top-1 left-1 bg-black/70 text-white text-xs font-semibold px-2 py-1 rounded">
                    {index + 1}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-red-600 dark:text-red-400">
              {t('payment.pleaseUploadScreenshot')}
            </p>
          )}
        </div>
      </div>

      {/* Error Message */}
      {uploadError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-5 py-4 rounded-lg text-base">
          {uploadError}
        </div>
      )}

      {/* Final Notice */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-5">
        <div className="flex items-start space-x-3">
          <svg
            className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0"
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
          <div>
            <p className="text-base font-semibold text-blue-800 dark:text-blue-300">
              {t('enrollment.reviewFinalNotice')}
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
              {t('enrollment.reviewFinalDescription')}
            </p>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || data.uploadedImages.length === 0}
          className="px-8 py-3 text-base font-semibold text-white bg-charcoal-950 dark:bg-emerald-500 rounded-full hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-all duration-200 hover:shadow-soft disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
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
              <span>{t('payment.uploading')}</span>
            </>
          ) : (
            <span>{t('payment.submitPayment')}</span>
          )}
        </button>
      </div>
    </div>
  );
}

