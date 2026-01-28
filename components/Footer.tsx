'use client';

import Link from 'next/link';
import { useI18n } from '@/contexts/I18nContext';

export default function Footer() {
  const { t } = useI18n();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-charcoal-950 dark:bg-navy-950 border-t border-charcoal-800 dark:border-navy-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center mb-4">
              <img
                src="/wavleba-logo-new.png"
                alt="Wavleba"
                className="h-10 w-auto"
              />
            </Link>
            <p className="text-charcoal-400 dark:text-gray-400 text-sm max-w-xs">
              {t('footer.description')}
            </p>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">{t('footer.legal')}</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/terms-and-conditions"
                  className="text-charcoal-400 dark:text-gray-400 hover:text-emerald-400 transition-colors text-sm"
                >
                  {t('footer.termsAndConditions')}
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy-policy"
                  className="text-charcoal-400 dark:text-gray-400 hover:text-emerald-400 transition-colors text-sm"
                >
                  {t('footer.privacyPolicy')}
                </Link>
              </li>
              <li>
                <Link
                  href="/personal-info-security"
                  className="text-charcoal-400 dark:text-gray-400 hover:text-emerald-400 transition-colors text-sm"
                >
                  {t('footer.personalInfoSecurity')}
                </Link>
              </li>
              <li>
                <Link
                  href="/refund-policy"
                  className="text-charcoal-400 dark:text-gray-400 hover:text-emerald-400 transition-colors text-sm"
                >
                  {t('footer.refundPolicy')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-white font-semibold mb-4">{t('footer.company')}</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/about-us"
                  className="text-charcoal-400 dark:text-gray-400 hover:text-emerald-400 transition-colors text-sm"
                >
                  {t('footer.aboutUs')}
                </Link>
              </li>
              <li>
                <Link
                  href="/courses"
                  className="text-charcoal-400 dark:text-gray-400 hover:text-emerald-400 transition-colors text-sm"
                >
                  {t('nav.courses')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-8 border-t border-charcoal-800 dark:border-navy-800">
          <p className="text-center text-charcoal-500 dark:text-gray-500 text-sm">
            &copy; {currentYear} Wavleba. {t('footer.allRightsReserved')}
          </p>
        </div>
      </div>
    </footer>
  );
}
