'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useI18n } from '@/contexts/I18nContext';
import { supabase } from '@/lib/supabase';

function PaymentSuccessContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();
  const paymentId = searchParams.get('paymentId');

  const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'timeout'>('loading');
  const [paymentType, setPaymentType] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    if (!paymentId) { setStatus('failed'); return true; }

    let { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      const { data: { session: refreshed } } = await supabase.auth.refreshSession();
      session = refreshed;
    }
    if (!session?.access_token) { setStatus('failed'); return true; }

    try {
      const res = await fetch(`/api/payments/keepz/status?paymentId=${paymentId}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (!res.ok) { setStatus('failed'); return true; }

      const data = await res.json();
      setPaymentType(data.paymentType);

      if (data.status === 'success') { setStatus('success'); return true; }
      if (data.status === 'failed') { setStatus('failed'); return true; }
    } catch {
      // Keep polling on network errors
    }
    return false;
  }, [paymentId]);

  useEffect(() => {
    if (!paymentId) { setStatus('failed'); return; }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 15;

    const poll = async () => {
      if (cancelled) return;
      attempts++;
      const done = await checkStatus();
      if (!done && !cancelled && attempts < maxAttempts) {
        setTimeout(poll, 2000);
      } else if (!done && attempts >= maxAttempts) {
        setStatus('timeout');
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [paymentId, checkStatus]);

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-navy-900/95 border border-navy-800/60 rounded-2xl shadow-soft-xl p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-2">{t('paymentMethod.processingPayment')}</h1>
            <p className="text-gray-400">{t('paymentMethod.pleaseWait')}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">{t('paymentMethod.paymentSuccessful')}</h1>
            <p className="text-gray-400 mb-6">{t('paymentMethod.paymentConfirmed')}</p>
            <button
              onClick={() => router.push(paymentType === 'course_enrollment' ? '/my-courses' : '/chat')}
              className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold"
            >
              {paymentType === 'course_enrollment' ? t('paymentMethod.goToCourses') : t('paymentMethod.goToProjects')}
            </button>
          </>
        )}
        {status === 'failed' && (
          <>
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">{t('paymentMethod.paymentFailed')}</h1>
            <p className="text-gray-400 mb-6">{t('paymentMethod.paymentFailedMessage')}</p>
            <button
              onClick={() => router.push('/courses')}
              className="w-full px-4 py-3 bg-navy-800 text-gray-300 rounded-lg hover:bg-navy-700 font-semibold"
            >
              {t('paymentMethod.tryAgain')}
            </button>
          </>
        )}
        {status === 'timeout' && (
          <>
            <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">{t('paymentMethod.processingDelayed')}</h1>
            <p className="text-gray-400 mb-6">{t('paymentMethod.checkLater')}</p>
            <button
              onClick={() => router.push('/my-courses')}
              className="w-full px-4 py-3 bg-navy-800 text-gray-300 rounded-lg hover:bg-navy-700 font-semibold"
            >
              {t('paymentMethod.goToCourses')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
