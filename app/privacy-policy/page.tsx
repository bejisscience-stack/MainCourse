"use client";

import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useI18n } from "@/contexts/I18nContext";

export default function PrivacyPolicyPage() {
  const { t } = useI18n();

  return (
    <main className="relative min-h-screen flex flex-col">
      <Navigation />
      <div className="flex-1 relative z-10 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-navy-800 rounded-2xl shadow-xl border border-charcoal-100 dark:border-navy-700/50 p-8 md:p-12">
            <h1 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white mb-4">
              {t("privacy.title")}
            </h1>
            <div className="text-sm text-charcoal-500 dark:text-gray-400 mb-2">
              {t("privacy.effectiveDate")}
            </div>
            <div className="text-sm text-charcoal-500 dark:text-gray-400 mb-8">
              {t("privacy.lastUpdated")}
            </div>

            <div className="prose prose-charcoal dark:prose-invert max-w-none space-y-8">
              {/* Section 1 - General Provisions */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("privacy.section1Title")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("privacy.section1Text1")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("privacy.section1Text2")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t("privacy.section1Text3")}
                </p>
              </section>

              {/* Section 2 - Data Controller */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("privacy.section2Title")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 whitespace-pre-line">
                  {t("privacy.section2Text")}
                </p>
              </section>

              {/* Section 3 - Data Collected */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("privacy.section3Title")}
                </h2>
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i}>
                      <h3 className="text-lg font-semibold text-charcoal-900 dark:text-gray-100 mb-2">
                        {t(`privacy.section3Sub${i}Title`)}
                      </h3>
                      <p className="text-charcoal-700 dark:text-gray-300">
                        {t(`privacy.section3Sub${i}Text`)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Section 4 - Purposes and Legal Bases */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("privacy.section4Title")}
                </h2>
                <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300">
                  <li>{t("privacy.section4Item1")}</li>
                  <li>{t("privacy.section4Item2")}</li>
                  <li>{t("privacy.section4Item3")}</li>
                  <li>{t("privacy.section4Item4")}</li>
                </ul>
              </section>

              {/* Section 5 - Data Sharing */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("privacy.section5Title")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("privacy.section5Text1")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("privacy.section5Text2")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t("privacy.section5Text3")}
                </p>
              </section>

              {/* Section 6 - Data Retention */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("privacy.section6Title")}
                </h2>
                <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300">
                  <li>{t("privacy.section6Item1")}</li>
                  <li>{t("privacy.section6Item2")}</li>
                  <li>{t("privacy.section6Item3")}</li>
                  <li>{t("privacy.section6Item4")}</li>
                  <li>{t("privacy.section6Item5")}</li>
                </ul>
              </section>

              {/* Section 7 - Data Security */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("privacy.section7Title")}
                </h2>
                <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300">
                  <li>{t("privacy.section7Item1")}</li>
                  <li>{t("privacy.section7Item2")}</li>
                  <li>{t("privacy.section7Item3")}</li>
                  <li>{t("privacy.section7Item4")}</li>
                  <li>{t("privacy.section7Item5")}</li>
                  <li>{t("privacy.section7Item6")}</li>
                </ul>
              </section>

              {/* Section 8 - User Rights */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("privacy.section8Title")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("privacy.section8Intro")}
                </p>
                <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300 mb-4">
                  <li>{t("privacy.section8Item1")}</li>
                  <li>{t("privacy.section8Item2")}</li>
                  <li>{t("privacy.section8Item3")}</li>
                  <li>{t("privacy.section8Item4")}</li>
                  <li>{t("privacy.section8Item5")}</li>
                  <li>{t("privacy.section8Item6")}</li>
                  <li>{t("privacy.section8Item7")}</li>
                  <li>{t("privacy.section8Item8")}</li>
                </ul>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("privacy.section8Contact")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("privacy.section8Response")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t("privacy.section8Complaint")}
                </p>
              </section>

              {/* Section 9 - Cookies */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("privacy.section9Title")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("privacy.section9Intro")}
                </p>
                <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300 mb-4">
                  <li>{t("privacy.section9Item1")}</li>
                  <li>{t("privacy.section9Item2")}</li>
                  <li>{t("privacy.section9Item3")}</li>
                </ul>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t("privacy.section9Text")}
                </p>
              </section>

              {/* Section 10 - Minors */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("privacy.section10Title")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("privacy.section10Text1")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t("privacy.section10Text2")}
                </p>
              </section>

              {/* Section 11 - International Transfer */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("privacy.section11Title")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("privacy.section11Text1")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t("privacy.section11Text2")}
                </p>
              </section>

              {/* Section 12 - Policy Changes */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("privacy.section12Title")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("privacy.section12Text1")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("privacy.section12Text2")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t("privacy.section12Text3")}
                </p>
              </section>

              {/* Contact Information */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("privacy.contactTitle")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 whitespace-pre-line">
                  {t("privacy.contactInfo")}
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
