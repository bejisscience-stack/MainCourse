'use client';

import { useState, memo, useCallback, useMemo, useEffect } from 'react';

export interface Course {
  id: string;
  title: string;
  description?: string;
  course_type: 'Editing' | 'Content Creation' | 'Website Creation';
  price: number;
  original_price?: number;
  author: string;
  creator: string;
  intro_video_url?: string;
  thumbnail_url?: string;
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
}

function CourseCard({ 
  course, 
  isEnrolled = false, 
  isEnrolling = false,
  onEnroll,
  showEnrollButton = true,
  customAction
}: CourseCardProps) {
  const [isVideoExpanded, setIsVideoExpanded] = useState(false);

  const formatPrice = useMemo(() => {
    return (price: number) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(price);
  }, []);

  const formattedPrice = useMemo(() => formatPrice(course.price), [formatPrice, course.price]);
  const formattedOriginalPrice = useMemo(() => 
    course.original_price ? formatPrice(course.original_price) : null, 
    [formatPrice, course.original_price]
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
    if (onEnroll && !isEnrolled && !isEnrolling) {
      onEnroll(course.id);
    }
  }, [onEnroll, isEnrolled, isEnrolling, course.id]);

  return (
    <>
      <div className="bg-white rounded-2xl overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.08)] transition-all duration-300 border border-gray-100 hover:scale-[1.005]">
        {/* Thumbnail Section */}
        <div className="relative w-full h-28 bg-gradient-to-br from-blue-100 via-purple-50 to-cyan-50 overflow-hidden cursor-pointer group">
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
                  <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg
                      className="w-6 h-6 text-navy-700 ml-1"
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
              <div className="relative w-full h-full bg-gradient-to-br from-blue-100/80 via-purple-50/80 to-cyan-50/80 backdrop-blur-sm">
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
                    className="absolute inset-0 flex items-center justify-center bg-black/10 hover:bg-black/20 transition-colors z-10"
                    aria-label="Play intro video"
                  >
                    <div className="w-10 h-10 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-sm">
                      <svg
                        className="w-5 h-5 text-navy-700 ml-0.5"
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
          <div className="absolute bottom-2 left-2 bg-white/70 backdrop-blur-sm px-2 py-1 rounded-full flex items-center space-x-1.5 border border-white/50 z-20">
            <svg
              className="w-3 h-3 text-navy-700"
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
            <span className="text-navy-700 text-[10px] font-medium">{course.creator}</span>
          </div>
        </div>

        {/* Course Info Section - Tighter spacing */}
        <div className="p-4 space-y-2">
        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 leading-tight">
          {course.title}
        </h3>

        {/* Author */}
        <p className="text-sm text-gray-500">{course.author}</p>

        {/* Badges: Bestseller, Rating, Reviews */}
        <div className="flex flex-wrap items-center gap-1.5">
          {course.is_bestseller && (
            <span className="bg-teal-100 text-teal-700 text-[10px] font-semibold px-2 py-0.5 rounded">
              Bestseller
            </span>
          )}
          {course.rating > 0 && (
            <span className="bg-white border border-gray-200 text-gray-600 text-[10px] font-medium px-2 py-0.5 rounded flex items-center space-x-1">
              <svg
                className="w-2.5 h-2.5 text-yellow-500 fill-current"
                viewBox="0 0 20 20"
              >
                <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
              </svg>
              <span>{course.rating.toFixed(1)}</span>
            </span>
          )}
          {course.review_count > 0 && (
            <span className="bg-white border border-gray-200 text-gray-600 text-[10px] font-medium px-2 py-0.5 rounded">
              {course.review_count.toLocaleString()} {course.review_count === 1 ? 'rating' : 'ratings'}
            </span>
          )}
        </div>

        {/* Course Type */}
        <div>
          <span className="text-[10px] font-medium text-navy-700 bg-[#eef3ff] px-2 py-0.5 rounded">
            {course.course_type}
          </span>
        </div>

        {/* Price */}
        <div className="flex items-center space-x-2 pt-1">
          <span className="text-xl font-bold text-gray-900">
            {formattedPrice}
          </span>
          {formattedOriginalPrice && course.original_price && course.original_price > course.price && (
            <span className="text-sm text-gray-400 line-through">
              {formattedOriginalPrice}
            </span>
          )}
        </div>

        {/* Enroll Button or Custom Action */}
        {(showEnrollButton || customAction) && (
          <div className="pt-2 border-t border-gray-100">
            {customAction ? (
              customAction
            ) : isEnrolled ? (
              <a
                href={`/courses/${course.id}`}
                className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-green-500 rounded-full hover:bg-green-600 transition-colors"
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
                Enrolled - View Course
              </a>
            ) : (
              <button
                onClick={handleEnrollClick}
                disabled={isEnrolling || !onEnroll}
                className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-navy-900 rounded-full hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    Enrolling...
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
                    Enroll Now
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
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={handleCloseVideo}
        >
          <div 
            className="relative w-full max-w-4xl bg-black rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleCloseVideo}
              className="absolute top-4 right-4 z-10 w-8 h-8 bg-black/70 hover:bg-black/90 rounded-full flex items-center justify-center text-white transition-colors"
              aria-label="Close video"
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
            <div className="p-4 bg-black/90">
              <h3 className="text-white font-semibold text-lg mb-1">{course.title}</h3>
              <p className="text-gray-400 text-sm">{course.creator}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default memo(CourseCard);

