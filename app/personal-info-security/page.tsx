"use client";

import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useI18n } from "@/contexts/I18nContext";

export default function PersonalInfoSecurityPage() {
  const { t } = useI18n();

  return (
    <main className="relative min-h-screen flex flex-col">
      <Navigation />
      <div className="flex-1 relative z-10 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-navy-800 rounded-2xl shadow-xl border border-charcoal-100 dark:border-navy-700/50 p-8 md:p-12">
            <h1 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white mb-4">
              {t("personalSecurity.title")}
            </h1>
            <div className="text-sm text-charcoal-500 dark:text-gray-400 mb-2">
              {t("personalSecurity.effectiveDate")}
            </div>
            <div className="text-sm text-charcoal-500 dark:text-gray-400 mb-8">
              {t("personalSecurity.lastUpdated")}
            </div>

            <div className="prose prose-charcoal dark:prose-invert max-w-none space-y-8">
              {/* Section 1 - General Provisions */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("personalSecurity.section1Title")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("personalSecurity.section1Text1")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t("personalSecurity.section1Text2")}
                </p>
              </section>

              {/* Section 2 - Protected Data Categories */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("personalSecurity.section2Title")}
                </h2>
                <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300">
                  <li>{t("personalSecurity.section2Item1")}</li>
                  <li>{t("personalSecurity.section2Item2")}</li>
                  <li>{t("personalSecurity.section2Item3")}</li>
                  <li>{t("personalSecurity.section2Item4")}</li>
                  <li>{t("personalSecurity.section2Item5")}</li>
                  <li>{t("personalSecurity.section2Item6")}</li>
                </ul>
              </section>

              {/* Section 3 - Protection Principles */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("personalSecurity.section3Title")}
                </h2>
                <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300">
                  <li>{t("personalSecurity.section3Item1")}</li>
                  <li>{t("personalSecurity.section3Item2")}</li>
                  <li>{t("personalSecurity.section3Item3")}</li>
                  <li>{t("personalSecurity.section3Item4")}</li>
                  <li>{t("personalSecurity.section3Item5")}</li>
                  <li>{t("personalSecurity.section3Item6")}</li>
                  <li>{t("personalSecurity.section3Item7")}</li>
                </ul>
              </section>

              {/* Section 4 - Security Measures */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("personalSecurity.section4Title")}
                </h2>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-charcoal-900 dark:text-gray-100 mb-2">
                      {t("personalSecurity.section4Sub1Title")}
                    </h3>
                    <p className="text-charcoal-700 dark:text-gray-300">
                      {t("personalSecurity.section4Sub1Text")}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-charcoal-900 dark:text-gray-100 mb-2">
                      {t("personalSecurity.section4Sub2Title")}
                    </h3>
                    <p className="text-charcoal-700 dark:text-gray-300">
                      {t("personalSecurity.section4Sub2Text")}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-charcoal-900 dark:text-gray-100 mb-2">
                      {t("personalSecurity.section4Sub3Title")}
                    </h3>
                    <p className="text-charcoal-700 dark:text-gray-300">
                      {t("personalSecurity.section4Sub3Text")}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-charcoal-900 dark:text-gray-100 mb-2">
                      {t("personalSecurity.section4Sub4Title")}
                    </h3>
                    <p className="text-charcoal-700 dark:text-gray-300">
                      {t("personalSecurity.section4Sub4Text")}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-charcoal-900 dark:text-gray-100 mb-2">
                      {t("personalSecurity.section4Sub5Title")}
                    </h3>
                    <p className="text-charcoal-700 dark:text-gray-300">
                      {t("personalSecurity.section4Sub5Text")}
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 5 - User Rights */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("personalSecurity.section5Title")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("personalSecurity.section5Intro")}
                </p>
                <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300 mb-3">
                  <li>{t("personalSecurity.section5Item1")}</li>
                  <li>{t("personalSecurity.section5Item2")}</li>
                  <li>{t("personalSecurity.section5Item3")}</li>
                  <li>{t("personalSecurity.section5Item4")}</li>
                  <li>{t("personalSecurity.section5Item5")}</li>
                  <li>{t("personalSecurity.section5Item6")}</li>
                </ul>
                <p className="text-charcoal-700 dark:text-gray-300">
                  5.2. {t("personalSecurity.section5Contact")}
                </p>
              </section>

              {/* Section 6 - Incident Response */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("personalSecurity.section6Title")}
                </h2>
                <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300">
                  <li>{t("personalSecurity.section6Item1")}</li>
                  <li>{t("personalSecurity.section6Item2")}</li>
                  <li>{t("personalSecurity.section6Item3")}</li>
                  <li>{t("personalSecurity.section6Item4")}</li>
                  <li>{t("personalSecurity.section6Item5")}</li>
                  <li>{t("personalSecurity.section6Item6")}</li>
                </ul>
              </section>

              {/* Section 7 - Policy Changes */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("personalSecurity.section7Title")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("personalSecurity.section7Text1")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t("personalSecurity.section7Text2")}
                </p>
              </section>

              {/* Contact Information */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("personalSecurity.contactTitle")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 whitespace-pre-line">
                  {t("personalSecurity.contactInfo")}
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
