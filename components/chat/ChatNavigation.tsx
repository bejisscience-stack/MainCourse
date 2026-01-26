'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCurrentUser, signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/contexts/I18nContext';
import { languages } from '@/lib/i18n';
import type { User } from '@supabase/supabase-js';

// Language selector component for dark chat interface
function ChatLanguageSelector() {
  const { language, setLanguage } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const currentLanguage = languages.find(lang => lang.code === language) || languages[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-1.5 rounded-lg hover:bg-navy-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
        aria-label="Select language"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="text-lg" role="img" aria-label={currentLanguage.name}>
          {currentLanguage.flag}
        </span>
        <span className="hidden sm:inline text-sm font-medium text-gray-300">
          {currentLanguage.code.toUpperCase()}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-navy-800 border border-navy-700 rounded-lg shadow-xl py-2 z-50">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLanguage(lang.code);
                setIsOpen(false);
              }}
              className={`w-full flex items-center space-x-3 px-4 py-2 text-sm transition-colors ${
                language === lang.code
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                  : 'text-gray-300 hover:bg-navy-700 hover:text-white'
              }`}
            >
              <span className="text-lg" role="img" aria-label={lang.name}>
                {lang.flag}
              </span>
              <span className="flex-1 text-left">{lang.name}</span>
              {language === lang.code && (
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatNavigation() {
  const router = useRouter();
  const { t } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      
      if (currentUser) {
        // Get user name from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', currentUser.id)
          .single();
        
        // Always use profiles.username (required field in database)
        // Fallback to metadata/email only if profile doesn't exist (shouldn't happen)
        const profileUsername = profile?.username?.trim();
        
        if (profileUsername && profileUsername.length > 0) {
          setUserName(profileUsername);
        } else {
          // Fallback only if profile doesn't exist (shouldn't happen in normal flow)
          const metadataUsername = currentUser.user_metadata?.username?.trim();
          const emailUsername = currentUser.email?.split('@')[0];
          
          if (metadataUsername && metadataUsername.length > 0) {
            setUserName(metadataUsername);
          } else if (emailUsername && emailUsername.length > 0) {
            setUserName(emailUsername);
          } else {
            setUserName('User');
          }
        }
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="h-12 bg-navy-950/90 backdrop-blur-xl border-b border-navy-800/30 flex items-center justify-between px-4 shadow-sm z-50">
      {/* Left side - Logo and navigation */}
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center text-white hover:text-emerald-400 transition-colors"
          title={t('chat.home')}
        >
          <img
            src="/wavleba-logo.svg?v=2"
            alt="Wavleba"
            className="h-8 w-auto"
          />
        </Link>

        <div className="h-6 w-px bg-navy-700"></div>

        <Link
          href="/lecturer/dashboard"
          className="text-gray-400 hover:text-emerald-400 transition-colors text-sm font-medium flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          <span className="hidden sm:inline">{t('nav.dashboard')}</span>
        </Link>

        <Link
          href="/courses"
          className="text-gray-400 hover:text-emerald-400 transition-colors text-sm font-medium flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <span className="hidden sm:inline">{t('nav.courses')}</span>
        </Link>
      </div>

      {/* Right side - Language selector and User profile */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:block">
          <ChatLanguageSelector />
        </div>
        <div className="relative">
        <button
          onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-navy-700 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-semibold">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="hidden md:block text-left">
            <div className="text-white text-sm font-medium">{userName}</div>
            <div className="text-emerald-400 text-xs flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
              {t('chat.online')}
            </div>
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${
              profileMenuOpen ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* Profile dropdown menu */}
        {profileMenuOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-navy-800 border border-navy-700 rounded-lg shadow-xl py-1 z-50">
            <div className="px-4 py-3 border-b border-navy-700">
              <div className="text-white text-sm font-semibold">{userName}</div>
              <div className="text-gray-400 text-xs truncate">{user?.email}</div>
            </div>

            <Link
              href="/lecturer/dashboard"
              className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-navy-700 hover:text-emerald-400 transition-colors"
              onClick={() => setProfileMenuOpen(false)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span>{t('chat.myProfile')}</span>
            </Link>

            <Link
              href="/my-courses"
              className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-navy-700 hover:text-emerald-400 transition-colors"
              onClick={() => setProfileMenuOpen(false)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              <span>{t('chat.myCourses')}</span>
            </Link>

            <div className="border-t border-navy-700 my-1"></div>

            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-2 text-red-400 hover:bg-navy-700 hover:text-red-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span>{t('nav.signOut')}</span>
            </button>
          </div>
        )}
        </div>
      </div>

      {/* Overlay to close menu when clicking outside */}
      {profileMenuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setProfileMenuOpen(false)}
        ></div>
      )}
    </div>
  );
}

