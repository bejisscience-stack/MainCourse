'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Navigation from '@/components/Navigation';
import BackgroundShapes from '@/components/BackgroundShapes';
import PaymentDialog from '@/components/PaymentDialog';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { useI18n } from '@/contexts/I18nContext';

export default function BundleEnrollmentPage() {
  const router = useRouter();
  const params = useParams();
  const bundleId = params.bundleId as string;
  const { user, isLoading: userLoading } = useUser();
  const { t } = useI18n();
  const [bundle, setBundle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);

  useEffect(() => {
    if (bundleId) {
      fetchBundle();
      if (user?.id) {
        checkEnrollment();
      }
    }
  }, [bundleId, user?.id]);

  const fetchBundle = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('course_bundles')
        .select(`
          *,
          course_bundle_items (
            course_id,
            courses (
              id,
              title,
              description,
              price,
              thumbnail_url,
              course_type
            )
          )
        `)
        .eq('id', bundleId)
        .eq('is_active', true)
        .single();

      if (fetchError) throw fetchError;
      if (!data) {
        setError(t('bundles.bundleNotFound'));
        return;
      }
      setBundle(data);
    } catch (err: any) {
      console.error('Error fetching bundle:', err);
      setError(err.message || t('bundles.failedToLoadBundle'));
    } finally {
      setLoading(false);
    }
  };

  const checkEnrollment = async () => {
    if (!user?.id) return;
    try {
      const { data, error: checkError } = await supabase
        .from('bundle_enrollments')
        .select('id')
        .eq('user_id', user.id)
        .eq('bundle_id', bundleId)
        .maybeSingle();

      if (checkError) throw checkError;
      setIsEnrolled(!!data);
    } catch (err: any) {
      console.error('Error checking enrollment:', err);
    }
  };

  const handlePaymentSubmit = useCallback(async (bundleId: string, screenshotUrls: string[]) => {
    if (!user?.id) {
      alert(t('bundles.pleaseLogIn'));
      return;
    }

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        console.error('Session error:', sessionError);
        throw new Error('Not authenticated. Please log in again.');
      }

      const response = await fetch('/api/bundle-enrollment-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          bundleId,
          paymentScreenshots: screenshotUrls 
        }),
      });

      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse response:', jsonError);
        throw new Error('Server returned an invalid response. Please try again.');
      }

      if (!response.ok) {
        const errorMessage = result?.error || result?.details || `Server error (${response.status})`;
        console.error('API error:', {
          status: response.status,
          statusText: response.statusText,
          error: result,
        });
        throw new Error(errorMessage);
      }

      setShowPaymentDialog(false);
      alert(t('bundles.enrollmentRequestSubmitted'));
      router.push('/courses');
    } catch (err: any) {
      console.error('Error requesting bundle enrollment:', err);
      const errorMessage = err.message || t('bundles.failedToCreateRequest');
      alert(errorMessage);
    }
  }, [user, router]);

  if (userLoading || loading) {
    return (
      <main className="relative min-h-screen bg-white overflow-hidden">
        <BackgroundShapes />
        <Navigation />
        <div className="relative z-10 pt-24 pb-16 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-navy-900"></div>
            <p className="mt-4 text-navy-600">{t('bundles.loadingBundle')}</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !bundle) {
    return (
      <main className="relative min-h-screen bg-white overflow-hidden">
        <BackgroundShapes />
        <Navigation />
        <div className="relative z-10 pt-24 pb-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
              <p className="font-semibold">{t('common.error')}</p>
              <p className="mt-1">{error || t('bundles.bundleNotFound')}</p>
              <button
                onClick={() => router.push('/courses')}
                className="mt-4 bg-navy-900 text-white px-4 py-2 rounded-lg hover:bg-navy-800 transition-colors"
              >
                {t('bundles.backToCourses')}
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const bundleCourses = bundle.course_bundle_items?.map((item: any) => item.courses).filter(Boolean) || [];
  const totalOriginalPrice = bundleCourses.reduce((sum: number, course: any) => sum + (course?.price || 0), 0);

  // Create a mock course object for PaymentDialog
  const bundleAsCourse = {
    id: bundle.id,
    title: bundle.title,
    description: bundle.description || t('bundles.bundleIncludesCount', { count: bundleCourses.length }),
    course_type: 'Bundle' as any,
    price: bundle.price,
    original_price: bundle.original_price || (totalOriginalPrice > bundle.price ? totalOriginalPrice : undefined),
    author: 'Bundle',
    creator: 'Bundle',
    intro_video_url: undefined,
    thumbnail_url: undefined,
    rating: 0,
    review_count: 0,
    is_bestseller: false,
  };

  return (
    <main className="relative min-h-screen bg-white overflow-hidden">
      <BackgroundShapes />
      <Navigation />
      <div className="relative z-10 pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => router.push('/courses')}
            className="mb-6 text-navy-600 hover:text-navy-900 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('bundles.backToCourses')}
          </button>

          <div className="bg-white border-2 border-purple-200 rounded-lg p-8 shadow-lg">
            <div className="mb-6">
              <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide bg-purple-50 px-3 py-1 rounded inline-block mb-3">
                {t('bundles.courseBundle')}
              </span>
              <h1 className="text-3xl md:text-4xl font-bold text-navy-900 mb-4">{bundle.title}</h1>
              {bundle.description && (
                <p className="text-lg text-navy-600">{bundle.description}</p>
              )}
            </div>

            <div className="mb-8">
              <h2 className="text-xl font-semibold text-navy-900 mb-4">{t('bundles.bundleIncludes')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bundleCourses.map((course: any, idx: number) => (
                  <div key={idx} className="border border-navy-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      {course.thumbnail_url && (
                        <img
                          src={course.thumbnail_url}
                          alt={course.title}
                          className="w-20 h-20 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-purple-600 mb-1">{course.course_type}</p>
                        <h3 className="font-bold text-navy-900 mb-1">{course.title}</h3>
                        {course.description && (
                          <p className="text-sm text-navy-600 line-clamp-2">{course.description}</p>
                        )}
                        <p className="text-sm font-semibold text-navy-700 mt-2">${course.price.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-navy-600 mb-1">{t('bundles.bundlePrice')}</p>
                  <p className="text-3xl font-bold text-navy-900">${bundle.price.toFixed(2)}</p>
                  {totalOriginalPrice > bundle.price && (
                    <p className="text-sm text-navy-400 line-through mt-1">
                      ${totalOriginalPrice.toFixed(2)} {t('bundles.ifPurchasedSeparately')}
                    </p>
                  )}
                  <p className="text-sm text-purple-700 mt-2 font-semibold">
                    {t('bundles.saveAmount', { amount: (totalOriginalPrice - bundle.price).toFixed(2) })}
                  </p>
                </div>
              </div>
            </div>

            {isEnrolled ? (
              <a
                href="/my-courses"
                className="w-full inline-flex items-center justify-center px-6 py-3 text-lg font-semibold text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {t('bundles.viewMyCourses')}
              </a>
            ) : (
              <button
                onClick={() => setShowPaymentDialog(true)}
                className="w-full inline-flex items-center justify-center px-6 py-3 text-lg font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('bundles.enrollInBundle')}
              </button>
            )}
          </div>
        </div>
      </div>

      <PaymentDialog
        course={bundleAsCourse}
        isOpen={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        onEnroll={(courseId, screenshots) => handlePaymentSubmit(courseId, screenshots)}
      />
    </main>
  );
}


