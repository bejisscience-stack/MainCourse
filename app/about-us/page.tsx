'use client';

import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { useI18n } from '@/contexts/I18nContext';

export default function AboutUsPage() {
  const { t, language } = useI18n();

  return (
    <main className="relative min-h-screen flex flex-col">
      <Navigation />
      <div className="flex-1 relative z-10 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-navy-800 rounded-2xl shadow-xl border border-charcoal-100 dark:border-navy-700/50 p-8 md:p-12">
            <h1 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white mb-8">
              {t('aboutUs.title')}
            </h1>

            <div className="prose prose-charcoal dark:prose-invert max-w-none">
              <p className="text-lg text-charcoal-700 dark:text-gray-300 mb-6">
                {t('aboutUs.subtitle')}
              </p>

              <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mt-8 mb-4">
                {t('aboutUs.missionTitle')}
              </h2>
              <p className="text-charcoal-700 dark:text-gray-300 mb-6">
                {t('aboutUs.missionText')}
              </p>

              <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mt-8 mb-4">
                {t('aboutUs.forUsersTitle')}
              </h2>
              <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300 mb-6">
                <li>{t('aboutUs.forUsers1')}</li>
                <li>{t('aboutUs.forUsers2')}</li>
                <li>{t('aboutUs.forUsers3')}</li>
                <li>{t('aboutUs.forUsers4')}</li>
                <li>{t('aboutUs.forUsers5')}</li>
              </ul>

              <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mt-8 mb-4">
                {t('aboutUs.forLecturersTitle')}
              </h2>
              <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300 mb-6">
                <li>{t('aboutUs.forLecturers1')}</li>
                <li>{t('aboutUs.forLecturers2')}</li>
                <li>{t('aboutUs.forLecturers3')}</li>
                <li>{t('aboutUs.forLecturers4')}</li>
                <li>{t('aboutUs.forLecturers5')}</li>
              </ul>

              <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mt-8 mb-4">
                {t('aboutUs.howItWorksTitle')}
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-charcoal-700 dark:text-gray-300 mb-6">
                <li>{t('aboutUs.howItWorks1')}</li>
                <li>{t('aboutUs.howItWorks2')}</li>
                <li>{t('aboutUs.howItWorks3')}</li>
                <li>{t('aboutUs.howItWorks4')}</li>
              </ol>

              <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mt-8 mb-4">
                {t('aboutUs.whyWavlebaTitle')}
              </h2>
              <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300 mb-6">
                <li>{t('aboutUs.whyWavleba1')}</li>
                <li>{t('aboutUs.whyWavleba2')}</li>
                <li>{t('aboutUs.whyWavleba3')}</li>
              </ul>

              <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mt-8 mb-4">
                {t('aboutUs.visionTitle')}
              </h2>
              <p className="text-charcoal-700 dark:text-gray-300">
                {t('aboutUs.visionText')}
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
