'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/contexts/I18nContext';
import { useUser } from '@/hooks/useUser';
import { useEnrollments } from '@/hooks/useEnrollments';
import { supabase } from '@/lib/supabase';
import EnrollmentWizard from './EnrollmentWizard';
import type { ActiveProject } from '@/hooks/useActiveProjects';
import type { Course } from './CourseCard';

// Platform configuration with icons and colors
const platformConfig: Record<string, { icon: React.ReactNode; bgColor: string; textColor: string; label: string }> = {
  youtube: {
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
    bgColor: 'bg-red-500/10 dark:bg-red-500/20',
    textColor: 'text-red-600 dark:text-red-400',
    label: 'YouTube',
  },
  instagram: {
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
    bgColor: 'bg-pink-500/10 dark:bg-pink-500/20',
    textColor: 'text-pink-600 dark:text-pink-400',
    label: 'Instagram',
  },
  facebook: {
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    bgColor: 'bg-blue-500/10 dark:bg-blue-500/20',
    textColor: 'text-blue-600 dark:text-blue-400',
    label: 'Facebook',
  },
  tiktok: {
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
    bgColor: 'bg-slate-500/10 dark:bg-slate-500/20',
    textColor: 'text-slate-700 dark:text-slate-300',
    label: 'TikTok',
  },
};

