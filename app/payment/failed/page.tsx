'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/contexts/I18nContext';

function PaymentFailedContent() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-navy-900/95 border border-navy-800/60 rounded-2xl shadow-soft-xl p-8 text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">{t('paymentMethod.paymentFailed')}</h1>
        <p className="text-gray-400 mb-6">{t('paymentMethod.paymentFailedMessage')}</p>
        <button
          onClick={() => router.push('/courses')}
          className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold"
        >
          {t('paymentMethod.tryAgain')}
        </button>
      </div>
    </div>
  );
}

export default function PaymentFailedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-navy-950" />}>
      <PaymentFailedContent />
    </Suspense>
  );
}
