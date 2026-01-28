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
      <div className="space-y-6">
        <div className="bg-white/50 dark:bg-navy-800/50 rounded-2xl p-6 md:p-8 border border-charcoal-100/50 dark:border-navy-700/50 shadow-soft">
          <label className="block text-lg font-bold text-charcoal-950 dark:text-white mb-4">
            {t('payment.uploadScreenshots')}
          </label>
          
          <div className="relative group">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 file:hidden"
              title=""
            />
            <div className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-charcoal-200 dark:border-navy-600 rounded-xl bg-charcoal-50/50 dark:bg-navy-900/50 group-hover:bg-charcoal-100/50 dark:group-hover:bg-navy-800/50 group-hover:border-emerald-500/50 dark:group-hover:border-emerald-500/50 transition-all duration-200">
              <div className="w-12 h-12 bg-white dark:bg-navy-800 rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform duration-200">
                <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <p className="text-base font-semibold text-charcoal-950 dark:text-white">
                {t('payment.chooseFiles') || 'Choose files'}
              </p>
              <p className="text-sm text-charcoal-500 dark:text-gray-400 mt-1">
                {t('payment.uploadMultipleImages')}
              </p>
            </div>
          </div>
        </div>

        {/* Uploaded Images Preview */}
        {data.uploadedImages.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold text-charcoal-950 dark:text-white">
                {t('payment.uploadedImages', { count: data.uploadedImages.length })}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {data.uploadedImages.map((imageData, index) => (
                <div key={index} className="relative group aspect-[4/3]">
                  <img
                    src={imageData.preview}
                    alt={`Transaction screenshot ${index + 1}`}
                    className="w-full h-full object-cover rounded-xl border border-charcoal-100 dark:border-navy-600 shadow-sm"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                    <button
                      onClick={() => handleRemoveImage(index)}
                      className="w-10 h-10 bg-white/10 hover:bg-red-500/80 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all duration-200 transform hover:scale-110"
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-md">
                    #{index + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/50 text-red-600 dark:text-red-300 px-5 py-4 rounded-xl text-base flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}
      </div>

      {/* Processing Time Notice */}
      <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/50 rounded-2xl p-5">
        <div className="flex items-start space-x-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg shrink-0">
            <svg
              className="w-5 h-5 text-amber-600 dark:text-amber-400"
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
          </div>
          <div>
            <p className="text-base font-bold text-charcoal-950 dark:text-white">
              {t('payment.processingTime')}
            </p>
            <p className="text-sm text-charcoal-600 dark:text-gray-400 mt-1 leading-relaxed">
              {t('payment.processingTimeDescription')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

