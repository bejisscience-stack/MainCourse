'use client';

import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { useI18n } from '@/contexts/I18nContext';

export default function RefundPolicyPage() {
  const { t } = useI18n();

  return (
    <main className="relative min-h-screen flex flex-col">
      <Navigation />
      <div className="flex-1 relative z-10 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-navy-800 rounded-2xl shadow-xl border border-charcoal-100 dark:border-navy-700/50 p-8 md:p-12">
            <h1 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white mb-8">
              {t('refund.title')}
            </h1>

            <div className="prose prose-charcoal dark:prose-invert max-w-none space-y-8">
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('refund.section1Title')}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t('refund.section1Text')}
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('refund.section2Title')}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t('refund.section2Text')}
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('refund.section3Title')}
                </h2>
                <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300">
                  <li>{t('refund.section3Item1')}</li>
                  <li>{t('refund.section3Item2')}</li>
                  <li>{t('refund.section3Item3')}</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t('refund.section4Title')}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t('refund.contactInfo')}
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
