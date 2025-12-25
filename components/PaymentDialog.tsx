'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import type { Course } from './CourseCard';
import { useI18n } from '@/contexts/I18nContext';
import { useUser } from '@/hooks/useUser';

interface PaymentDialogProps {
  course: Course;
  isOpen: boolean;
  onClose: () => void;
  onEnroll: (courseId: string, screenshotUrls: string[], referralCode?: string) => Promise<void> | void;
}

// Generate a unique 5-digit code from course ID (uppercase letters and numbers)
function generateCourseCode(courseId: string): string {
  // Use a simple hash function to generate consistent code from course ID
  let hash = 0;
  for (let i = 0; i < courseId.length; i++) {
    const char = courseId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use absolute value and convert to base 36, then take first 5 chars
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  let num = Math.abs(hash);
  
  for (let i = 0; i < 5; i++) {
    code += chars[num % chars.length];
    num = Math.floor(num / chars.length);
  }
  
  return code;
}

export default function PaymentDialog({ course, isOpen, onClose, onEnroll }: PaymentDialogProps) {
  const { t } = useI18n();
  const { profile } = useUser();
  const [uploadedImages, setUploadedImages] = useState<Array<{ file: File; preview: string; url?: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Auto-fill referral code if user was referred for this specific course
  useEffect(() => {
    if (isOpen && profile && course) {
      const referredCourseId = profile.referred_for_course_id;
      const signupReferralCode = profile.signup_referral_code;
      
      // Only auto-fill if:
      // 1. User has a referral code from signup
      // 2. User was referred for this specific course
      // 3. Current course ID matches the referred course ID
      if (signupReferralCode && referredCourseId && referredCourseId === course.id) {
        setReferralCode(signupReferralCode);
      } else {
        // Clear referral code if course doesn't match
        setReferralCode('');
      }
    } else if (!isOpen) {
      // Reset when dialog closes
      setReferralCode('');
    }
  }, [isOpen, profile, course]);

  const courseCode = useMemo(() => generateCourseCode(course.id), [course.id]);

  const formatPrice = useMemo(() => {
    return (price: number) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(price);
  }, []);

  const formattedPrice = useMemo(() => formatPrice(course.price), [formatPrice, course.price]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      setUploadError(t('payment.imageFilesOnly'));
      return;
    }

    // Validate file sizes (5MB limit per image)
    const maxSize = 5 * 1024 * 1024;
    const oversizedFiles = imageFiles.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      setUploadError(t('payment.fileSizeExceeded'));
      return;
    }

    setUploadError(null);

    // Create preview URLs for new images
    const newImages = imageFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setUploadedImages(prev => [...prev, ...newImages]);
    
    // Reset input
    e.target.value = '';
  }, []);

  const handleRemoveImage = useCallback((index: number) => {
    setUploadedImages(prev => {
      const newImages = [...prev];
      // Revoke object URL to prevent memory leak
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  }, []);

  const handleUpload = useCallback(async () => {
    if (uploadedImages.length === 0) {
      setUploadError(t('payment.pleaseUploadScreenshot'));
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Upload images to storage (we'll use a payment-screenshots bucket or chat-media)
      // For now, let's use a simple approach - store locally or use existing bucket
      const uploadedUrls: string[] = [];

      for (const imageData of uploadedImages) {
        if (imageData.url) {
          // Already uploaded
          uploadedUrls.push(imageData.url);
          continue;
        }

        const fileExt = imageData.file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `payment-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${course.id}/${user.id}/${fileName}`;

        const { data, error: uploadError } = await supabase.storage
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

      // Payment screenshots have been uploaded successfully
      // Proceed with enrollment request, passing screenshot URLs and referral code
      // Note: onEnroll will handle success/error and close dialog appropriately
      try {
        await onEnroll(course.id, uploadedUrls, referralCode.trim() || undefined);
        // If we get here, enrollment request was successful, dialog will be closed by onEnroll
      } catch (enrollError: any) {
        // If enrollment request fails, show error but keep dialog open so user can retry
        setUploadError(enrollError.message || t('payment.failedToSubmit'));
        throw enrollError; // Re-throw so calling code knows it failed
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(err.message || t('payment.failedToUpload'));
    } finally {
      setIsUploading(false);
    }
  }, [uploadedImages, course.id, onClose, onEnroll]);

  const handleClose = useCallback(() => {
    // Clean up object URLs
    uploadedImages.forEach(img => URL.revokeObjectURL(img.preview));
    setUploadedImages([]);
    setUploadError(null);
    setReferralCode('');
    onClose();
  }, [uploadedImages, onClose]);

  // Close modal on ESC key press and handle body scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const dialogContent = (
    <div 
      className="fixed inset-0 bg-black/80 dark:bg-black/90 z-[9999] overflow-y-auto"
      onClick={handleClose}
    >
      <div 
        ref={dialogRef}
        className="relative w-full min-h-full bg-white dark:bg-navy-800 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="fixed top-4 right-4 z-50 w-10 h-10 bg-gray-100 dark:bg-navy-700 hover:bg-gray-200 dark:hover:bg-navy-600 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 transition-colors shadow-lg"
          aria-label={t('common.close')}
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

        <div className="w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 py-20">
          {/* Header */}
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white mb-3 tracking-tight">{t('payment.paymentInstructions')}</h2>
            <p className="text-base md:text-lg text-charcoal-600 dark:text-gray-400">{t('payment.followInstructions')}</p>
          </div>

          {/* Course Information */}
          <div className="bg-charcoal-50/50 dark:bg-navy-700/50 rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="text-xl md:text-2xl font-semibold text-charcoal-950 dark:text-white">{course.title}</h3>
              {course.description && (
                <p className="text-base text-charcoal-600 dark:text-gray-400 mt-2">{course.description}</p>
              )}
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-charcoal-200/50 dark:border-navy-600/50">
              <div>
                <p className="text-sm md:text-base text-charcoal-500 dark:text-gray-400 mb-1">{t('payment.creator')}</p>
                <p className="text-lg font-medium text-charcoal-950 dark:text-white">{course.creator}</p>
              </div>
              <div className="text-right">
                <p className="text-sm md:text-base text-charcoal-500 dark:text-gray-400 mb-1">{t('payment.price')}</p>
                <p className="text-2xl md:text-3xl font-semibold text-charcoal-950 dark:text-white">{formattedPrice}</p>
              </div>
            </div>
          </div>

          {/* Account Number */}
          <div className="bg-gray-50 dark:bg-navy-700/50 rounded-lg p-5 md:p-6">
            <p className="text-base md:text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">{t('payment.accountNumber')}</p>
            <p className="text-xl md:text-2xl font-mono font-semibold text-gray-900 dark:text-white break-all">GE00BG0000000013231</p>
          </div>

          {/* Unique Course Code */}
          <div className="bg-charcoal-50/50 dark:bg-navy-700/50 rounded-2xl p-6 md:p-7">
            <p className="text-base md:text-lg font-medium text-charcoal-600 dark:text-gray-400 mb-3">{t('payment.uniqueCourseCode')}</p>
            <p className="text-3xl md:text-4xl font-mono font-semibold text-charcoal-950 dark:text-white tracking-wider">{courseCode}</p>
            <p className="text-sm text-charcoal-500 dark:text-gray-500 mt-3">{t('payment.includeCodeInReference')}</p>
          </div>

          {/* Referral Code (Optional) */}
          <div className="bg-gray-50 dark:bg-navy-700/50 rounded-lg p-5 md:p-6">
            <label className="block text-base md:text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t('payment.referralCode')} <span className="text-gray-500 dark:text-gray-400 font-normal">({t('common.optional')})</span>
            </label>
            <input
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase().trim())}
              placeholder={t('payment.referralCodePlaceholder') || 'Enter referral code (optional)'}
              className="w-full px-5 py-3 text-base bg-white dark:bg-navy-800 border border-charcoal-200 dark:border-navy-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent text-charcoal-950 dark:text-white placeholder-charcoal-400 dark:placeholder-gray-500"
              maxLength={20}
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{t('payment.referralCodeDescription')}</p>
          </div>

          {/* Payment Instructions Images */}
          <div className="space-y-4 md:space-y-6">
            <div>
              <p className="text-xl md:text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4 md:mb-6">{t('payment.paymentInstructionsTitle')}</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                {/* First Instruction Image - Account Number Entry */}
                <div className="bg-white dark:bg-navy-700/50 border border-gray-200 dark:border-navy-600 rounded-lg p-4 md:p-5 shadow-sm">
                  <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">{t('payment.step1')}</p>
                  <div className="relative w-full bg-gray-50 dark:bg-navy-800 rounded-lg overflow-hidden border border-gray-200 dark:border-navy-600">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/payment-instructions/payment-step-1.png"
                      alt="Payment instruction step 1 - Enter account number GE00BG0000000013231"
                      className="w-full h-auto object-contain block"
                      style={{ maxHeight: '600px' }}
                      loading="lazy"
                    />
                  </div>
                </div>

                {/* Second Instruction Image - Payment Details */}
                <div className="bg-white dark:bg-navy-700/50 border border-gray-200 dark:border-navy-600 rounded-lg p-4 md:p-5 shadow-sm">
                  <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">{t('payment.step2')}</p>
                  <div className="relative w-full bg-gray-50 dark:bg-navy-800 rounded-lg overflow-hidden border border-gray-200 dark:border-navy-600">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/payment-instructions/payment-step-2.png"
                      alt="Payment instruction step 2 - Complete payment with unique code in description field"
                      className="w-full h-auto object-contain block"
                      style={{ maxHeight: '600px' }}
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            </div>
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
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{t('payment.uploadMultipleImages')}</p>
            </div>

            {/* Uploaded Images Preview */}
            {uploadedImages.length > 0 && (
              <div className="space-y-4">
                <p className="text-lg md:text-xl font-semibold text-gray-700 dark:text-gray-300">{t('payment.uploadedImages', { count: uploadedImages.length })}</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {uploadedImages.map((imageData, index) => (
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
            {uploadError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-5 py-4 rounded-lg text-base">
                {uploadError}
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
                <p className="text-base font-semibold text-yellow-800 dark:text-yellow-300">{t('payment.processingTime')}</p>
                <p className="text-sm md:text-base text-yellow-700 dark:text-yellow-400 mt-2">{t('payment.processingTimeDescription')}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-navy-700">
            <button
              onClick={handleClose}
              className="px-8 py-3 text-base font-semibold text-charcoal-600 dark:text-gray-300 bg-charcoal-100 dark:bg-navy-700 rounded-full hover:bg-charcoal-200 dark:hover:bg-navy-600 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleUpload}
              disabled={isUploading || uploadedImages.length === 0}
              className="px-8 py-3 text-base font-semibold text-white bg-charcoal-950 dark:bg-emerald-500 rounded-full hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-all duration-200 hover:shadow-soft disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isUploading ? (
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
      </div>
    </div>
  );

  // Only use portal on client side
  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(dialogContent, document.body);
}

