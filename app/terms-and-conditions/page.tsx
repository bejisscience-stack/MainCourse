"use client";

import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useI18n } from "@/contexts/I18nContext";

export default function TermsAndConditionsPage() {
  const { t } = useI18n();

  return (
    <main className="relative min-h-screen flex flex-col">
      <Navigation />
      <div className="flex-1 relative z-10 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-navy-800 rounded-2xl shadow-xl border border-charcoal-100 dark:border-navy-700/50 p-8 md:p-12">
            <h1 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white mb-4">
              {t("terms.title")}
            </h1>
            <div className="text-sm text-charcoal-500 dark:text-gray-400 mb-2">
              {t("terms.effectiveDate")}
            </div>
            <div className="text-sm text-charcoal-500 dark:text-gray-400 mb-8">
              {t("terms.lastUpdated")}
            </div>

            <div className="prose prose-charcoal dark:prose-invert max-w-none space-y-8">
              {/* Article 1 - Introduction and General Provisions */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("terms.s1Title")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("terms.s1t1")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("terms.s1t2")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300 whitespace-pre-line mb-3">
                  {t("terms.s1info")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("terms.s1t3")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("terms.s1t4")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t("terms.s1t5")}
                </p>
              </section>

              {/* Article 2 - Definitions */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("terms.s2Title")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("terms.s2intro")}
                </p>
                <ul className="list-disc list-inside space-y-2 text-charcoal-700 dark:text-gray-300">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
                    <li key={i}>{t(`terms.s2i${i}`)}</li>
                  ))}
                </ul>
              </section>

              {/* Article 3 - Platform Role and Intermediation */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("terms.s3Title")}
                </h2>
                {[1, 2, 3, 4, 5].map((i) => (
                  <p
                    key={i}
                    className={`text-charcoal-700 dark:text-gray-300${i < 5 ? " mb-3" : ""}`}
                  >
                    {t(`terms.s3t${i}`)}
                  </p>
                ))}
              </section>

              {/* Article 4 - Registration and Account */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("terms.s4Title")}
                </h2>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <p
                    key={i}
                    className={`text-charcoal-700 dark:text-gray-300${i < 6 ? " mb-3" : ""}`}
                  >
                    {t(`terms.s4t${i}`)}
                  </p>
                ))}
              </section>

              {/* Article 5 - Courses and Educational Content */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("terms.s5Title")}
                </h2>
                {[1, 2, 3, 4, 5].map((i) => (
                  <p
                    key={i}
                    className={`text-charcoal-700 dark:text-gray-300${i < 5 ? " mb-3" : ""}`}
                  >
                    {t(`terms.s5t${i}`)}
                  </p>
                ))}
              </section>

              {/* Article 6 - Enrollment and Payment Terms */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("terms.s6Title")}
                </h2>
                {[1, 2, 3, 4, 5].map((i) => (
                  <p
                    key={i}
                    className={`text-charcoal-700 dark:text-gray-300${i < 5 ? " mb-3" : ""}`}
                  >
                    {t(`terms.s6t${i}`)}
                  </p>
                ))}
              </section>

              {/* Article 7 - Right of Withdrawal */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("terms.s7Title")}
                </h2>
                {[1, 2, 3, 4].map((i) => (
                  <p
                    key={i}
                    className={`text-charcoal-700 dark:text-gray-300${i < 4 ? " mb-3" : ""}`}
                  >
                    {t(`terms.s7t${i}`)}
                  </p>
                ))}
              </section>

              {/* Article 8 - Projects and Video Content Monetization */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("terms.s8Title")}
                </h2>
                {[1, 2, 3, 4].map((i) => (
                  <p
                    key={i}
                    className={`text-charcoal-700 dark:text-gray-300${i < 4 ? " mb-3" : ""}`}
                  >
                    {t(`terms.s8t${i}`)}
                  </p>
                ))}
              </section>

              {/* Article 9 - Project Access and Subscription */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("terms.s9Title")}
                </h2>
                {[1, 2, 3].map((i) => (
                  <p
                    key={i}
                    className={`text-charcoal-700 dark:text-gray-300${i < 3 ? " mb-3" : ""}`}
                  >
                    {t(`terms.s9t${i}`)}
                  </p>
                ))}
              </section>

              {/* Article 10 - Referral System */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("terms.s10Title")}
                </h2>
                {[1, 2, 3, 4].map((i) => (
                  <p
                    key={i}
                    className={`text-charcoal-700 dark:text-gray-300${i < 4 ? " mb-3" : ""}`}
                  >
                    {t(`terms.s10t${i}`)}
                  </p>
                ))}
              </section>

              {/* Article 11 - Balance and Withdrawal */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("terms.s11Title")}
                </h2>
                {[1, 2, 3, 4].map((i) => (
                  <p
                    key={i}
                    className={`text-charcoal-700 dark:text-gray-300${i < 4 ? " mb-3" : ""}`}
                  >
                    {t(`terms.s11t${i}`)}
                  </p>
                ))}
              </section>

              {/* Article 12 - User Obligations */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("terms.s12Title")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("terms.s12t1")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t("terms.s12t2")}
                </p>
              </section>

              {/* Article 13 - Intellectual Property */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("terms.s13Title")}
                </h2>
                {[1, 2, 3, 4].map((i) => (
                  <p
                    key={i}
                    className={`text-charcoal-700 dark:text-gray-300${i < 4 ? " mb-3" : ""}`}
                  >
                    {t(`terms.s13t${i}`)}
                  </p>
                ))}
              </section>

              {/* Article 14 - Limitation of Liability */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("terms.s14Title")}
                </h2>
                {[1, 2, 3, 4, 5].map((i) => (
                  <p
                    key={i}
                    className={`text-charcoal-700 dark:text-gray-300${i < 5 ? " mb-3" : ""}`}
                  >
                    {t(`terms.s14t${i}`)}
                  </p>
                ))}
              </section>

              {/* Article 15 - Account Suspension and Cancellation */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("terms.s15Title")}
                </h2>
                {[1, 2, 3, 4].map((i) => (
                  <p
                    key={i}
                    className={`text-charcoal-700 dark:text-gray-300${i < 4 ? " mb-3" : ""}`}
                  >
                    {t(`terms.s15t${i}`)}
                  </p>
                ))}
              </section>

              {/* Article 16 - Confidentiality and Data Protection */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("terms.s16Title")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 mb-3">
                  {t("terms.s16t1")}
                </p>
                <p className="text-charcoal-700 dark:text-gray-300">
                  {t("terms.s16t2")}
                </p>
              </section>

              {/* Article 17 - Changes to Terms */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("terms.s17Title")}
                </h2>
                {[1, 2, 3, 4].map((i) => (
                  <p
                    key={i}
                    className={`text-charcoal-700 dark:text-gray-300${i < 4 ? " mb-3" : ""}`}
                  >
                    {t(`terms.s17t${i}`)}
                  </p>
                ))}
              </section>

              {/* Article 18 - Applicable Law and Dispute Resolution */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("terms.s18Title")}
                </h2>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <p
                    key={i}
                    className={`text-charcoal-700 dark:text-gray-300${i < 6 ? " mb-3" : ""}`}
                  >
                    {t(`terms.s18t${i}`)}
                  </p>
                ))}
              </section>

              {/* Article 19 - Miscellaneous Provisions */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("terms.s19Title")}
                </h2>
                {[1, 2, 3, 4].map((i) => (
                  <p
                    key={i}
                    className={`text-charcoal-700 dark:text-gray-300${i < 4 ? " mb-3" : ""}`}
                  >
                    {t(`terms.s19t${i}`)}
                  </p>
                ))}
              </section>

              {/* Contact Information */}
              <section>
                <h2 className="text-2xl font-semibold text-charcoal-950 dark:text-white mb-4">
                  {t("terms.contactTitle")}
                </h2>
                <p className="text-charcoal-700 dark:text-gray-300 whitespace-pre-line">
                  {t("terms.contactInfo")}
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
