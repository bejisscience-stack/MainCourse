'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import type { EnrollmentWizardData } from '../EnrollmentWizard';
import { useI18n } from '@/contexts/I18nContext';
import { supabase } from '@/lib/supabase';

interface EnrollmentStepReferralProps {
  course: EnrollmentWizardData['course'];
  data: EnrollmentWizardData;
  updateData: (updates: Partial<EnrollmentWizardData>) => void;
  error?: string | null;
}

export default function EnrollmentStepReferral({
  data,
  updateData,
  error,
}: EnrollmentStepReferralProps) {
  const { t } = useI18n();
  const [validationState, setValidationState] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [validationMessage, setValidationMessage] = useState<string>('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleReferralCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().trim();
    updateData({ referralCode: value });

    // Clear any existing validation state when user types
    setValidationState('idle');
    setValidationMessage('');

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // If empty, don't validate (it's optional)
    if (!value) {
      return;
    }

    // Debounce validation (wait 500ms after user stops typing)
    debounceTimerRef.current = setTimeout(() => {
      validateReferralCode(value);
    }, 500);
  }, [updateData]);

  const validateReferralCode = useCallback(async (code: string) => {
    if (!code || !code.trim()) {
      setValidationState('idle');
      setValidationMessage('');
      return;
    }

    setValidationState('validating');
    setValidationMessage('');

    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setValidationState('invalid');
        setValidationMessage('Please log in to validate referral code');
        return;
      }

      // Call API to validate referral code
      const response = await fetch('/api/validate-referral-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          referralCode: code.trim(),
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        setValidationState('invalid');
        setValidationMessage(responseData.error || 'Failed to validate referral code');
      } else if (responseData.valid) {
        setValidationState('valid');
        setValidationMessage('Valid referral code');
      } else {
        setValidationState('invalid');
        setValidationMessage('Invalid referral code');
      }
    } catch (err) {
      console.error('Error validating referral code:', err);
      setValidationState('invalid');
      setValidationMessage('Failed to validate referral code');
    }
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <h3 className="text-2xl font-bold text-charcoal-950 dark:text-white mb-2">
          {t('enrollment.stepReferralTitle')}
        </h3>
        <p className="text-charcoal-600 dark:text-gray-400">
          {t('enrollment.stepReferralDescription')}
        </p>
      </div>

      {/* Referral Code Input */}
      <div className="bg-gray-50 dark:bg-navy-700/50 rounded-lg p-5 md:p-6 border-2 border-emerald-200 dark:border-emerald-700/50">
        <label className="block text-base md:text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">
          {t('payment.referralCode')} <span className="text-gray-500 dark:text-gray-400 font-normal">({t('common.optional')})</span>
        </label>
        <div className="relative">
          <input
            type="text"
            value={data.referralCode}
            onChange={handleReferralCodeChange}
            placeholder={t('payment.referralCodePlaceholder') || 'Enter referral code (optional)'}
            className={`w-full px-5 py-3 text-base bg-white dark:bg-navy-800 border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-charcoal-950 dark:text-white placeholder-charcoal-400 dark:placeholder-gray-500 pr-12 ${
              validationState === 'valid'
                ? 'border-emerald-500 dark:border-emerald-400 focus:ring-emerald-500 dark:focus:ring-emerald-400'
                : validationState === 'invalid'
                ? 'border-red-500 dark:border-red-400 focus:ring-red-500 dark:focus:ring-red-400'
                : 'border-charcoal-200 dark:border-navy-600 focus:ring-emerald-500 dark:focus:ring-emerald-400'
            }`}
            maxLength={20}
          />
          {/* Validation Icon */}
          {validationState !== 'idle' && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {validationState === 'validating' && (
                <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {validationState === 'valid' && (
                <svg className="h-5 w-5 text-emerald-500 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {validationState === 'invalid' && (
                <svg className="h-5 w-5 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
          )}
        </div>
        {/* Validation Message */}
        {validationMessage && (
          <p className={`text-sm mt-2 ${
            validationState === 'valid'
              ? 'text-emerald-600 dark:text-emerald-400'
              : validationState === 'invalid'
              ? 'text-red-600 dark:text-red-400'
              : 'text-gray-500 dark:text-gray-400'
          }`}>
            {validationMessage}
          </p>
        )}
        {!validationMessage && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {t('payment.referralCodeDescription')}
          </p>
        )}
      </div>

      {/* Info Box */}
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
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="text-base font-semibold text-blue-800 dark:text-blue-300">
              {t('enrollment.referralInfoTitle')}
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
              {t('enrollment.referralInfoDescription')}
            </p>
          </div>
        </div>
      </div>

      {/* Skip Option */}
      {!data.referralCode && (
        <div className="text-center pt-4">
          <p className="text-sm text-charcoal-500 dark:text-gray-400">
            {t('enrollment.referralSkipMessage')}
          </p>
        </div>
      )}

      {/* Error Message from Wizard Validation */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <svg
              className="w-6 h-6 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0"
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
              <p className="text-base font-semibold text-red-800 dark:text-red-300">
                Validation Error
              </p>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



