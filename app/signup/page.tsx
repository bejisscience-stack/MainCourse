'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signUp, signInWithGoogle } from '@/lib/auth';
import { useI18n } from '@/contexts/I18nContext';
import { saveReferral } from '@/lib/referral-storage';

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<'student' | 'lecturer'>('student');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralError, setReferralError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Get referral code and redirect URL from URL params
  useEffect(() => {
    const validateReferralCode = async () => {
      const ref = searchParams.get('ref');
      const redirect = searchParams.get('redirect');

      // Store redirect URL for post-signup navigation
      if (redirect) {
        setRedirectUrl(redirect);
      }

      if (ref) {
        const normalizedRef = ref.toUpperCase().trim();

        // Validate referral code using public API endpoint (bypasses RLS for unauthenticated users)
        try {
          const response = await fetch('/api/public/validate-referral-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ referralCode: normalizedRef }),
          });

          const result = await response.json();

          if (!result.valid) {
            // Referral code is invalid - show warning but allow signup to proceed
            setReferralError(`Note: Referral code "${normalizedRef}" was not found. You can still sign up, but the referral won't be applied.`);
            setReferralCode(''); // Don't set the referral code
          } else {
            // Referral code is valid - save to persistent storage
            setReferralCode(normalizedRef);
            setReferralError(null);
            saveReferral(normalizedRef);
          }
        } catch (error) {
          // If API call fails, allow signup without referral
          console.error('Failed to validate referral code:', error);
          setReferralError(`Note: Referral code "${normalizedRef}" could not be validated. You can still sign up, but the referral won't be applied.`);
          setReferralCode('');
        }
      }
    };

    validateReferralCode();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { user } = await signUp({
        email,
        password,
        username,
        role,
        signupReferralCode: referralCode || undefined
      });
      
      if (user) {
        setSuccess(true);
        // Redirect based on role and redirect URL
        setTimeout(() => {
          if (role === 'lecturer') {
            router.push('/lecturer');
          } else {
            // Priority: redirect URL (from pending enrollment) > referral flow > default
            if (redirectUrl) {
              // Use window.location.href for reliable navigation with query params
              window.location.href = redirectUrl;
              return;
            } else if (referralCode) {
              // If user registered with referral code, redirect to home page
              router.push('/');
            } else {
              router.push('/my-courses');
            }
          }
          router.refresh();
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || t('auth.failedToCreateAccount'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-b from-[#fafafa] to-white dark:from-navy-950 dark:to-navy-900 px-4 py-12 overflow-hidden">
      {/* Base gradient layer */}
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
            {t('auth.createAccount')}
          </h2>
          <p className="mt-2 text-center text-sm text-charcoal-600 dark:text-gray-400">
            {t('auth.startJourney')}
          </p>
          {referralCode && (
            <div className="mt-4 bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-lg text-sm text-center">
              {t('auth.referralLinkDetected')?.replace('{{code}}', referralCode) || `You've been referred by someone! Referral code: ${referralCode}`}
            </div>
          )}
          {referralError && (
            <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300 px-4 py-3 rounded-lg text-sm text-center">
              {referralError}
            </div>
          )}
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg">
              {t('auth.accountCreated')}
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                  {t('auth.usernameRequired')}
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.trim())}
                  minLength={3}
                  maxLength={30}
                  pattern="[a-zA-Z0-9_]+"
                  title={t('auth.usernameValidation')}
                  className="appearance-none relative block w-full px-4 py-3 bg-white dark:bg-navy-700 border border-charcoal-200 dark:border-navy-600 placeholder-gray-400 dark:placeholder-gray-500 text-charcoal-950 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent transition-colors"
                  placeholder={t('auth.usernamePlaceholder')}
                />
                <p className="mt-1 text-xs text-charcoal-600 dark:text-gray-400">
                  {t('auth.usernameHint')}
                </p>
              </div>

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

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                  {t('auth.password')}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  className="appearance-none relative block w-full px-4 py-3 bg-white dark:bg-navy-700 border border-charcoal-200 dark:border-navy-600 placeholder-gray-400 dark:placeholder-gray-500 text-charcoal-950 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent transition-colors"
                  placeholder={t('auth.password')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                  {t('auth.registerAs')}
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value="student"
                      checked={role === 'student'}
                      onChange={(e) => setRole(e.target.value as 'student' | 'lecturer')}
                      className="w-4 h-4 text-emerald-500 dark:text-emerald-400 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                    />
                    <span className="text-charcoal-700 dark:text-gray-300">{t('auth.student')}</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value="lecturer"
                      checked={role === 'lecturer'}
                      onChange={(e) => setRole(e.target.value as 'student' | 'lecturer')}
                      className="w-4 h-4 text-emerald-500 dark:text-emerald-400 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                    />
                    <span className="text-charcoal-700 dark:text-gray-300">{t('auth.lecturer')}</span>
                  </label>
                </div>
                {role === 'lecturer' && (
                  <p className="mt-2 text-sm text-charcoal-600 dark:text-gray-400">
                    {t('auth.lecturerHint')}
                  </p>
                )}
              </div>
            </div>

            {/* Terms Agreement Notice */}
            <div className="text-center text-sm text-charcoal-600 dark:text-gray-400">
              <p>
                {t('auth.termsAgreement')}{' '}
                <Link
                  href="/terms-and-conditions"
                  className="font-semibold text-charcoal-950 dark:text-emerald-400 hover:text-charcoal-700 dark:hover:text-emerald-300 transition-colors underline"
                  target="_blank"
                >
                  {t('auth.termsAndConditions')}
                </Link>
                {' '}{t('auth.and')}{' '}
                <Link
                  href="/privacy-policy"
                  className="font-semibold text-charcoal-950 dark:text-emerald-400 hover:text-charcoal-700 dark:hover:text-emerald-300 transition-colors underline"
                  target="_blank"
                >
                  {t('auth.privacyPolicy')}
                </Link>
              </p>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-charcoal-950 dark:bg-emerald-500 hover:bg-charcoal-800 dark:hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? t('auth.creatingAccount') : t('nav.signUp')}
              </button>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-charcoal-200 dark:border-navy-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-navy-800 text-charcoal-500 dark:text-gray-400">
                  {t('auth.orContinueWith')}
                </span>
              </div>
            </div>

            {/* Google Sign-Up Button */}
            <div>
              <button
                type="button"
                disabled={googleLoading || loading}
                onClick={async () => {
                  setGoogleLoading(true);
                  setError(null);
                  try {
                    await signInWithGoogle();
                  } catch (err: any) {
                    setError(err.message || t('auth.googleSignInFailed'));
                    setGoogleLoading(false);
                  }
                }}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-charcoal-200 dark:border-navy-600 rounded-lg text-sm font-medium text-charcoal-700 dark:text-gray-300 bg-white dark:bg-navy-700 hover:bg-charcoal-50 dark:hover:bg-navy-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {googleLoading ? t('auth.signingIn') : t('auth.continueWithGoogle')}
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-charcoal-600 dark:text-gray-400">
                {t('auth.alreadyHaveAccount')}{' '}
                <Link
                  href={`/login${redirectUrl ? `?redirect=${encodeURIComponent(redirectUrl)}` : ''}`}
                  className="font-semibold text-charcoal-950 dark:text-emerald-400 hover:text-charcoal-700 dark:hover:text-emerald-300 transition-colors"
                >
                  {t('auth.signIn')}
                </Link>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#fafafa] to-white dark:from-navy-950 dark:to-navy-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-charcoal-950 dark:border-emerald-500"></div>
        </div>
      </div>
    }>
      <SignUpForm />
    </Suspense>
  );
}
