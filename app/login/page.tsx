'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/contexts/I18nContext';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const navigationStartedRef = useRef(false);
  const { t } = useI18n();

  useEffect(() => {
    // Reset refs on mount to handle remounting scenarios
    isSubmittingRef.current = false;
    navigationStartedRef.current = false;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isSubmittingRef.current || navigationStartedRef.current) {
      return;
    }
    
    isSubmittingRef.current = true;
    setError(null);
    setLoading(true);

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setError('Request timed out. Please check your internet connection and try again.');
      setLoading(false);
    }, 30000); // 30 second timeout

    try {
      // Validate Supabase connection
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error('Supabase configuration is missing. Please check your environment variables.');
      }

      const result = await signIn({ email, password });
      clearTimeout(timeoutId);
      
      if (!result || !result.user) {
        throw new Error('Sign in failed. Please check your credentials.');
      }

      const { user, session } = result;

      // Ensure session is established and persisted
      let finalSession = session;
      if (!session) {
        // Wait a bit for session to be established
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Try to get the session again
        const { data: { session: newSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          throw new Error(`Session error: ${sessionError.message}`);
        }
        
        if (!newSession) {
          throw new Error('Session could not be established. Please try again.');
        }
        
        finalSession = newSession;
      }

      // Verify session is persisted in localStorage
      if (finalSession && typeof window !== 'undefined') {
        const storedSession = localStorage.getItem('supabase.auth.token');
        if (!storedSession) {
          // Wait a bit more for localStorage to be updated
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Fetch role and redirect accordingly
      let resolvedRole: string | null = null;
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          // Silent fail - use fallback
        }

        resolvedRole = profile?.role || user.user_metadata?.role || null;
        
        // Normalize stored role if metadata says lecturer but profile missing
        if (resolvedRole === 'lecturer' && profile?.role !== 'lecturer') {
          await supabase.from('profiles').update({ role: 'lecturer' }).eq('id', user.id);
        }
      } catch {
        // Use metadata role as fallback
        resolvedRole = user.user_metadata?.role || null;
      }
      
      // Check for redirect parameter
      const redirectTo = searchParams.get('redirect');
      
      // Determine destination
      let destination = '/my-courses';
      if (redirectTo) {
        destination = redirectTo;
      } else if (resolvedRole === 'admin') {
        destination = '/admin';
      } else if (resolvedRole === 'lecturer') {
        destination = '/lecturer/dashboard';
      }

      // Wait a moment to ensure session is fully persisted before redirecting
      await new Promise(resolve => setTimeout(resolve, 100));

      // Mark navigation as started to prevent any further submissions
      navigationStartedRef.current = true;
      
      // Use window.location for more reliable navigation
      window.location.href = destination;
    } catch (err: any) {
      clearTimeout(timeoutId);
      
      // Don't reset state if navigation has already started
      if (navigationStartedRef.current) {
        return;
      }
      
      // Provide more specific error messages
      let errorMessage = t('auth.signInFailed');
      
      if (err.message) {
        errorMessage = err.message;
      } else if (err.error_description) {
        errorMessage = err.error_description;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      // Handle specific Supabase errors
      if (err.status === 400 || err.message?.includes('Invalid login credentials')) {
        errorMessage = t('auth.invalidCredentials');
      } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
        errorMessage = t('auth.networkError');
      } else if (err.message?.includes('timeout')) {
        errorMessage = t('auth.requestTimeout');
      }
      
      setError(errorMessage);
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-b from-[#fafafa] to-white dark:from-navy-950 dark:to-navy-900 px-4 py-12 overflow-hidden">
      {/* Base gradient layer */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#fafafa] via-white to-[#fafafa] dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 pointer-events-none"></div>
      
      
      <div className="relative z-10 max-w-md w-full space-y-8 bg-white dark:bg-navy-800 p-8 rounded-2xl shadow-xl border border-charcoal-100 dark:border-navy-700/50">
        <div>
          <Link href="/" className="flex items-center justify-center space-x-2 mb-6">
            <div className="w-10 h-10 bg-charcoal-950 dark:bg-emerald-500 rounded-lg flex items-center justify-center transition-all duration-200">
              <span className="text-white font-bold text-xl">C</span>
            </div>
            <span className="text-charcoal-950 dark:text-white font-bold text-2xl">Course</span>
          </Link>
          <h2 className="text-center text-3xl font-bold text-charcoal-950 dark:text-white">
            {t('auth.welcomeBack')}
          </h2>
          <p className="mt-2 text-center text-sm text-charcoal-600 dark:text-gray-400">
            {t('auth.signInToContinue')}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm animate-in fade-in">
              <div className="flex items-start">
                <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-semibold">{t('auth.signInFailed')}</p>
                  <p className="mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
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
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none relative block w-full px-4 py-3 bg-white dark:bg-navy-700 border border-charcoal-200 dark:border-navy-600 placeholder-gray-400 dark:placeholder-gray-500 text-charcoal-950 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent transition-colors"
                placeholder={t('auth.enterPassword')}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-charcoal-950 dark:bg-emerald-500 hover:bg-charcoal-800 dark:hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t('auth.signingIn') : t('auth.signIn')}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-charcoal-600 dark:text-gray-400">
              {t('auth.dontHaveAccount')}{' '}
              <Link href="/signup" className="font-semibold text-charcoal-950 dark:text-emerald-400 hover:text-charcoal-700 dark:hover:text-emerald-300 transition-colors">
                {t('nav.signUp')}
              </Link>
            </p>
          </div>
        </form>
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

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LoginForm />
    </Suspense>
  );
}
