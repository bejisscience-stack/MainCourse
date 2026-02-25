'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/contexts/I18nContext';

export default function CompleteProfilePage() {
  const router = useRouter();
  const { user, profile, isLoading, mutate } = useUser();
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<'student' | 'lecturer'>('student');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  // Redirect if profile is already complete
  useEffect(() => {
    if (!isLoading && profile && profile.profile_completed !== false) {
      const dest = profile.role === 'lecturer' ? '/lecturer/dashboard' : '/my-courses';
      router.replace(dest);
    }
  }, [isLoading, profile, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No active session');
      }

      const response = await fetch('/api/complete-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ username: username.trim(), role }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 409 || result.error === 'username_taken') {
          throw new Error(t('auth.usernameTaken'));
        }
        throw new Error(result.error || 'Failed to complete profile');
      }

      setSuccess(true);
      await mutate();

      setTimeout(() => {
        const destination = role === 'lecturer' ? '/lecturer/dashboard' : '/my-courses';
        window.location.href = destination;
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setLoading(false);
    }
  };

  // Show loading while checking auth state
  if (isLoading || (!user && !isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#fafafa] to-white dark:from-navy-950 dark:to-navy-900">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-charcoal-950 dark:border-emerald-500"></div>
      </div>
    );
  }

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
            {t('auth.completeProfile')}
          </h2>
          <p className="mt-2 text-center text-sm text-charcoal-600 dark:text-gray-400">
            {t('auth.completeProfileSubtitle')}
          </p>
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg">
              {t('auth.profileCompleted')}
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
                  {t('auth.chooseUsername')}
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
                <label className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                  {t('auth.chooseRole')}
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

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-charcoal-950 dark:bg-emerald-500 hover:bg-charcoal-800 dark:hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? t('auth.completingSetup') : t('auth.completeSetup')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