interface ProjectDetailsModalProps {
  project: ActiveProject | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectDetailsModal({ project, isOpen, onClose }: ProjectDetailsModalProps) {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useUser();
  const { enrolledCourseIds } = useEnrollments(user?.id || null);
  const [mounted, setMounted] = useState(false);
  const [showEnrollmentWizard, setShowEnrollmentWizard] = useState(false);
  const [courseData, setCourseData] = useState<Course | null>(null);
  const [isLoadingCourse, setIsLoadingCourse] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Check if user is enrolled in the course
  const isEnrolled = useMemo(() => {
    if (!project) return false;
    return enrolledCourseIds.has(project.course_id);
  }, [project, enrolledCourseIds]);

  // Format budget as currency
  const formattedBudget = useMemo(() => {
    if (!project) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(project.budget);
  }, [project?.budget]);

  // Format view range
  const formattedViewRange = useMemo(() => {
    if (!project) return '';
    const formatViews = (num: number) => {
      if (num >= 1000000) {
        return `${(num / 1000000).toFixed(1)}M`;
      }
      if (num >= 1000) {
        return `${Math.floor(num / 1000)}K`;
      }
      return num.toLocaleString();
    };
    return `${formatViews(project.min_views)} - ${formatViews(project.max_views)}`;
  }, [project?.min_views, project?.max_views]);

  // Format dates
  const formattedStartDate = useMemo(() => {
    if (!project?.start_date) return '';
    return new Date(project.start_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [project?.start_date]);

  const formattedEndDate = useMemo(() => {
    if (!project?.end_date) return '';
    return new Date(project.end_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [project?.end_date]);

  // Calculate days remaining
  const daysRemaining = useMemo(() => {
    if (!project?.end_date) return null;
    const end = new Date(project.end_date);
    const today = new Date();
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, [project?.end_date]);

  // Get lecturer display name
  const lecturerName = project?.lecturer_full_name || project?.lecturer_username || t('activeProjects.unknownLecturer');

  // Group criteria by platform
  const criteriaByPlatform = useMemo(() => {
    if (!project?.criteria) return new Map<string | null, ActiveProject['criteria']>();

    const grouped = new Map<string | null, ActiveProject['criteria']>();
    project.criteria.forEach((c) => {
      const platform = c.platform;
      if (!grouped.has(platform)) {
        grouped.set(platform, []);
      }
      grouped.get(platform)!.push(c);
    });
    return grouped;
  }, [project?.criteria]);

  // Calculate total potential RPM
  const totalPotentialRPM = useMemo(() => {
    if (!project?.criteria) return 0;
    return project.criteria.reduce((sum, c) => sum + c.rpm, 0);
  }, [project?.criteria]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !showEnrollmentWizard) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, showEnrollmentWizard, onClose]);

  // Handle Go to Project navigation
  const handleGoToProject = useCallback(() => {
    if (!project) return;
    router.push(`/courses/${project.course_id}/chat`);
    onClose();
  }, [project, router, onClose]);

  // Fetch course data and open enrollment wizard
  const handleEnrollClick = useCallback(async () => {
    if (!user) {
      router.push('/login?redirect=/');
      return;
    }

    if (!project) return;

    setIsLoadingCourse(true);

    try {
      // Fetch the course data
      const { data: course, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', project.course_id)
        .single();

      if (error) throw error;

      if (course) {
        setCourseData({
          id: course.id,
          title: course.title,
          description: course.description,
          course_type: course.course_type,
          price: course.price,
          original_price: course.original_price,
          author: course.author,
          creator: course.creator,
          intro_video_url: course.intro_video_url,
          thumbnail_url: course.thumbnail_url,
          rating: course.rating || 0,
          review_count: course.review_count || 0,
          is_bestseller: course.is_bestseller || false,
        });
        setShowEnrollmentWizard(true);
      }
    } catch (err) {
      console.error('Error fetching course:', err);
    } finally {
      setIsLoadingCourse(false);
    }
  }, [user, project, router]);

  // Handle enrollment wizard close
  const handleEnrollmentWizardClose = useCallback(() => {
    setShowEnrollmentWizard(false);
    setCourseData(null);
  }, []);

  // Handle enrollment submission
  const handleEnrollmentSubmit = useCallback(async (courseId: string, screenshotUrls: string[], referralCode?: string) => {
    if (!user?.id) {
      alert(t('enrollment.pleaseLogin'));
      return;
    }

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Not authenticated. Please log in again.');
      }

      const response = await fetch('/api/enrollment-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          courseId,
          paymentScreenshots: screenshotUrls,
          referralCode: referralCode || undefined
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || 'Failed to create enrollment request');
      }

      setShowEnrollmentWizard(false);
      setCourseData(null);
      alert(t('enrollment.enrollmentRequestSubmitted'));
      window.location.reload();
    } catch (err: any) {
      console.error('Error requesting enrollment:', err);
      alert(err.message || 'Failed to create enrollment request. Please try again.');
    }
  }, [user?.id, t]);

  if (!isOpen || !project) return null;

  const modalContent = (
    <div
      className="fixed inset-0 bg-charcoal-950/95 backdrop-blur-md z-[9998] flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !showEnrollmentWizard) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-3xl my-8 bg-white dark:bg-navy-900 rounded-3xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-10 h-10 bg-white/90 dark:bg-navy-800/90 hover:bg-white dark:hover:bg-navy-700 rounded-full flex items-center justify-center text-charcoal-600 dark:text-gray-300 transition-all duration-200 backdrop-blur-sm shadow-lg"
          aria-label={t('common.close')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Hero Header */}
        <div className="relative h-48 md:h-56 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 overflow-hidden">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 right-0 w-60 h-60 bg-white rounded-full translate-x-1/4 translate-y-1/4"></div>
          </div>

          {/* Content */}
          <div className="relative h-full flex flex-col justify-end p-6 md:p-8">
            {/* Budget Badge */}
            <div className="absolute top-4 left-4 md:top-6 md:left-8">
              <div className="bg-white/20 backdrop-blur-md rounded-2xl px-4 py-2 border border-white/30">
                <div className="text-white/80 text-xs font-medium uppercase tracking-wide">{t('activeProjects.budget')}</div>
                <div className="text-white text-2xl md:text-3xl font-bold">{formattedBudget}</div>
              </div>
            </div>

            {/* Days Remaining Badge */}
            {daysRemaining !== null && (
              <div className="absolute top-16 right-4 md:top-6 md:right-20">
                <div className="bg-white/20 backdrop-blur-md rounded-full px-4 py-2 border border-white/30">
                  <span className="text-white font-semibold">{daysRemaining}</span>
                  <span className="text-white/80 text-sm ml-1">{t('activeProjects.daysLeft') || 'days left'}</span>
                </div>
              </div>
            )}

            {/* Project Title */}
            <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight pr-12">
              {project.name}
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Course & Lecturer Info */}
          <div className="flex flex-wrap items-center gap-4 pb-4 border-b border-charcoal-100 dark:border-navy-700">
            <div className="flex items-center gap-2 text-charcoal-600 dark:text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="font-medium text-charcoal-800 dark:text-gray-200">{project.course_title}</span>
            </div>
            <div className="flex items-center gap-2 text-charcoal-600 dark:text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>{lecturerName}</span>
            </div>
          </div>

          {/* Description */}
          {project.description && (
            <div>
              <h3 className="text-sm font-semibold text-charcoal-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                {t('activeProjects.description')}
              </h3>
              <p className="text-charcoal-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {project.description}
              </p>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {/* View Range */}
            <div className="bg-charcoal-50 dark:bg-navy-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-charcoal-500 dark:text-gray-400 mb-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span className="text-xs font-medium uppercase">{t('activeProjects.viewRange')}</span>
              </div>
              <div className="text-lg font-bold text-charcoal-900 dark:text-white">{formattedViewRange}</div>
            </div>

            {/* Duration */}
            <div className="bg-charcoal-50 dark:bg-navy-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-charcoal-500 dark:text-gray-400 mb-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs font-medium uppercase">{t('activeProjects.duration')}</span>
              </div>
              <div className="text-sm font-semibold text-charcoal-900 dark:text-white">
                {formattedStartDate} - {formattedEndDate}
              </div>
            </div>

            {/* Potential RPM */}
            {totalPotentialRPM > 0 && (
              <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs font-medium uppercase">{t('activeProjects.potentialRPM') || 'Potential RPM'}</span>
                </div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">${totalPotentialRPM.toFixed(2)}</div>
              </div>
            )}
          </div>

          {/* Platforms */}
          <div>
            <h3 className="text-sm font-semibold text-charcoal-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              {t('activeProjects.platforms')}
            </h3>
            <div className="flex flex-wrap gap-2">
              {project.platforms.map((platform) => {
                const config = platformConfig[platform.toLowerCase()] || {
                  icon: <span className="w-4 h-4 flex items-center justify-center">•</span>,
                  bgColor: 'bg-gray-100 dark:bg-gray-700',
                  textColor: 'text-gray-600 dark:text-gray-300',
                  label: platform,
                };
                return (
                  <span
                    key={platform}
                    className={`${config.bgColor} ${config.textColor} text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 border border-current/10`}
                  >
                    {config.icon}
                    <span>{config.label}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Criteria */}
          {project.criteria && project.criteria.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-charcoal-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                {t('activeProjects.criteria')}
              </h3>
              <div className="space-y-4">
                {Array.from(criteriaByPlatform.entries()).map(([platform, criteria]) => (
                  <div key={platform || 'all'}>
                    <div className="text-xs font-medium text-charcoal-400 dark:text-gray-500 uppercase tracking-wide mb-2">
                      {platform ? (platformConfig[platform.toLowerCase()]?.label || platform) : t('activeProjects.allPlatforms')}
                    </div>
                    <div className="space-y-2">
                      {criteria.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between bg-charcoal-50 dark:bg-navy-800 rounded-xl px-4 py-3 group hover:bg-charcoal-100 dark:hover:bg-navy-700 transition-colors"
                        >
                          <span className="text-sm text-charcoal-700 dark:text-gray-300 flex-1">
                            {c.criteria_text}
                          </span>
                          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 ml-4 whitespace-nowrap bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-lg">
                            ${c.rpm.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reference Video */}
          {project.video_link && (
            <div>
              <h3 className="text-sm font-semibold text-charcoal-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                {t('activeProjects.referenceVideo')}
              </h3>
              <a
                href={project.video_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {t('activeProjects.viewVideo')}
              </a>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="sticky bottom-0 p-6 md:p-8 pt-4 bg-gradient-to-t from-white via-white dark:from-navy-900 dark:via-navy-900 border-t border-charcoal-100 dark:border-navy-700">
          {isEnrolled ? (
            <button
              onClick={handleGoToProject}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 text-base font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl hover:from-emerald-600 hover:to-teal-700 transition-all duration-200 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              {t('activeProjects.goToProject')}
            </button>
          ) : (
            <button
              onClick={handleEnrollClick}
              disabled={isLoadingCourse}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 text-base font-semibold text-white bg-gradient-to-r from-charcoal-800 to-charcoal-900 dark:from-emerald-500 dark:to-teal-600 rounded-2xl hover:from-charcoal-700 hover:to-charcoal-800 dark:hover:from-emerald-600 dark:hover:to-teal-700 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {isLoadingCourse ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t('common.loading')}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('activeProjects.enrollInCourse')}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Enrollment Wizard */}
      {courseData && (
        <EnrollmentWizard
          course={courseData}
          isOpen={showEnrollmentWizard}
          onClose={handleEnrollmentWizardClose}
          onEnroll={handleEnrollmentSubmit}
        />
      )}
    </div>
  );

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(modalContent, document.body);
}
