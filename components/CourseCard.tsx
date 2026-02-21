'use client';

import { useState, memo, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PaymentDialog from './PaymentDialog';
import { useI18n } from '@/contexts/I18nContext';
import { useUser } from '@/hooks/useUser';
import { formatPriceInGel } from '@/lib/currency';

export interface Course {
  id: string;
  title: string;
  description?: string | null;
  course_type: 'Editing' | 'Content Creation' | 'Website Creation';
  price: number;
  original_price?: number | null;
  author: string;
  creator: string;
  intro_video_url?: string | null;
  thumbnail_url?: string | null;
  rating: number;
  review_count: number;
  is_bestseller: boolean;
}

interface CourseCardProps {
  course: Course;
  isEnrolled?: boolean;
  isEnrolling?: boolean;
  onEnroll?: (courseId: string) => void;
  showEnrollButton?: boolean;
  customAction?: React.ReactNode;
  daysRemaining?: number | null;
  isExpired?: boolean;
}

function CourseCard({
  course,
  isEnrolled = false,
  isEnrolling = false,
  onEnroll,
  showEnrollButton = true,
  customAction,
  daysRemaining = null,
  isExpired = false,
}: CourseCardProps) {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useUser();
  const [isVideoExpanded, setIsVideoExpanded] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  // Ensure prices are never displayed as negative - fallback to 0 for any edge cases
  const safePrice = useMemo(() => Math.max(0, course.price || 0), [course.price]);
  const safeOriginalPrice = useMemo(() =>
    course.original_price ? Math.max(0, course.original_price) : null,
    [course.original_price]
  );

  const formattedPrice = useMemo(() => formatPriceInGel(safePrice), [safePrice]);
  const formattedOriginalPrice = useMemo(() =>
    safeOriginalPrice ? formatPriceInGel(safeOriginalPrice) : null,
    [safeOriginalPrice]
  );

  const handleThumbnailClick = useCallback(() => {
    if (course.intro_video_url) {
      setIsVideoExpanded(true);
    }
  }, [course.intro_video_url]);

  const handleCloseVideo = useCallback(() => {
    setIsVideoExpanded(false);
  }, []);

  // Close modal on ESC key press
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVideoExpanded) {
        handleCloseVideo();
      }
    };

    if (isVideoExpanded) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isVideoExpanded, handleCloseVideo]);

  const handleEnrollClick = useCallback(() => {
    // Check if user is authenticated before opening payment dialog
    if (!user) {
      const redirectUrl = `/courses?pendingEnroll=course:${course.id}`;
      window.location.href = `/signup?redirect=${encodeURIComponent(redirectUrl)}`;
      return;
    }
    if (onEnroll && !isEnrolled && !isEnrolling) {
      setShowPaymentDialog(true);
    }
  }, [user, onEnroll, isEnrolled, isEnrolling, router, course.id]);

  const handlePaymentDialogClose = useCallback(() => {
    setShowPaymentDialog(false);
  }, []);

  const handlePaymentSubmit = useCallback((courseId: string) => {
    if (onEnroll) {
      onEnroll(courseId);
    }
    setShowPaymentDialog(false);
  }, [onEnroll]);

  // Get course type styling and icon
  const getCourseTypeConfig = useCallback((courseType: string) => {
    switch (courseType) {
      case 'Editing':
        return {
          bgColor: 'bg-purple-100 dark:bg-purple-500/20',
          textColor: 'text-purple-700 dark:text-purple-300',
          borderColor: 'border-purple-200 dark:border-purple-500/40',
          icon: (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          ),
        };
      case 'Content Creation':
        return {
          bgColor: 'bg-cyan-100 dark:bg-cyan-500/20',
          textColor: 'text-cyan-700 dark:text-cyan-300',
          borderColor: 'border-cyan-200 dark:border-cyan-500/40',
          icon: (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          ),
        };
      case 'Website Creation':
        return {
          bgColor: 'bg-amber-100 dark:bg-amber-500/20',
          textColor: 'text-amber-700 dark:text-amber-300',
          borderColor: 'border-amber-200 dark:border-amber-500/40',
          icon: (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          ),
        };
      default:
        return {
          bgColor: 'bg-charcoal-100 dark:bg-navy-700',
          textColor: 'text-charcoal-700 dark:text-gray-300',
          borderColor: 'border-charcoal-200 dark:border-navy-600',
          icon: null,
        };
    }
  }, []);

  const courseTypeConfig = useMemo(() => getCourseTypeConfig(course.course_type), [course.course_type, getCourseTypeConfig]);

  return (
    <>
      <div className="h-full flex flex-col bg-gradient-to-br from-white to-gray-50 dark:from-navy-800 dark:to-navy-900 rounded-3xl overflow-hidden shadow-soft hover:shadow-xl hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/20 transition-all duration-300 border border-charcoal-100/50 dark:border-navy-700/50 hover:scale-[1.02] hover:-translate-y-1 will-change-transform" style={{ transformOrigin: 'center', backfaceVisibility: 'hidden' }}>
        {/* Thumbnail Section */}
        <div className="relative w-full h-32 bg-gradient-to-br from-emerald-50 via-white to-charcoal-50/30 dark:from-emerald-500/10 dark:via-navy-800 dark:to-navy-700/30 overflow-hidden cursor-pointer group">
          {course.thumbnail_url ? (
            // Display actual thumbnail image
            <>
              <img
                src={course.thumbnail_url}
                alt={course.title}
                className="w-full h-full object-cover"
                onClick={handleThumbnailClick}
              />
              {/* Overlay with play button */}
              {course.intro_video_url && (
                <div 
                  className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center"
                  onClick={handleThumbnailClick}
                >
                  <div className="w-12 h-12 bg-white/90 dark:bg-navy-800/90 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg
                      className="w-6 h-6 text-charcoal-950 dark:text-emerald-400 ml-1"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              )}
            </>
          ) : (
            // Fallback gradient placeholder
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-full h-full bg-gradient-to-br from-emerald-50/60 via-white/80 to-charcoal-50/40 backdrop-blur-sm">
                {/* Subtle decorative pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-2 left-2 w-16 h-16 border border-white/30 rounded-full blur-sm"></div>
                  <div className="absolute bottom-2 right-2 w-12 h-12 border border-white/30 rounded-full blur-sm"></div>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 border border-white/30 rounded-full blur-sm"></div>
                </div>
                
                {/* Play button overlay */}
                {course.intro_video_url && (
                  <button
                    onClick={handleThumbnailClick}
                    className="absolute inset-0 flex items-center justify-center bg-charcoal-950/5 hover:bg-charcoal-950/10 transition-colors z-10"
                    aria-label={t('courses.playIntroVideo')}
                  >
                    <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-soft">
                      <svg
                        className="w-5 h-5 text-charcoal-950 ml-0.5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}
          
          {/* Creator badge - Smaller, semi-transparent */}
          <div className="absolute bottom-2 left-2 bg-white/80 dark:bg-navy-800/80 backdrop-blur-sm px-2 py-1 rounded-full flex items-center space-x-1.5 border border-charcoal-100/50 dark:border-navy-700/50 z-20 shadow-soft">
            <svg
              className="w-3 h-3 text-charcoal-600 dark:text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <span className="text-charcoal-600 dark:text-gray-300 text-[10px] font-medium">{course.creator}</span>
          </div>

          {/* Course Type Badge - Top right, prominent */}
          <div className={`absolute top-2 right-2 ${courseTypeConfig.bgColor} backdrop-blur-sm px-2.5 py-1.5 rounded-lg flex items-center space-x-1.5 border ${courseTypeConfig.borderColor} z-20 shadow-md`}>
            <span className={`${courseTypeConfig.textColor}`}>
              {courseTypeConfig.icon}
            </span>
            <span className={`${courseTypeConfig.textColor} text-xs font-semibold`}>{course.course_type}</span>
          </div>

          {/* Days Remaining Badge - Top left */}
          {isEnrolled && daysRemaining !== null && (
            <div className={`absolute top-2 left-2 backdrop-blur-sm px-2.5 py-1.5 rounded-lg z-20 shadow-md text-xs font-semibold ${
              isExpired
                ? 'bg-red-100/90 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/40'
                : daysRemaining <= 7
                  ? 'bg-amber-100/90 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40'
                  : 'bg-emerald-100/90 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40'
            }`}>
              {isExpired ? t('enrollment.expired') : t('enrollment.daysLeft', { days: daysRemaining })}
            </div>
          )}
        </div>

        {/* Course Info Section - Tighter spacing */}
        <div className="flex-1 flex flex-col p-5">
          <div className="flex-1 space-y-3">
            {/* Title */}
            <h3 className="text-base font-semibold text-charcoal-950 dark:text-white line-clamp-2 leading-snug">
              {course.title}
            </h3>

            {/* Author */}
            <p className="text-sm text-charcoal-500 dark:text-gray-400">{course.author}</p>

            {/* Badges: Course Type (prominent), Bestseller, Rating, Reviews */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Course Type Badge - Prominent with color and icon */}
              <span className={`${courseTypeConfig.bgColor} ${courseTypeConfig.textColor} border ${courseTypeConfig.borderColor} text-xs font-semibold px-2.5 py-1 rounded-md flex items-center space-x-1.5`}>
                {courseTypeConfig.icon}
                <span>{course.course_type}</span>
              </span>

              {course.is_bestseller && (
                <span className="bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-medium px-2 py-0.5 rounded-md">
                  {t('courseCard.bestseller')}
                </span>
              )}
              {course.rating > 0 && (
                <span className="bg-white dark:bg-navy-700 border border-charcoal-100 dark:border-navy-600 text-charcoal-600 dark:text-gray-300 text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center space-x-1">
                  <svg
                    className="w-2.5 h-2.5 text-emerald-500 dark:text-emerald-400 fill-current"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                  </svg>
                  <span>{course.rating.toFixed(1)}</span>
                </span>
              )}
              {course.review_count > 0 && (
                <span className="bg-white dark:bg-navy-700 border border-charcoal-100 dark:border-navy-600 text-charcoal-600 dark:text-gray-300 text-[10px] font-medium px-2 py-0.5 rounded-md">
                  {course.review_count.toLocaleString()} {course.review_count === 1 ? t('courseCard.rating') : t('courseCard.ratings')}
                </span>
              )}
            </div>

            {/* Price */}
            <div className="flex items-center space-x-2 pt-1">
              <span className="text-xl font-semibold text-charcoal-950 dark:text-white">
                {formattedPrice}
              </span>
              {formattedOriginalPrice && safeOriginalPrice && safeOriginalPrice > safePrice && (
                <span className="text-sm text-charcoal-400 dark:text-gray-500 line-through">
                  {formattedOriginalPrice}
                </span>
              )}
            </div>
          </div>

          {/* Enroll Button or Custom Action - Always at bottom */}
          {(showEnrollButton || customAction) && (
            <div className="mt-auto pt-3 border-t border-charcoal-100/50 dark:border-navy-700/50">
            {customAction ? (
              customAction
            ) : isEnrolled ? (
              <a
                href={`/courses/${course.id}/chat`}
                className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-emerald-500 rounded-full hover:bg-emerald-600 transition-all duration-200 hover:shadow-soft hover:-translate-y-0.5 will-change-transform"
                style={{ transformOrigin: 'center', backfaceVisibility: 'hidden' }}
              >
                <svg
                  className="w-3.5 h-3.5 mr-1.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {t('courses.goToCourse')}
              </a>
            ) : (
              <button
                onClick={handleEnrollClick}
                disabled={isEnrolling || !onEnroll}
                className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-charcoal-950 dark:bg-emerald-500 rounded-full hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-all duration-200 hover:shadow-soft dark:hover:shadow-glow-dark hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 will-change-transform"
                style={{ transformOrigin: 'center', backfaceVisibility: 'hidden' }}
              >
                {isEnrolling ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    {t('courses.enrolling')}
                  </>
                ) : (
                  <>
                    <svg
                      className="w-3.5 h-3.5 mr-1.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    {t('courses.enrollNow')}
                  </>
                )}
              </button>
            )}
            </div>
          )}
        </div>
      </div>

      {/* Expanded Video Modal */}
      {isVideoExpanded && course.intro_video_url && (
        <div 
          className="fixed inset-0 bg-charcoal-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            // Close modal when clicking outside
            if (e.target === e.currentTarget) {
              handleCloseVideo();
            }
          }}
        >
          <div 
            className="relative w-full max-w-4xl bg-charcoal-950 rounded-3xl overflow-hidden shadow-soft-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleCloseVideo}
              className="absolute top-4 right-4 z-10 w-9 h-9 bg-charcoal-800/80 hover:bg-charcoal-700 rounded-full flex items-center justify-center text-white transition-all duration-200 backdrop-blur-sm"
              aria-label={t('courses.closeVideo')}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            
            {/* Video player */}
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <video
                src={course.intro_video_url}
                controls
                autoPlay
                preload="metadata"
                playsInline
                className="absolute inset-0 w-full h-full"
                onEnded={handleCloseVideo}
              />
            </div>
            
            {/* Video info */}
            <div className="p-5 bg-charcoal-900/95 backdrop-blur-sm">
              <h3 className="text-white font-medium text-lg mb-1">{course.title}</h3>
              <p className="text-charcoal-400 text-sm">{course.creator}</p>
            </div>
          </div>
        </div>
      )}

      {/* Payment Dialog */}
      <PaymentDialog
        course={course}
        isOpen={showPaymentDialog}
        onClose={handlePaymentDialogClose}
        onEnroll={handlePaymentSubmit}
      />
    </>
  );
}

export default memo(CourseCard);

