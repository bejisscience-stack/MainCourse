'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import BackgroundShapes from '@/components/BackgroundShapes';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { useI18n } from '@/contexts/I18nContext';
import { useCourses } from '@/hooks/useCourses';

export default function SettingsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { user, isLoading: userLoading } = useUser();
  const { courses } = useCourses('All');
  const [referralCode, setReferralCode] = useState<string>('');
  const [loadingReferralCode, setLoadingReferralCode] = useState(true);
  
  // Password update state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login?redirect=/settings');
    }
  }, [user, userLoading, router]);

  // Fetch referral code
  useEffect(() => {
    if (user?.id) {
      fetchReferralCode();
    }
  }, [user?.id]);

  const fetchReferralCode = async () => {
    try {
      setLoadingReferralCode(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', user!.id)
        .single();

      if (error) throw error;
      setReferralCode(data?.referral_code || '');
    } catch (err: any) {
      console.error('Error fetching referral code:', err);
    } finally {
      setLoadingReferralCode(false);
    }
  };

  const handleCopyReferralCode = useCallback(() => {
    if (referralCode) {
      navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [referralCode]);

  const handleCopyReferralLink = useCallback((link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(link);
    setTimeout(() => setCopiedLink(null), 2000);
  }, []);

  const getReferralLink = useCallback((courseId?: string) => {
    if (typeof window === 'undefined' || !referralCode) return '';
    const baseUrl = window.location.origin;
    const link = courseId 
      ? `${baseUrl}/signup?ref=${referralCode}&course=${courseId}`
      : `${baseUrl}/signup?ref=${referralCode}`;
    return link;
  }, [referralCode]);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(t('settings.allFieldsRequired'));
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError(t('settings.passwordTooShort'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('settings.passwordsDoNotMatch'));
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError(t('settings.newPasswordMustBeDifferent'));
      return;
    }

    setIsUpdatingPassword(true);

    try {
      // First, verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: currentPassword,
      });

      if (signInError) {
        setPasswordError(t('settings.currentPasswordIncorrect'));
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Clear success message after 3 seconds
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error updating password:', err);
      setPasswordError(err.message || t('settings.failedToUpdatePassword'));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (userLoading) {
    return (
      <main className="relative min-h-screen bg-white overflow-hidden">
        <BackgroundShapes />
        <Navigation />
        <div className="relative z-10 pt-24 pb-16 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-navy-900"></div>
            <p className="mt-4 text-navy-600">{t('common.loading')}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <main className="relative min-h-screen bg-white overflow-hidden">
      <BackgroundShapes />
      <Navigation />
      <div className="relative z-10 pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-navy-900 mb-2">{t('settings.title')}</h1>
            <p className="text-navy-600">{t('settings.subtitle')}</p>
          </div>

          <div className="space-y-6">
            {/* Referral Code Section */}
            <div className="bg-white border-2 border-navy-200 rounded-lg p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-navy-900 mb-4">{t('settings.referralCode')}</h2>
              <p className="text-sm text-navy-600 mb-4">{t('settings.referralCodeDescription')}</p>
              
              {loadingReferralCode ? (
                <div className="flex items-center justify-center py-4">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-navy-900"></div>
                </div>
              ) : referralCode ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-navy-50 border-2 border-navy-200 rounded-lg px-4 py-3">
                    <p className="text-2xl font-mono font-bold text-navy-900 tracking-wider">{referralCode}</p>
                  </div>
                  <button
                    onClick={handleCopyReferralCode}
                    className="px-6 py-3 bg-navy-900 text-white font-semibold rounded-lg hover:bg-navy-800 transition-colors flex items-center gap-2"
                  >
                    {copied ? (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {t('settings.copied')}
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        {t('settings.copy')}
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">{t('settings.referralCodeNotAvailable')}</p>
                </div>
              )}
            </div>

            {/* Referral Links Section */}
            {referralCode && (
              <div className="bg-white border-2 border-navy-200 rounded-lg p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-navy-900 mb-4">{t('settings.referralLinks')}</h2>
                <p className="text-sm text-navy-600 mb-6">{t('settings.referralLinksDescription')}</p>
                
                {/* General Referral Link */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-navy-700 mb-2">
                    {t('settings.generalReferralLink')}
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-navy-50 border-2 border-navy-200 rounded-lg px-4 py-3">
                      <p className="text-sm font-mono text-navy-900 break-all">{getReferralLink()}</p>
                    </div>
                    <button
                      onClick={() => handleCopyReferralLink(getReferralLink())}
                      className="px-4 py-3 bg-navy-900 text-white font-semibold rounded-lg hover:bg-navy-800 transition-colors flex items-center gap-2 whitespace-nowrap"
                    >
                      {copiedLink === getReferralLink() ? (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {t('settings.copied')}
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          {t('settings.copy')}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Course-Specific Referral Links */}
                {courses.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-navy-700 mb-3">
                      {t('settings.courseSpecificLinks')}
                    </label>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {courses.slice(0, 10).map((course) => {
                        const courseLink = getReferralLink(course.id);
                        return (
                          <div key={course.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-navy-900 mb-1">{course.title}</p>
                                <div className="bg-white border border-gray-300 rounded px-3 py-2 mt-2">
                                  <p className="text-xs font-mono text-gray-700 break-all">{courseLink}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleCopyReferralLink(courseLink)}
                                className="px-3 py-2 bg-navy-900 text-white text-sm font-semibold rounded-lg hover:bg-navy-800 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                                title={t('settings.copy')}
                              >
                                {copiedLink === courseLink ? (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {courses.length > 10 && (
                      <p className="text-xs text-navy-500 mt-2">{t('settings.showingFirst10Courses')}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Password Update Section */}
            <div className="bg-white border-2 border-navy-200 rounded-lg p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-navy-900 mb-4">{t('settings.updatePassword')}</h2>
              <p className="text-sm text-navy-600 mb-6">{t('settings.updatePasswordDescription')}</p>

              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                {/* Current Password */}
                <div>
                  <label className="block text-sm font-medium text-navy-700 mb-2">
                    {t('settings.currentPassword')}
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-navy-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent text-navy-900"
                    required
                    disabled={isUpdatingPassword}
                  />
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-navy-700 mb-2">
                    {t('settings.newPassword')}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-navy-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent text-navy-900"
                    required
                    minLength={6}
                    disabled={isUpdatingPassword}
                  />
                  <p className="text-xs text-navy-500 mt-1">{t('settings.passwordMinLength')}</p>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-navy-700 mb-2">
                    {t('settings.confirmPassword')}
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-navy-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent text-navy-900"
                    required
                    minLength={6}
                    disabled={isUpdatingPassword}
                  />
                </div>

                {/* Error Message */}
                {passwordError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {passwordError}
                  </div>
                )}

                {/* Success Message */}
                {passwordSuccess && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                    {t('settings.passwordUpdatedSuccessfully')}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="w-full md:w-auto px-6 py-3 bg-navy-900 text-white font-semibold rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isUpdatingPassword ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('settings.updating')}
                    </>
                  ) : (
                    t('settings.updatePassword')
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

