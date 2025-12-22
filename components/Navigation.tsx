'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth';
import { useUser } from '@/hooks/useUser';
import { useI18n } from '@/contexts/I18nContext';
import LanguageSelector from './LanguageSelector';

function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const router = useRouter();
  const { user, profile, role: userRole, isLoading: loading } = useUser();
  const { t } = useI18n();

  // Close profile menu when clicking outside or navigating
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isProfileMenuOpen) {
        setIsProfileMenuOpen(false);
      }
    };

    if (isProfileMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [isProfileMenuOpen]);

  const handleSignOut = useCallback(async () => {
    try {
      setSignOutError(null);
      setSignOutLoading(true);
      await signOut();
      setIsProfileMenuOpen(false);
      setIsMenuOpen(false);
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Error signing out:', error);
      setSignOutError(t('auth.failedToSignOut'));
    } finally {
      setSignOutLoading(false);
    }
  }, [router]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-navy-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-navy-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg md:text-xl">C</span>
            </div>
            <span className="text-navy-900 font-bold text-xl md:text-2xl">Course</span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            {userRole !== 'lecturer' && (
              <>
                <Link href="#about" className="text-navy-700 hover:text-navy-900 font-medium transition-colors">
                  {t('nav.about')}
                </Link>
                <Link href="/courses" className="text-navy-700 hover:text-navy-900 font-medium transition-colors">
                  {t('nav.courses')}
                </Link>
                {user && (
                  <Link href="/my-courses" className="text-navy-700 hover:text-navy-900 font-medium transition-colors">
                    {t('nav.myCourses')}
                  </Link>
                )}
                <Link href="#testimonials" className="text-navy-700 hover:text-navy-900 font-medium transition-colors">
                  {t('nav.testimonials')}
                </Link>
                <Link href="#contact" className="text-navy-700 hover:text-navy-900 font-medium transition-colors">
                  {t('nav.contact')}
                </Link>
              </>
            )}
            {userRole === 'lecturer' && (
              <Link href="/lecturer/dashboard" className="text-navy-700 hover:text-navy-900 font-medium transition-colors">
                {t('nav.dashboard')}
              </Link>
            )}
            {userRole === 'admin' && (
              <>
                <Link href="/admin" className="text-navy-700 hover:text-navy-900 font-medium transition-colors">
                  {t('nav.adminDashboard')}
                </Link>
                <Link href="/courses" className="text-navy-700 hover:text-navy-900 font-medium transition-colors">
                  {t('nav.allCourses')}
                </Link>
              </>
            )}
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <LanguageSelector />
            {loading ? (
              <div className="text-navy-600 text-sm">{t('common.loading')}</div>
            ) : user ? (
              <div className="relative">
                {/* Profile Icon Button */}
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:ring-offset-2 rounded-full p-1.5 hover:bg-navy-50 transition-colors"
                  aria-label={t('nav.userMenu')}
                >
                  <div className="w-10 h-10 bg-navy-900 rounded-full flex items-center justify-center text-white font-semibold">
                    {(profile?.username || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <svg
                    className={`w-4 h-4 text-navy-600 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Profile Dropdown Menu */}
                {isProfileMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsProfileMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-navy-100 py-2 z-50">
                      <div className="px-4 py-3 border-b border-navy-100">
                        <p className="text-sm font-semibold text-navy-900">
                          {profile?.username || t('nav.user')}
                        </p>
                        <p className="text-xs text-navy-600 truncate">
                          {user.email}
                        </p>
                        {userRole === 'lecturer' && (
                          <span className="inline-block mt-2 px-2 py-0.5 text-xs font-medium bg-navy-100 text-navy-900 rounded">
                            {t('nav.lecturer')}
                          </span>
                        )}
                        {userRole === 'admin' && (
                          <span className="inline-block mt-2 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-900 rounded">
                            {t('nav.admin')}
                          </span>
                        )}
                      </div>
                      <div className="py-1">
                        {userRole === 'lecturer' ? (
                          <>
                            <Link
                              href="/lecturer/dashboard"
                              onClick={() => setIsProfileMenuOpen(false)}
                              className="flex items-center px-4 py-2 text-sm text-navy-700 hover:bg-navy-50 transition-colors"
                            >
                              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              {t('nav.dashboard')}
                            </Link>
                            <Link
                              href="/lecturer/chat"
                              onClick={() => setIsProfileMenuOpen(false)}
                              className="flex items-center px-4 py-2 text-sm text-navy-700 hover:bg-navy-50 transition-colors"
                            >
                              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              {t('nav.chat')}
                            </Link>
                            <Link
                              href="/settings"
                              onClick={() => setIsProfileMenuOpen(false)}
                              className="flex items-center px-4 py-2 text-sm text-navy-700 hover:bg-navy-50 transition-colors"
                            >
                              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {t('nav.settings')}
                            </Link>
                          </>
                        ) : userRole === 'admin' ? (
                          <>
                            <Link
                              href="/admin"
                              onClick={() => setIsProfileMenuOpen(false)}
                              className="flex items-center px-4 py-2 text-sm text-navy-700 hover:bg-navy-50 transition-colors"
                            >
                              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                              {t('nav.adminDashboard')}
                            </Link>
                            <Link
                              href="/courses"
                              onClick={() => setIsProfileMenuOpen(false)}
                              className="flex items-center px-4 py-2 text-sm text-navy-700 hover:bg-navy-50 transition-colors"
                            >
                              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                              {t('nav.allCourses')}
                            </Link>
                            <Link
                              href="/settings"
                              onClick={() => setIsProfileMenuOpen(false)}
                              className="flex items-center px-4 py-2 text-sm text-navy-700 hover:bg-navy-50 transition-colors"
                            >
                              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {t('nav.settings')}
                            </Link>
                          </>
                        ) : (
                          <>
                            <Link
                              href="/courses"
                              onClick={() => setIsProfileMenuOpen(false)}
                              className="flex items-center px-4 py-2 text-sm text-navy-700 hover:bg-navy-50 transition-colors"
                            >
                              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                              {t('nav.myCourses')}
                            </Link>
                          </>
                        )}
                        <Link
                          href="/settings"
                          onClick={() => setIsProfileMenuOpen(false)}
                          className="flex items-center px-4 py-2 text-sm text-navy-700 hover:bg-navy-50 transition-colors"
                        >
                          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {t('nav.settings')}
                        </Link>
                        <button
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            handleSignOut();
                          }}
                          disabled={signOutLoading}
                          className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          {signOutLoading ? t('nav.signingOut') : t('nav.signOut')}
                        </button>
                        {signOutError && (
                          <div className="px-4 py-2 text-xs text-red-600">{signOutError}</div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-navy-900 font-semibold hover:text-navy-700 transition-colors px-4 py-2"
                >
                  {t('nav.logIn')}
                </Link>
                <Link
                  href="/signup"
                  className="bg-navy-900 text-white font-semibold px-6 py-2 rounded-lg hover:bg-navy-800 transition-colors"
                >
                  {t('nav.signUp')}
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-navy-900 focus:outline-none"
            aria-label={t('nav.toggleMenu')}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {isMenuOpen ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-navy-100">
            <div className="flex flex-col space-y-4">
              {userRole !== 'lecturer' && (
                <>
                  <Link
                    href="#about"
                    className="text-navy-700 hover:text-navy-900 font-medium transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t('nav.about')}
                  </Link>
                  <Link
                    href="/courses"
                    className="text-navy-700 hover:text-navy-900 font-medium transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t('nav.courses')}
                  </Link>
                  {user && (
                    <Link
                      href="/my-courses"
                      className="text-navy-700 hover:text-navy-900 font-medium transition-colors"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {t('nav.myCourses')}
                    </Link>
                  )}
                  <Link
                    href="#testimonials"
                    className="text-navy-700 hover:text-navy-900 font-medium transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t('nav.testimonials')}
                  </Link>
                  <Link
                    href="#contact"
                    className="text-navy-700 hover:text-navy-900 font-medium transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t('nav.contact')}
                  </Link>
                </>
              )}
              {userRole === 'lecturer' && (
                <Link
                  href="/lecturer/dashboard"
                  className="text-navy-700 hover:text-navy-900 font-medium transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t('nav.dashboard')}
                </Link>
              )}
              <div className="pt-4 border-t border-navy-100">
                <div className="mb-4">
                  <LanguageSelector />
                </div>
                {loading ? (
                  <div className="text-navy-600 text-sm text-center py-2">{t('common.loading')}</div>
                ) : user ? (
                  <div className="space-y-2">
                    {/* Mobile Profile Section */}
                    <div className="flex items-center space-x-3 px-2 py-3 bg-navy-50 rounded-lg mb-2">
                      <div className="w-10 h-10 bg-navy-900 rounded-full flex items-center justify-center text-white font-semibold">
                        {(profile?.username || user.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-navy-900 truncate">
                          {profile?.username || t('nav.user')}
                        </p>
                        <p className="text-xs text-navy-600 truncate">
                          {user.email}
                        </p>
                        {userRole === 'lecturer' && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-navy-200 text-navy-900 rounded">
                            {t('nav.lecturer')}
                          </span>
                        )}
                        {userRole === 'admin' && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-red-200 text-red-900 rounded">
                            {t('nav.admin')}
                          </span>
                        )}
                      </div>
                    </div>
                    {userRole === 'lecturer' ? (
                      <>
                        <Link
                          href="/lecturer/dashboard"
                          className="flex items-center w-full px-4 py-2 text-navy-900 font-semibold hover:bg-navy-50 rounded-lg transition-colors"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {t('nav.dashboard')}
                        </Link>
                        <Link
                          href="/lecturer/chat"
                          className="flex items-center w-full px-4 py-2 text-navy-700 hover:bg-navy-50 rounded-lg transition-colors"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          {t('nav.chat')}
                        </Link>
                        <Link
                          href="/settings"
                          className="flex items-center w-full px-4 py-2 text-navy-700 hover:bg-navy-50 rounded-lg transition-colors"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {t('nav.settings')}
                        </Link>
                      </>
                    ) : userRole === 'admin' ? (
                      <>
                        <Link
                          href="/admin"
                          className="flex items-center w-full px-4 py-2 text-navy-900 font-semibold hover:bg-navy-50 rounded-lg transition-colors"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          {t('nav.adminDashboard')}
                        </Link>
                        <Link
                          href="/courses"
                          className="flex items-center w-full px-4 py-2 text-navy-700 hover:bg-navy-50 rounded-lg transition-colors"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                          {t('nav.allCourses')}
                        </Link>
                        <Link
                          href="/settings"
                          className="flex items-center w-full px-4 py-2 text-navy-700 hover:bg-navy-50 rounded-lg transition-colors"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {t('nav.settings')}
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link
                          href="/my-courses"
                          className="flex items-center w-full px-4 py-2 text-navy-700 hover:bg-navy-50 rounded-lg transition-colors"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                          {t('nav.myCourses')}
                        </Link>
                        <Link
                          href="/settings"
                          className="flex items-center w-full px-4 py-2 text-navy-700 hover:bg-navy-50 rounded-lg transition-colors"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {t('nav.settings')}
                        </Link>
                      </>
                    )}
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        handleSignOut();
                      }}
                      disabled={signOutLoading}
                      className="flex items-center w-full px-4 py-2 text-red-600 font-semibold hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      {signOutLoading ? t('nav.signingOut') : t('nav.signOut')}
                    </button>
                    {signOutError && (
                      <div className="px-4 text-xs text-red-600">{signOutError}</div>
                    )}
                  </div>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="text-navy-900 font-semibold text-center py-2 block"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {t('nav.logIn')}
                    </Link>
                    <Link
                      href="/signup"
                      className="bg-navy-900 text-white font-semibold text-center py-2 rounded-lg hover:bg-navy-800 transition-colors block"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {t('nav.signUp')}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

export default memo(Navigation);

