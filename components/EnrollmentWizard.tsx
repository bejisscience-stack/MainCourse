'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Course } from './CourseCard';
import { useI18n } from '@/contexts/I18nContext';
import { useUser } from '@/hooks/useUser';
import EnrollmentStepOverview from './enrollment/EnrollmentStepOverview';
import EnrollmentStepPayment from './enrollment/EnrollmentStepPayment';
import EnrollmentStepReferral from './enrollment/EnrollmentStepReferral';
import EnrollmentStepUpload from './enrollment/EnrollmentStepUpload';
import EnrollmentStepReview from './enrollment/EnrollmentStepReview';

export interface EnrollmentWizardData {
  course: Course;
  referralCode: string;
  uploadedImages: Array<{ file: File; preview: string; url?: string }>;
  uploadedUrls: string[];
}

interface EnrollmentWizardProps {
  course: Course;
  isOpen: boolean;
  onClose: () => void;
  onEnroll: (courseId: string, screenshotUrls: string[], referralCode?: string) => Promise<void> | void;
  initialReferralCode?: string;
}

const TOTAL_STEPS = 5;

export default function EnrollmentWizard({ course, isOpen, onClose, onEnroll, initialReferralCode }: EnrollmentWizardProps) {
  const { t } = useI18n();
  const { profile } = useUser();
  const [currentStep, setCurrentStep] = useState(1);
  const [mounted, setMounted] = useState(false);
  const [wizardData, setWizardData] = useState<EnrollmentWizardData>({
    course,
    referralCode: '',
    uploadedImages: [],
    uploadedUrls: [],
  });
  const [stepErrors, setStepErrors] = useState<Record<number, string | null>>({});
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Reset wizard when opened/closed and auto-fill referral code
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      
      // Auto-fill referral code from props first, then from profile if available
      let referralCodeToUse = initialReferralCode || '';
      
      // If no referral code from props, check profile
      if (!referralCodeToUse && profile && course) {
        const referredCourseId = profile.referred_for_course_id;
        const signupReferralCode = profile.signup_referral_code;
        
        // Only auto-fill if:
        // 1. User has a referral code from signup
        // 2. User was referred for this specific course
        // 3. Current course ID matches the referred course ID
        if (signupReferralCode && referredCourseId && referredCourseId === course.id) {
          referralCodeToUse = signupReferralCode;
        }
      }
      
      setWizardData({
        course,
        referralCode: referralCodeToUse,
        uploadedImages: [],
        uploadedUrls: [],
      });
      setStepErrors({});
    }
  }, [isOpen, course, profile, initialReferralCode]);

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
  }, [isOpen]);

  const handleClose = useCallback(() => {
    // Clean up object URLs
    wizardData.uploadedImages.forEach(img => URL.revokeObjectURL(img.preview));
    setWizardData({
      course,
      referralCode: '',
      uploadedImages: [],
      uploadedUrls: [],
    });
    setStepErrors({});
    setCurrentStep(1);
    onClose();
  }, [wizardData.uploadedImages, course, onClose]);

  const updateWizardData = useCallback((updates: Partial<EnrollmentWizardData>) => {
    setWizardData(prev => ({ ...prev, ...updates }));
  }, []);

  const validateStep = useCallback((step: number): boolean => {
    let isValid = true;
    let error: string | null = null;

    switch (step) {
      case 1: // Overview - always valid
        isValid = true;
        break;
      case 2: // Payment Instructions - always valid (just viewing)
        isValid = true;
        break;
      case 3: // Referral - always valid (optional)
        isValid = true;
        break;
      case 4: // Upload - must have at least one image
        if (wizardData.uploadedImages.length === 0) {
          isValid = false;
          error = t('payment.pleaseUploadScreenshot');
        }
        break;
      case 5: // Review - must have at least one image
        if (wizardData.uploadedImages.length === 0) {
          isValid = false;
          error = t('payment.pleaseUploadScreenshot');
        }
        break;
    }

    setStepErrors(prev => ({ ...prev, [step]: error }));
    return isValid;
  }, [wizardData.uploadedImages.length, t]);

  const handleNext = useCallback(() => {
    if (validateStep(currentStep)) {
      if (currentStep < TOTAL_STEPS) {
        setCurrentStep(prev => prev + 1);
        // Scroll to top of dialog on step change
        if (dialogRef.current) {
          dialogRef.current.scrollTop = 0;
        }
      }
    }
  }, [currentStep, validateStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      // Scroll to top of dialog on step change
      if (dialogRef.current) {
        dialogRef.current.scrollTop = 0;
      }
    }
  }, [currentStep]);

  const handleSubmit = useCallback(async (uploadedUrls?: string[]) => {
    // Final validation
    if (!validateStep(4)) {
      setCurrentStep(4); // Go back to upload step if invalid
      return;
    }

    // Use provided URLs or fall back to wizardData.uploadedUrls
    const urlsToUse = uploadedUrls || wizardData.uploadedUrls;
    
    if (urlsToUse.length === 0) {
      setCurrentStep(4); // Go back to upload step if no URLs
      return;
    }

    try {
      await onEnroll(
        course.id,
        urlsToUse,
        wizardData.referralCode.trim() || undefined
      );
      // Success - dialog will be closed by parent component
    } catch (error: any) {
      // Error handling is done in parent component
      console.error('Enrollment error:', error);
      throw error; // Re-throw so review step can handle it
    }
  }, [course.id, wizardData.uploadedUrls, wizardData.referralCode, onEnroll, validateStep]);

  if (!isOpen) return null;

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <EnrollmentStepOverview
            course={wizardData.course}
            data={wizardData}
            updateData={updateWizardData}
          />
        );
      case 2:
        return (
          <EnrollmentStepPayment
            course={wizardData.course}
            data={wizardData}
            updateData={updateWizardData}
          />
        );
      case 3:
        return (
          <EnrollmentStepReferral
            course={wizardData.course}
            data={wizardData}
            updateData={updateWizardData}
          />
        );
      case 4:
        return (
          <EnrollmentStepUpload
            course={wizardData.course}
            data={wizardData}
            updateData={updateWizardData}
            error={stepErrors[4]}
          />
        );
      case 5:
        return (
          <EnrollmentStepReview
            course={wizardData.course}
            data={wizardData}
            updateData={updateWizardData}
            onSubmit={handleSubmit}
          />
        );
      default:
        return null;
    }
  };

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

        <div className="w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6 py-20">
          {/* Header */}
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white mb-3 tracking-tight">
              {t('payment.paymentInstructions')}
            </h2>
            <p className="text-base md:text-lg text-charcoal-600 dark:text-gray-400">
              {t('payment.followInstructions')}
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-4">
              {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((step) => (
                <div key={step} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 ${
                        step < currentStep
                          ? 'bg-emerald-500 text-white'
                          : step === currentStep
                          ? 'bg-charcoal-950 dark:bg-emerald-500 text-white ring-4 ring-emerald-500/20'
                          : 'bg-gray-200 dark:bg-navy-700 text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {step < currentStep ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        step
                      )}
                    </div>
                    <span className={`text-xs mt-2 text-center transition-colors ${
                      step <= currentStep
                        ? 'text-charcoal-950 dark:text-white font-medium'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {step === 1 && t('enrollment.stepOverview')}
                      {step === 2 && t('enrollment.stepPayment')}
                      {step === 3 && t('enrollment.stepReferral')}
                      {step === 4 && t('enrollment.stepUpload')}
                      {step === 5 && t('enrollment.stepReview')}
                    </span>
                  </div>
                  {step < TOTAL_STEPS && (
                    <div className={`flex-1 h-0.5 mx-2 transition-all duration-300 ${
                      step < currentStep ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-navy-700'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="text-center text-sm text-charcoal-600 dark:text-gray-400">
              {t('enrollment.stepProgress', { current: currentStep, total: TOTAL_STEPS })}
            </div>
          </div>

          {/* Step Content */}
          <div className="min-h-[400px]">
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              {renderStep()}
            </div>
          </div>

          {/* Navigation Buttons - Hidden on review step (step 5) */}
          {currentStep < TOTAL_STEPS && (
            <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-navy-700">
              <div>
                {currentStep > 1 && (
                  <button
                    onClick={handleBack}
                    className="px-8 py-3 text-base font-semibold text-charcoal-600 dark:text-gray-300 bg-charcoal-100 dark:bg-navy-700 rounded-full hover:bg-charcoal-200 dark:hover:bg-navy-600 transition-colors flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>{t('common.back')}</span>
                  </button>
                )}
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleClose}
                  className="px-8 py-3 text-base font-semibold text-charcoal-600 dark:text-gray-300 bg-charcoal-100 dark:bg-navy-700 rounded-full hover:bg-charcoal-200 dark:hover:bg-navy-600 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleNext}
                  disabled={!!stepErrors[currentStep]}
                  className="px-8 py-3 text-base font-semibold text-white bg-charcoal-950 dark:bg-emerald-500 rounded-full hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-all duration-200 hover:shadow-soft disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <span>{t('common.next')}</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          
          {/* Cancel button on review step */}
          {currentStep === TOTAL_STEPS && (
            <div className="flex items-center justify-end pt-6 border-t border-gray-200 dark:border-navy-700">
              <button
                onClick={handleClose}
                className="px-8 py-3 text-base font-semibold text-charcoal-600 dark:text-gray-300 bg-charcoal-100 dark:bg-navy-700 rounded-full hover:bg-charcoal-200 dark:hover:bg-navy-600 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          )}
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

