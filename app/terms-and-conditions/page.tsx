'use client';

import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { useI18n } from '@/contexts/I18nContext';

export default function TermsAndConditionsPage() {
  const { t } = useI18n();

  return (
    <main className="relative min-h-screen flex flex-col">
      <Navigation />
      <div className="flex-1 relative z-10 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-navy-800 rounded-2xl shadow-xl border border-charcoal-100 dark:border-navy-700/50 p-8 md:p-12">
            <h1 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white mb-8">
              {t('terms.title')}
            </h1>

            <div className="prose prose-charcoal dark:prose-invert max-w-none space-y-8">
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('terms.section1Title')}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t('terms.section1Text')}
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('terms.section2Title')}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t('terms.section2Text')}
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('terms.section3Title')}
                </h2>
                <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300">
                  <li>{t('terms.section3Item1')}</li>
                  <li>{t('terms.section3Item2')}</li>
                  <li>{t('terms.section3Item3')}</li>
                  <li>{t('terms.section3Item4')}</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('terms.section4Title')}
                </h2>
                <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300">
                  <li>{t('terms.section4Item1')}</li>
                  <li>{t('terms.section4Item2')}</li>
                  <li>{t('terms.section4Item3')}</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('terms.section5Title')}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t('terms.section5Text')}
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('terms.section6Title')}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 mb-4">
                  {t('terms.section6Text1')}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300 mb-4">
                  {t('terms.section6Text2')}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300 mb-4">
                  {t('terms.section6Text3')}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t('terms.section6Text4')}
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('terms.section7Title')}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t('terms.section7Text')}
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('terms.section8Title')}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t('terms.section8Text')}
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('terms.section9Title')}
                </h2>
                <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300">
                  <li>{t('terms.section9Item1')}</li>
                  <li>{t('terms.section9Item2')}</li>
                  <li>{t('terms.section9Item3')}</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('terms.section10Title')}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t('terms.section10Text')}
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('terms.section11Title')}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t('terms.section11Text')}
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('terms.section12Title')}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t('terms.section12Text')}
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('terms.section13Title')}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t('terms.contactInfo')}
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
