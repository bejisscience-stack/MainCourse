'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Course } from './CourseCard';
import { useI18n } from '@/contexts/I18nContext';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { getReferral } from '@/lib/referral-storage';

type KeepzMethod = 'card' | 'online_banking' | 'crypto' | 'all';

interface EnrollmentModalProps {
  course: Course;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialReferralCode?: string;
  enrollmentMode?: 'course' | 'bundle';
  isReEnrollment?: boolean;
}

export default function EnrollmentModal({
  course,
  isOpen,
  onClose,
  onSuccess,
  initialReferralCode,
  enrollmentMode = 'course',
  isReEnrollment = false,
}: EnrollmentModalProps) {
  const { t } = useI18n();
  const { profile } = useUser();
  const [mounted, setMounted] = useState(false);

  const [referralCode, setReferralCode] = useState('');
  const [referralValidation, setReferralValidation] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [referralMessage, setReferralMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<KeepzMethod | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Reset state and auto-fill referral when opened
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsSubmitting(false);
      setReferralValidation('idle');
      setReferralMessage('');
      setSelectedMethod(null);

      // Auto-fill referral code: props > persistent storage > profile
      let code = initialReferralCode || '';
      if (!code) {
        const persistent = getReferral();
        if (persistent) code = persistent;
      }
      if (!code && profile?.signup_referral_code) {
        code = profile.signup_referral_code;
      }
      setReferralCode(code);
    }
  }, [isOpen, course, profile, initialReferralCode]);

  // ESC key and body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isSubmitting, onClose]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const validateReferralCode = useCallback(async (code: string) => {
    if (!code.trim()) {
      setReferralValidation('idle');
      setReferralMessage('');
      return;
    }
    setReferralValidation('validating');
    setReferralMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setReferralValidation('invalid');
        setReferralMessage('Please log in to validate referral code');
        return;
      }
      const response = await fetch('/api/validate-referral-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ referralCode: code.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setReferralValidation('invalid');
        setReferralMessage(data.error || 'Failed to validate referral code');
      } else if (data.valid) {
        setReferralValidation('valid');
        setReferralMessage('Valid referral code');
      } else {
        setReferralValidation('invalid');
        setReferralMessage('Invalid referral code');
      }
    } catch {
      setReferralValidation('invalid');
      setReferralMessage('Failed to validate referral code');
    }
  }, []);

  const handleReferralChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().trim();
    setReferralCode(value);
    setReferralValidation('idle');
    setReferralMessage('');

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (!value) return;

    debounceTimerRef.current = setTimeout(() => {
      validateReferralCode(value);
    }, 500);
  }, [validateReferralCode]);

  const handlePay = useCallback(async (method: KeepzMethod) => {
    setError(null);
    setIsSubmitting(true);
    setSelectedMethod(method);

    try {
      // 1. Get auth session with refresh fallback
      let { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const { data: { session: refreshed } } = await supabase.auth.refreshSession();
        session = refreshed;
      }
      if (!session?.access_token) throw new Error('Not authenticated');
      const token = session.access_token;

      let enrollmentRequestId: string;

      if (enrollmentMode === 'bundle') {
        // 2a. Create bundle enrollment request
        const enrollResponse = await fetch('/api/bundle-enrollment-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            bundleId: course.id,
            payment_method: 'keepz',
            referralCode: referralCode.trim() || undefined,
          }),
        });
        if (!enrollResponse.ok) {
          const errData = await enrollResponse.json();
          throw new Error(errData.error || 'Failed to create enrollment request');
        }
        const { request } = await enrollResponse.json();
        enrollmentRequestId = request.id;
      } else {
        // 2b. Create course enrollment request
        const enrollResponse = await fetch('/api/enrollment-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            courseId: course.id,
            payment_method: 'keepz',
            referralCode: referralCode.trim() || undefined,
            isReEnrollment: isReEnrollment || undefined,
          }),
        });
        if (!enrollResponse.ok) {
          const errData = await enrollResponse.json();
          throw new Error(errData.error || 'Failed to create enrollment request');
        }
        const { request } = await enrollResponse.json();
        enrollmentRequestId = request.id;
      }

      // 3. Create Keepz order with selected payment method
      const paymentType = enrollmentMode === 'bundle' ? 'bundle_enrollment' : 'course_enrollment';
      const orderResponse = await fetch('/api/payments/keepz/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ paymentType, referenceId: enrollmentRequestId, keepzMethod: method }),
      });
      if (!orderResponse.ok) {
        const errData = await orderResponse.json();
        throw new Error(errData.error || 'Failed to create payment');
      }
      const { checkoutUrl } = await orderResponse.json();

      // 4. Redirect to Keepz checkout
      window.location.href = checkoutUrl;
    } catch (err: any) {
      console.error('Enrollment payment error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
      setIsSubmitting(false);
      setSelectedMethod(null);
    }
  }, [course.id, enrollmentMode, referralCode, isReEnrollment]);

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  const price = course.price || 0;

  const paymentMethods: { id: KeepzMethod; icon: React.ReactNode; label: string; desc: string }[] = [
    {
      id: 'card',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
      label: t('paymentMethod.bankCard'),
      desc: t('paymentMethod.bankCardDesc'),
    },
    {
      id: 'online_banking',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      label: t('paymentMethod.onlineBanking'),
      desc: t('paymentMethod.onlineBankingDesc'),
    },
    {
      id: 'crypto',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: t('paymentMethod.crypto'),
      desc: t('paymentMethod.cryptoDesc'),
    },
    {
      id: 'all',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      ),
      label: t('paymentMethod.allMethods'),
      desc: t('paymentMethod.allMethodsDesc'),
    },
  ];

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/70 dark:bg-black/85 z-[9999] flex items-center justify-center p-4"
      onClick={() => { if (!isSubmitting) onClose(); }}
    >
      <div
        className="relative w-full max-w-md bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex-1 pr-4">
            <h2 className="text-xl font-bold text-charcoal-950 dark:text-white leading-tight">
              {course.title}
            </h2>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              ₾{price.toFixed(2)}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-50"
            aria-label={t('common.close')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 dark:border-navy-700/50" />

        {/* Referral Code */}
        <div className="p-6 pt-5 pb-4">
          <label className="block text-sm font-semibold text-charcoal-800 dark:text-gray-300 mb-2">
            {t('payment.referralCode')} <span className="text-gray-400 font-normal">({t('common.optional')})</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={referralCode}
              onChange={handleReferralChange}
              placeholder={t('payment.referralCodePlaceholder') || 'Enter referral code'}
              disabled={isSubmitting}
              className={`w-full px-4 py-3 text-base bg-gray-50 dark:bg-navy-800 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-charcoal-950 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 ${
                referralCode ? 'pr-16' : 'pr-4'
              } ${
                referralValidation === 'valid'
                  ? 'border-emerald-500 dark:border-emerald-400'
                  : referralValidation === 'invalid'
                  ? 'border-red-500 dark:border-red-400'
                  : 'border-gray-200 dark:border-navy-600 focus:border-emerald-500 dark:focus:border-emerald-400'
              }`}
              maxLength={20}
            />
            {referralCode && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setReferralCode('');
                    setReferralValidation('idle');
                    setReferralMessage('');
                  }}
                  className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-navy-600 transition-colors"
                >
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                {referralValidation === 'validating' && (
                  <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {referralValidation === 'valid' && (
                  <svg className="h-4 w-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {referralValidation === 'invalid' && (
                  <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
            )}
          </div>
          {referralMessage && (
            <p className={`text-xs mt-1.5 ${
              referralValidation === 'valid' ? 'text-emerald-600 dark:text-emerald-400'
                : referralValidation === 'invalid' ? 'text-red-600 dark:text-red-400'
                : 'text-gray-500'
            }`}>
              {referralMessage}
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 dark:border-navy-700/50" />

        {/* Payment Method Selector */}
        <div className="p-6 pt-5 pb-4">
          <h3 className="text-sm font-semibold text-charcoal-800 dark:text-gray-300 mb-3">
            {t('paymentMethod.selectMethod')}
          </h3>
          <div className="space-y-2">
            {paymentMethods.map((method) => {
              const isActive = selectedMethod === method.id;
              const isLoading = isSubmitting && isActive;
              const isDisabled = isSubmitting || referralValidation === 'validating';

              return (
                <button
                  key={method.id}
                  onClick={() => handlePay(method.id)}
                  disabled={isDisabled}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left group ${
                    isActive
                      ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/5'
                      : 'border-gray-200 dark:border-navy-700 hover:border-emerald-400 dark:hover:border-emerald-600 bg-gray-50 dark:bg-navy-800/50 hover:bg-emerald-50 dark:hover:bg-navy-800'
                  } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className={`flex-shrink-0 ${
                    isActive ? 'text-emerald-500' : 'text-gray-400 dark:text-gray-500 group-hover:text-emerald-500'
                  } transition-colors`}>
                    {isLoading ? (
                      <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : method.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${
                      isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-charcoal-900 dark:text-white'
                    }`}>
                      {method.label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {method.desc}
                    </p>
                  </div>
                  <svg className={`w-4 h-4 flex-shrink-0 ${
                    isActive ? 'text-emerald-500' : 'text-gray-300 dark:text-gray-600 group-hover:text-emerald-400'
                  } transition-colors`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              );
            })}
          </div>
        </div>

        {/* Submitting state indicator */}
        {isSubmitting && (
          <div className="px-6 pb-2">
            <p className="text-sm text-center text-emerald-600 dark:text-emerald-400 animate-pulse">
              {t('paymentMethod.redirecting')}
            </p>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="px-6 pb-4">
            <div className="p-3 rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* Bottom padding */}
        <div className="pb-2" />
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
