'use client';

import { useMemo } from 'react';
import EnrollmentModal from '@/components/EnrollmentModal';
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
  const { t } = useI18n();

  // Find the bundle from the bundles array
  const bundle = useMemo(() => {
    return bundles.find(b => b.id === bundleId);
  }, [bundles, bundleId]);

  // Create bundleAsCourse object for EnrollmentModal
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

  // Don't render if bundle not found
  if (!bundle || !bundleAsCourse) {
    return null;
  }

  return (
    <EnrollmentModal
      course={bundleAsCourse}
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={() => {
        onClose();
        toast.success(t('bundles.enrollmentRequestSubmitted') || 'Bundle enrollment request submitted!', { duration: 5000 });
      }}
      enrollmentMode="bundle"
    />
  );
}
