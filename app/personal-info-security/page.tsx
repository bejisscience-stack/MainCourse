'use client';

import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { useI18n } from '@/contexts/I18nContext';

export default function PersonalInfoSecurityPage() {
  const { t } = useI18n();

  return (
    <main className="relative min-h-screen flex flex-col">
      <Navigation />
      <div className="flex-1 relative z-10 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-navy-800 rounded-2xl shadow-xl border border-charcoal-100 dark:border-navy-700/50 p-8 md:p-12">
            <h1 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white mb-8">
              {t('personalSecurity.title')}
            </h1>

            <div className="prose prose-charcoal dark:prose-invert max-w-none space-y-8">
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('personalSecurity.section1Title')}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t('personalSecurity.section1Text')}
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('personalSecurity.section2Title')}
                </h2>
                <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300">
                  <li>{t('personalSecurity.section2Item1')}</li>
                  <li>{t('personalSecurity.section2Item2')}</li>
                  <li>{t('personalSecurity.section2Item3')}</li>
                  <li>{t('personalSecurity.section2Item4')}</li>
                  <li>{t('personalSecurity.section2Item5')}</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('personalSecurity.section3Title')}
                </h2>
                <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300">
                  <li>{t('personalSecurity.section3Item1')}</li>
                  <li>{t('personalSecurity.section3Item2')}</li>
                  <li>{t('personalSecurity.section3Item3')}</li>
                  <li>{t('personalSecurity.section3Item4')}</li>
                  <li>{t('personalSecurity.section3Item5')}</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('personalSecurity.section4Title')}
                </h2>
                <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300">
                  <li>{t('personalSecurity.section4Item1')}</li>
                  <li>{t('personalSecurity.section4Item2')}</li>
                  <li>{t('personalSecurity.section4Item3')}</li>
                  <li>{t('personalSecurity.section4Item4')}</li>
                  <li>{t('personalSecurity.section4Item5')}</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('personalSecurity.section5Title')}
                </h2>
                <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300">
                  <li>{t('personalSecurity.section5Item1')}</li>
                  <li>{t('personalSecurity.section5Item2')}</li>
                  <li>{t('personalSecurity.section5Item3')}</li>
                  <li>{t('personalSecurity.section5Item4')}</li>
                  <li>{t('personalSecurity.section5Item5')}</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('personalSecurity.section6Title')}
                </h2>
                <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300">
                  <li>{t('personalSecurity.section6Item1')}</li>
                  <li>{t('personalSecurity.section6Item2')}</li>
                  <li>{t('personalSecurity.section6Item3')}</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('personalSecurity.section7Title')}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t('personalSecurity.contactInfo')}
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
