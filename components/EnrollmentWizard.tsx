'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Course } from './CourseCard';
import { useI18n } from '@/contexts/I18nContext';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { ErrorBoundary } from './ErrorBoundary';
import { getReferral } from '@/lib/referral-storage';
import EnrollmentStepOverview from './enrollment/EnrollmentStepOverview';
import EnrollmentStepPayment from './enrollment/EnrollmentStepPayment';
import EnrollmentStepReferral from './enrollment/EnrollmentStepReferral';
import EnrollmentStepUpload from './enrollment/EnrollmentStepUpload';
import EnrollmentStepReview from './enrollment/EnrollmentStepReview';

// localStorage key for backup
const ENROLLMENT_BACKUP_KEY = 'enrollment_form_backup';

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

// Helper functions for localStorage backup
function saveFormBackup(courseId: string, data: { referralCode: string; step: number }) {
  try {
    if (typeof window !== 'undefined') {
      const backup = {
        courseId,
        referralCode: data.referralCode,
        step: data.step,
        timestamp: Date.now(),
      };
      localStorage.setItem(ENROLLMENT_BACKUP_KEY, JSON.stringify(backup));
    }
  } catch (e) {
    console.warn('Failed to save form backup:', e);
  }
}

function loadFormBackup(courseId: string): { referralCode: string; step: number } | null {
  try {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(ENROLLMENT_BACKUP_KEY);
      if (saved) {
        const backup = JSON.parse(saved);
        // Only restore if it's for the same course and not too old (1 hour)
        if (backup.courseId === courseId && Date.now() - backup.timestamp < 3600000) {
          return { referralCode: backup.referralCode || '', step: backup.step || 1 };
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load form backup:', e);
  }
  return null;
}

function clearFormBackup() {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ENROLLMENT_BACKUP_KEY);
    }
  } catch (e) {
    console.warn('Failed to clear form backup:', e);
  }
}

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
  const [isValidating, setIsValidating] = useState(false);
  const [wasAutoFilled, setWasAutoFilled] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Reset wizard when opened/closed and auto-fill referral code
  useEffect(() => {
    if (isOpen) {
      // Try to restore from backup first
      const backup = loadFormBackup(course.id);

      // Auto-fill referral code: props > persistent storage > backup > profile
      let referralCodeToUse = initialReferralCode || '';

      // If no referral code from props, try persistent referral storage (30-day TTL)
      if (!referralCodeToUse) {
        const persistentReferral = getReferral(course.id);
        if (persistentReferral) {
          referralCodeToUse = persistentReferral;
        }
      }

      // If no referral code from persistent storage, try backup (1-hour TTL)
      if (!referralCodeToUse && backup?.referralCode) {
        referralCodeToUse = backup.referralCode;
      }

      // Track if we auto-filled from profile
      let autoFilledFromProfile = false;

      // If still no referral code, check profile
      if (!referralCodeToUse && profile && course) {
        const referredCourseId = profile.referred_for_course_id;
        const signupReferralCode = profile.signup_referral_code;

        // Auto-fill referral code based on referral type:
        if (signupReferralCode) {
          // General referral (no specific course) - auto-fill for ALL courses
          if (!referredCourseId) {
            referralCodeToUse = signupReferralCode;
            autoFilledFromProfile = true;
          }
          // Course-specific referral - only auto-fill for that specific course
          else if (referredCourseId === course.id) {
            referralCodeToUse = signupReferralCode;
            autoFilledFromProfile = true;
          }
        }
      }

      setWasAutoFilled(autoFilledFromProfile);
      setCurrentStep(1);
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

  const validateStep = useCallback(async (step: number): Promise<boolean> => {
    let isValid = true;
    let error: string | null = null;

    switch (step) {
      case 1: // Overview - always valid
        isValid = true;
        break;
      case 2: // Payment Instructions - always valid (just viewing)
        isValid = true;
        break;
      case 3: // Referral - validate if code is provided
        if (wizardData.referralCode && wizardData.referralCode.trim()) {
          setIsValidating(true);
          try {
            // Get the current session token
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
              error = 'Please log in to validate referral code';
              isValid = false;
              break;
            }

            // Call API to validate referral code
            const response = await fetch('/api/validate-referral-code', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                referralCode: wizardData.referralCode.trim(),
              }),
            });

            const data = await response.json();

            if (!response.ok) {
              error = data.error || 'Failed to validate referral code';
              isValid = false;
            } else if (!data.valid) {
              error = 'Invalid referral code. Please check and try again.';
              isValid = false;
            }
          } catch (err) {
            console.error('Error validating referral code:', err);
            error = 'Failed to validate referral code. Please try again.';
            isValid = false;
          } finally {
            setIsValidating(false);
          }
        }
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
  }, [wizardData.uploadedImages.length, wizardData.referralCode, t]);

  const handleNext = useCallback(async () => {
    const isValid = await validateStep(currentStep);
    if (isValid) {
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

    // Save form backup before submission in case of errors
    saveFormBackup(course.id, {
      referralCode: wizardData.referralCode,
      step: currentStep,
    });

    try {
      await onEnroll(
        course.id,
        urlsToUse,
        wizardData.referralCode.trim() || undefined
      );
      // Success - clear the backup
      clearFormBackup();
      // Dialog will be closed by parent component
    } catch (error: any) {
      // Error handling is done in parent component
      console.error('Enrollment error:', error);
      throw error; // Re-throw so review step can handle it
    }
  }, [course.id, wizardData.uploadedUrls, wizardData.referralCode, currentStep, onEnroll, validateStep]);

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
            error={stepErrors[3]}
            isAutoFilled={wasAutoFilled}
            onAutoFilledCleared={() => setWasAutoFilled(false)}
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
            <ErrorBoundary
              onError={(error) => {
                console.error('Enrollment wizard error:', error);
                // Save backup on error
                saveFormBackup(course.id, {
                  referralCode: wizardData.referralCode,
                  step: currentStep,
                });
              }}
            >
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                {renderStep()}
              </div>
            </ErrorBoundary>
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
                  disabled={!!stepErrors[currentStep] || isValidating}
                  className="px-8 py-3 text-base font-semibold text-white bg-charcoal-950 dark:bg-emerald-500 rounded-full hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-all duration-200 hover:shadow-soft disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isValidating ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>{t('common.validating') || 'Validating...'}</span>
                    </>
                  ) : (
                    <>
                      <span>{t('common.next')}</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
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

