'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { resetPasswordForEmail } from '@/lib/auth';
import { useI18n } from '@/contexts/I18nContext';

function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { t } = useI18n();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await resetPasswordForEmail(email);
    } catch {
      // Silently catch errors to prevent email enumeration
    }

    // Always show success regardless of whether email exists
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-b from-[#fafafa] to-white dark:from-navy-950 dark:to-navy-900 px-4 py-12 overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-b from-[#fafafa] via-white to-[#fafafa] dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 pointer-events-none"></div>

      <div className="relative z-10 max-w-md w-full space-y-8 bg-white dark:bg-navy-800 p-8 rounded-2xl shadow-xl border border-charcoal-100 dark:border-navy-700/50">
        <div>
          <Link href="/" className="flex items-center justify-center mb-6">
            <img
              src="/wavleba-logo-new.png"
              alt="Wavleba"
              className="h-12 w-auto"
            />
          </Link>
          <h2 className="text-center text-3xl font-bold text-charcoal-950 dark:text-white">
            {t('auth.forgotPassword')}
          </h2>
          <p className="mt-2 text-center text-sm text-charcoal-600 dark:text-gray-400">
            {t('auth.forgotPasswordDescription')}
          </p>
        </div>

        {sent ? (
          <div className="space-y-6">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-lg text-sm">
              <div className="flex items-start">
                <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p>{t('auth.resetLinkSent')}</p>
              </div>
            </div>
            <div className="text-center">
              <Link
                href="/login"
                className="text-sm font-semibold text-charcoal-950 dark:text-emerald-400 hover:text-charcoal-700 dark:hover:text-emerald-300 transition-colors"
              >
                {t('auth.backToSignIn')}
              </Link>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                {t('auth.emailAddress')}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none relative block w-full px-4 py-3 bg-white dark:bg-navy-700 border border-charcoal-200 dark:border-navy-600 placeholder-gray-400 dark:placeholder-gray-500 text-charcoal-950 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent transition-colors"
                placeholder={t('auth.enterEmail')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-charcoal-950 dark:bg-emerald-500 hover:bg-charcoal-800 dark:hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t('auth.sendingResetLink') : t('auth.sendResetLink')}
            </button>

            <div className="text-center">
              <Link
                href="/login"
                className="text-sm font-semibold text-charcoal-950 dark:text-emerald-400 hover:text-charcoal-700 dark:hover:text-emerald-300 transition-colors"
              >
                {t('auth.backToSignIn')}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#fafafa] to-white dark:from-navy-950 dark:to-navy-900">
      <div className="text-charcoal-950 dark:text-white">Loading...</div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
