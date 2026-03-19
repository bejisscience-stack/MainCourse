"use client";

import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useI18n } from "@/contexts/I18nContext";

export default function RefundPolicyPage() {
  const { t } = useI18n();

  return (
    <main className="relative min-h-screen flex flex-col">
      <Navigation />
      <div className="flex-1 relative z-10 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-navy-800 rounded-2xl shadow-xl border border-charcoal-100 dark:border-navy-700/50 p-8 md:p-12">
            <h1 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white mb-4">
              {t("refund.title")}
            </h1>
            <div className="text-sm text-charcoal-500 dark:text-gray-400 mb-2">
              {t("refund.effectiveDate")}
            </div>
            <div className="text-sm text-charcoal-500 dark:text-gray-400 mb-8">
              {t("refund.lastUpdated")}
            </div>

            <div className="prose prose-charcoal dark:prose-invert max-w-none space-y-8">
              {/* Section 1 - General Provisions */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("refund.section1Title")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("refund.section1Text1")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("refund.section1Text2")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t("refund.section1Text3")}
                </p>
              </section>

              {/* Section 2 - 14-Day Withdrawal */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("refund.section2Title")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("refund.section2Text1")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("refund.section2Text2")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t("refund.section2Text3")}
                </p>
              </section>

              {/* Section 3 - Grounds for Refund */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("refund.section3Title")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("refund.section3Intro")}
                </p>
                <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300">
                  <li>{t("refund.section3Item1")}</li>
                  <li>{t("refund.section3Item2")}</li>
                  <li>{t("refund.section3Item3")}</li>
                  <li>{t("refund.section3Item4")}</li>
                </ul>
              </section>

              {/* Section 4 - Non-Refundable */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("refund.section4Title")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("refund.section4Intro")}
                </p>
                <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300">
                  <li>{t("refund.section4Item1")}</li>
                  <li>{t("refund.section4Item2")}</li>
                  <li>{t("refund.section4Item3")}</li>
                  <li>{t("refund.section4Item4")}</li>
                  <li>{t("refund.section4Item5")}</li>
                </ul>
              </section>

              {/* Section 5 - Refund Procedure */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("refund.section5Title")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("refund.section5Text1")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("refund.section5Text2")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("refund.section5Text3")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("refund.section5Text4")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t("refund.section5Text5")}
                </p>
              </section>

              {/* Section 6 - Provider Commission */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("refund.section6Title")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("refund.section6Text1")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t("refund.section6Text2")}
                </p>
              </section>

              {/* Section 7 - Project Budget */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("refund.section7Title")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("refund.section7Text1")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t("refund.section7Text2")}
                </p>
              </section>

              {/* Section 8 - Dispute Resolution */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("refund.section8Title")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t("refund.section8Text")}
                </p>
              </section>

              {/* Contact Information */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("refund.contactTitle")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 whitespace-pre-line">
                  {t("refund.contactInfo")}
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
