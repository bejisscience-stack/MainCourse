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

  const handlePaymentSubmit = useCallback(async (bundleId: string, screenshotUrls: string[], referralCode?: string) => {
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
          paymentScreenshots: screenshotUrls,
          referralCode: referralCode || undefined
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
      <main className="relative min-h-screen bg-gradient-to-b from-[#fafafa] to-white dark:from-navy-950 dark:to-navy-900 overflow-hidden">
        {/* Base gradient layer */}
        <div className="fixed inset-0 bg-gradient-to-b from-[#fafafa] via-white to-[#fafafa] dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 pointer-events-none"></div>
        
        {/* Subtle radial gradients for depth */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[800px] h-[800px] blur-3xl bg-gradient-radial from-emerald-500/3 via-emerald-500/1 to-transparent dark:from-emerald-400/4 dark:via-emerald-400/2 dark:to-transparent"></div>
          <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] blur-3xl bg-gradient-radial from-charcoal-200/2 via-transparent to-transparent dark:from-navy-400/2 dark:via-transparent dark:to-transparent"></div>
        </div>
        
        <BackgroundShapes />
        <Navigation />
        <div className="relative z-10 pt-24 pb-16 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-charcoal-950 dark:border-emerald-500"></div>
            <p className="mt-4 text-charcoal-600 dark:text-gray-400">{t('bundles.loadingBundle')}</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !bundle) {
    return (
      <main className="relative min-h-screen bg-gradient-to-b from-[#fafafa] to-white dark:from-navy-950 dark:to-navy-900 overflow-hidden">
        {/* Base gradient layer */}
        <div className="fixed inset-0 bg-gradient-to-b from-[#fafafa] via-white to-[#fafafa] dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 pointer-events-none"></div>
        
        {/* Subtle radial gradients for depth */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[800px] h-[800px] blur-3xl bg-gradient-radial from-emerald-500/3 via-emerald-500/1 to-transparent dark:from-emerald-400/4 dark:via-emerald-400/2 dark:to-transparent"></div>
          <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] blur-3xl bg-gradient-radial from-charcoal-200/2 via-transparent to-transparent dark:from-navy-400/2 dark:via-transparent dark:to-transparent"></div>
        </div>
        
        <BackgroundShapes />
        <Navigation />
        <div className="relative z-10 pt-24 pb-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-6 py-4 rounded-lg">
              <p className="font-semibold">{t('common.error')}</p>
              <p className="mt-1">{error || t('bundles.bundleNotFound')}</p>
              <button
                onClick={() => router.push('/courses')}
                className="mt-4 bg-charcoal-950 dark:bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-colors"
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
    <main className="relative min-h-screen bg-gradient-to-b from-[#fafafa] to-white dark:from-navy-950 dark:to-navy-900 overflow-hidden">
      {/* Base gradient layer */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#fafafa] via-white to-[#fafafa] dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 pointer-events-none"></div>
      
      {/* Subtle radial gradients for depth */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] blur-3xl bg-gradient-radial from-emerald-500/3 via-emerald-500/1 to-transparent dark:from-emerald-400/4 dark:via-emerald-400/2 dark:to-transparent"></div>
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] blur-3xl bg-gradient-radial from-charcoal-200/2 via-transparent to-transparent dark:from-navy-400/2 dark:via-transparent dark:to-transparent"></div>
      </div>
      
      <BackgroundShapes />
      <Navigation />
      <div className="relative z-10 pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => router.push('/courses')}
            className="mb-6 text-charcoal-600 dark:text-gray-400 hover:text-charcoal-950 dark:hover:text-white flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('bundles.backToCourses')}
          </button>

          <div className="bg-white dark:bg-navy-800 border-2 border-emerald-200 dark:border-emerald-700/50 rounded-lg p-8 shadow-lg">
            <div className="mb-6">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide bg-emerald-50 dark:bg-emerald-500/20 px-3 py-1 rounded inline-block mb-3">
                {t('bundles.courseBundle')}
              </span>
              <h1 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white mb-4">{bundle.title}</h1>
              {bundle.description && (
                <p className="text-lg text-charcoal-600 dark:text-gray-400">{bundle.description}</p>
              )}
            </div>

            <div className="mb-8">
              <h2 className="text-xl font-semibold text-charcoal-950 dark:text-white mb-4">{t('bundles.bundleIncludes')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bundleCourses.map((course: any, idx: number) => (
                  <div key={idx} className="border border-charcoal-200 dark:border-navy-700 rounded-lg p-4 bg-white dark:bg-navy-700/50">
                    <div className="flex items-start gap-3">
                      {course.thumbnail_url && (
                        <img
                          src={course.thumbnail_url}
                          alt={course.title}
                          className="w-20 h-20 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-1">{course.course_type}</p>
                        <h3 className="font-bold text-charcoal-950 dark:text-white mb-1">{course.title}</h3>
                        {course.description && (
                          <p className="text-sm text-charcoal-600 dark:text-gray-400 line-clamp-2">{course.description}</p>
                        )}
                        <p className="text-sm font-semibold text-charcoal-700 dark:text-gray-300 mt-2">${course.price.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-500/20 rounded-lg p-6 mb-6 border border-emerald-200 dark:border-emerald-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-charcoal-600 dark:text-gray-400 mb-1">{t('bundles.bundlePrice')}</p>
                  <p className="text-3xl font-bold text-charcoal-950 dark:text-white">${bundle.price.toFixed(2)}</p>
                  {totalOriginalPrice > bundle.price && (
                    <p className="text-sm text-charcoal-400 dark:text-gray-500 line-through mt-1">
                      ${totalOriginalPrice.toFixed(2)} {t('bundles.ifPurchasedSeparately')}
                    </p>
                  )}
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-2 font-semibold">
                    {t('bundles.saveAmount', { amount: (totalOriginalPrice - bundle.price).toFixed(2) })}
                  </p>
                </div>
              </div>
            </div>

            {isEnrolled ? (
              <a
                href="/my-courses"
                className="w-full inline-flex items-center justify-center px-6 py-3 text-lg font-semibold text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {t('bundles.viewMyCourses')}
              </a>
            ) : (
              <button
                onClick={() => setShowPaymentDialog(true)}
                className="w-full inline-flex items-center justify-center px-6 py-3 text-lg font-semibold text-white bg-emerald-500 dark:bg-emerald-500 rounded-lg hover:bg-emerald-600 dark:hover:bg-emerald-600 transition-colors"
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
        onEnroll={(courseId, screenshots, referralCode) => handlePaymentSubmit(courseId, screenshots, referralCode)}
      />
    </main>
  );
}


