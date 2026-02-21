'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import EnrollmentWizard from '@/components/EnrollmentWizard';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { useI18n } from '@/contexts/I18nContext';
import { toast } from 'sonner';

interface BundleEnrollmentModalProps {
  bundleId: string;
  bundles: any[];
  isOpen: boolean;
  onClose: () => void;
}

export default function BundleEnrollmentModal({
  bundleId,
  bundles,
  isOpen,
  onClose,
}: BundleEnrollmentModalProps) {
  const router = useRouter();
  const { user } = useUser();
  const { t } = useI18n();

  // Find the bundle from the bundles array
  const bundle = useMemo(() => {
    return bundles.find(b => b.id === bundleId);
  }, [bundles, bundleId]);

  // Create bundleAsCourse object for EnrollmentWizard
  const bundleAsCourse = useMemo(() => {
    if (!bundle) return null;

    const bundleCourses = bundle.course_bundle_items?.map((item: any) => item.courses).filter(Boolean) || [];
    const totalOriginalPrice = bundleCourses.reduce((sum: number, course: any) => sum + (course?.price || 0), 0);

    return {
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
  }, [bundle, t]);

  const handlePaymentSubmit = useCallback(async (bundleId: string, screenshotUrls: string[], referralCode?: string) => {
    if (!user?.id) {
      toast.error(t('bundles.pleaseLogIn'));
      return;
    }

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
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
        throw new Error('Server returned an invalid response. Please try again.');
      }

      if (!response.ok) {
        const errorMessage = result?.error || result?.details || `Server error (${response.status})`;
        throw new Error(errorMessage);
      }

      onClose();
      toast.success(t('bundles.enrollmentRequestSubmitted') || 'Bundle enrollment request submitted! Waiting for approval.', { duration: 5000 });
    } catch (err: any) {
      const errorMessage = err.message || t('bundles.failedToCreateRequest');
      toast.error(errorMessage, { duration: 5000 });
    }
  }, [user, onClose, t]);

  // Don't render if bundle not found
  if (!bundle || !bundleAsCourse) {
    return null;
  }

  return (
    <EnrollmentWizard
      course={bundleAsCourse}
      isOpen={isOpen}
      onClose={onClose}
      onEnroll={(courseId, screenshots, referralCode) => handlePaymentSubmit(courseId, screenshots, referralCode)}
    />
  );
}
