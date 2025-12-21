'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signUp } from '@/lib/auth';
import { useI18n } from '@/contexts/I18nContext';

export default function SignUpPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<'student' | 'lecturer'>('student');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { user } = await signUp({ email, password, username, role });
      
      if (user) {
        setSuccess(true);
        // Redirect based on role
        setTimeout(() => {
          if (role === 'lecturer') {
            router.push('/lecturer');
          } else {
            router.push('/my-courses');
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-50 to-white px-4 py-12">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-navy-100">
        <div>
          <Link href="/" className="flex items-center justify-center space-x-2 mb-6">
            <div className="w-10 h-10 bg-navy-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">C</span>
            </div>
            <span className="text-navy-900 font-bold text-2xl">Course</span>
          </Link>
          <h2 className="text-center text-3xl font-bold text-navy-900">
            {t('auth.createAccount')}
          </h2>
          <p className="mt-2 text-center text-sm text-navy-600">
            {t('auth.startJourney')}
          </p>
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              {t('auth.accountCreated')}
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-navy-700 mb-2">
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
                  className="appearance-none relative block w-full px-4 py-3 bg-white border border-navy-200 placeholder-gray-400 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent transition-colors"
                  placeholder={t('auth.usernamePlaceholder')}
                />
                <p className="mt-1 text-xs text-navy-600">
                  {t('auth.usernameHint')}
                </p>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-navy-700 mb-2">
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
                  className="appearance-none relative block w-full px-4 py-3 bg-white border border-navy-200 placeholder-gray-400 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent transition-colors"
                  placeholder={t('auth.enterEmail')}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-navy-700 mb-2">
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
                  className="appearance-none relative block w-full px-4 py-3 bg-white border border-navy-200 placeholder-gray-400 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent transition-colors"
                  placeholder={t('auth.password')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-navy-700 mb-2">
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
                      className="w-4 h-4 text-navy-900 focus:ring-navy-500"
                    />
                    <span className="text-navy-700">{t('auth.student')}</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value="lecturer"
                      checked={role === 'lecturer'}
                      onChange={(e) => setRole(e.target.value as 'student' | 'lecturer')}
                      className="w-4 h-4 text-navy-900 focus:ring-navy-500"
                    />
                    <span className="text-navy-700">{t('auth.lecturer')}</span>
                  </label>
                </div>
                {role === 'lecturer' && (
                  <p className="mt-2 text-sm text-navy-600">
                    {t('auth.lecturerHint')}
                  </p>
                )}
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-navy-900 hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-navy-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? t('auth.creatingAccount') : t('nav.signUp')}
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-navy-600">
                {t('auth.alreadyHaveAccount')}{' '}
                <Link href="/login" className="font-semibold text-navy-900 hover:text-navy-700 transition-colors">
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
