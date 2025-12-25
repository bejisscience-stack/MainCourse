'use client';

import { useCallback } from 'react';
import type { EnrollmentWizardData } from '../EnrollmentWizard';
import { useI18n } from '@/contexts/I18nContext';

interface EnrollmentStepUploadProps {
  course: EnrollmentWizardData['course'];
  data: EnrollmentWizardData;
  updateData: (updates: Partial<EnrollmentWizardData>) => void;
  error: string | null;
}

export default function EnrollmentStepUpload({
  data,
  updateData,
  error,
}: EnrollmentStepUploadProps) {
  const { t } = useI18n();

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      // Error will be shown via error prop from parent
      return;
    }

    // Validate file sizes (5MB limit per image)
    const maxSize = 5 * 1024 * 1024;
    const oversizedFiles = imageFiles.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      // Error will be shown via error prop from parent
      return;
    }

    // Create preview URLs for new images
    const newImages = imageFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    updateData({ uploadedImages: [...data.uploadedImages, ...newImages] });
    
    // Reset input
    e.target.value = '';
  }, [data.uploadedImages, updateData]);

  const handleRemoveImage = useCallback((index: number) => {
    const newImages = [...data.uploadedImages];
    // Revoke object URL to prevent memory leak
    URL.revokeObjectURL(newImages[index].preview);
    newImages.splice(index, 1);
    updateData({ uploadedImages: newImages });
  }, [data.uploadedImages, updateData]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <h3 className="text-2xl font-bold text-charcoal-950 dark:text-white mb-2">
          {t('enrollment.stepUploadTitle')}
        </h3>
        <p className="text-charcoal-600 dark:text-gray-400">
          {t('enrollment.stepUploadDescription')}
        </p>
      </div>

      {/* File Upload Section */}
      <div className="space-y-4">
        <div>
          <label className="block text-base md:text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {t('payment.uploadScreenshots')}
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="block w-full text-base text-charcoal-500 dark:text-gray-400 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-base file:font-semibold file:bg-charcoal-950 dark:file:bg-emerald-500 file:text-white hover:file:bg-charcoal-800 dark:hover:file:bg-emerald-600 cursor-pointer"
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {t('payment.uploadMultipleImages')}
          </p>
        </div>

        {/* Uploaded Images Preview */}
        {data.uploadedImages.length > 0 && (
          <div className="space-y-4">
            <p className="text-lg md:text-xl font-semibold text-gray-700 dark:text-gray-300">
              {t('payment.uploadedImages', { count: data.uploadedImages.length })}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {data.uploadedImages.map((imageData, index) => (
                <div key={index} className="relative group">
                  <img
                    src={imageData.preview}
                    alt={`Transaction screenshot ${index + 1}`}
                    className="w-full h-48 md:h-56 lg:h-64 object-cover rounded-lg border-2 border-gray-200 dark:border-navy-600"
                  />
                  <button
                    onClick={() => handleRemoveImage(index)}
                    className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    aria-label={t('payment.removeImage')}
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
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white text-sm font-semibold px-3 py-1 rounded">
                    {index + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-5 py-4 rounded-lg text-base">
            {error}
          </div>
        )}

        {/* Empty State */}
        {data.uploadedImages.length === 0 && !error && (
          <div className="bg-gray-50 dark:bg-navy-700/30 rounded-lg p-8 text-center border-2 border-dashed border-gray-300 dark:border-navy-600">
            <svg
              className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-gray-600 dark:text-gray-400 font-medium">
              {t('enrollment.uploadEmptyState')}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              {t('enrollment.uploadEmptyStateDescription')}
            </p>
          </div>
        )}
      </div>

      {/* Processing Time Notice */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-5 md:p-6">
        <div className="flex items-start space-x-4">
          <svg
            className="w-6 h-6 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="text-base font-semibold text-yellow-800 dark:text-yellow-300">
              {t('payment.processingTime')}
            </p>
            <p className="text-sm md:text-base text-yellow-700 dark:text-yellow-400 mt-2">
              {t('payment.processingTimeDescription')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

