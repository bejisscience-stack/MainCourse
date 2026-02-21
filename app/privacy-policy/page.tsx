'use client';

import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { useI18n } from '@/contexts/I18nContext';

export default function PrivacyPolicyPage() {
  const { t } = useI18n();

  return (
    <main className="relative min-h-screen flex flex-col">
      <Navigation />
      <div className="flex-1 relative z-10 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-navy-800 rounded-2xl shadow-xl border border-charcoal-100 dark:border-navy-700/50 p-8 md:p-12">
            <h1 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white mb-8">
              {t('privacy.title')}
            </h1>

            <div className="prose prose-charcoal dark:prose-invert max-w-none space-y-8">
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('privacy.section1Title')}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t('privacy.section1Text')}
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('privacy.section2Title')}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t('privacy.section2Text')}
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('privacy.section3Title')}
                </h2>
                <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300">
                  <li>{t('privacy.section3Item1')}</li>
                  <li>{t('privacy.section3Item2')}</li>
                  <li>{t('privacy.section3Item3')}</li>
                  <li>{t('privacy.section3Item4')}</li>
                  <li>{t('privacy.section3Item5')}</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('privacy.section4Title')}
                </h2>
                <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300">
                  <li>{t('privacy.section4Item1')}</li>
                  <li>{t('privacy.section4Item2')}</li>
                  <li>{t('privacy.section4Item3')}</li>
                  <li>{t('privacy.section4Item4')}</li>
                  <li>{t('privacy.section4Item5')}</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('privacy.section5Title')}
                </h2>
                <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300">
                  <li>{t('privacy.section5Item1')}</li>
                  <li>{t('privacy.section5Item2')}</li>
                  <li>{t('privacy.section5Item3')}</li>
                  <li>{t('privacy.section5Item4')}</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('privacy.section6Title')}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t('privacy.section6Text')}
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('privacy.section7Title')}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t('privacy.section7Text')}
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('privacy.section8Title')}
                </h2>
                <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300">
                  <li>{t('privacy.section8Item1')}</li>
                  <li>{t('privacy.section8Item2')}</li>
                  <li>{t('privacy.section8Item3')}</li>
                  <li>{t('privacy.section8Item4')}</li>
                  <li>{t('privacy.section8Item5')}</li>
                  <li>{t('privacy.section8Item6')}</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('privacy.section9Title')}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t('privacy.section9Text')}
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('privacy.section10Title')}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t('privacy.section10Text')}
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('privacy.section11Title')}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t('privacy.section11Text')}
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('privacy.section12Title')}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t('privacy.contactInfo')}
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
