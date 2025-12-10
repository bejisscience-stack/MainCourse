'use client';

import { useState, memo, useCallback, useMemo } from 'react';

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
}

function CourseCard({ 
  course, 
  isEnrolled = false, 
  isEnrolling = false,
  onEnroll,
  showEnrollButton = true 
}: CourseCardProps) {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

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
      setIsVideoPlaying(true);
    }
  }, [course.intro_video_url]);

  const handleEnrollClick = useCallback(() => {
    if (onEnroll && !isEnrolled && !isEnrolling) {
      onEnroll(course.id);
    }
  }, [onEnroll, isEnrolled, isEnrolling, course.id]);

  return (
    <div className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 border border-gray-100">
      {/* Thumbnail/Video Section */}
      <div className="relative w-full h-48 bg-gradient-to-br from-blue-600 via-purple-600 to-cyan-500 overflow-hidden">
        {isVideoPlaying && course.intro_video_url ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <video
              src={course.intro_video_url}
              controls
              autoPlay
              preload="metadata"
              playsInline
              className="w-full h-full object-cover"
              onEnded={() => setIsVideoPlaying(false)}
            />
          </div>
        ) : (
          <>
            {/* Placeholder thumbnail with play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-full h-full bg-gradient-to-br from-blue-700 via-purple-700 to-cyan-600">
                {/* Decorative pattern */}
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-4 left-4 w-32 h-32 border-2 border-white rounded-full"></div>
                  <div className="absolute bottom-4 right-4 w-24 h-24 border-2 border-white rounded-full"></div>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 border-2 border-white rounded-full"></div>
                </div>
                
                {/* Play button overlay */}
                {course.intro_video_url && (
                  <button
                    onClick={handleThumbnailClick}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors z-10"
                    aria-label="Play intro video"
                  >
                    <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors">
                      <svg
                        className="w-8 h-8 text-navy-900 ml-1"
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
            
            {/* Creator badge */}
            <div className="absolute bottom-3 left-3 bg-blue-900/80 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center space-x-2">
              <svg
                className="w-4 h-4 text-white"
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
              <span className="text-white text-xs font-medium">{course.creator}</span>
            </div>
          </>
        )}
      </div>

      {/* Course Info Section */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <h3 className="text-lg font-bold text-gray-900 line-clamp-2 min-h-[3.5rem]">
          {course.title}
        </h3>

        {/* Author */}
        <p className="text-sm text-gray-600">{course.author}</p>

        {/* Badges: Bestseller, Rating, Reviews */}
        <div className="flex flex-wrap items-center gap-2">
          {course.is_bestseller && (
            <span className="bg-teal-500 text-white text-xs font-semibold px-2.5 py-1 rounded">
              Bestseller
            </span>
          )}
          {course.rating > 0 && (
            <span className="bg-white border border-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded flex items-center space-x-1">
              <svg
                className="w-3 h-3 text-yellow-500 fill-current"
                viewBox="0 0 20 20"
              >
                <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
              </svg>
              <span>{course.rating.toFixed(1)}</span>
            </span>
          )}
          {course.review_count > 0 && (
            <span className="bg-white border border-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded">
              {course.review_count.toLocaleString()} {course.review_count === 1 ? 'rating' : 'ratings'}
            </span>
          )}
        </div>

        {/* Course Type */}
        <div className="pt-2">
          <span className="text-xs font-medium text-navy-700 bg-navy-50 px-2.5 py-1 rounded">
            {course.course_type}
          </span>
        </div>

        {/* Price */}
        <div className="flex items-center space-x-2 pt-1">
          <span className="text-xl font-bold text-gray-900">
            {formattedPrice}
          </span>
          {formattedOriginalPrice && course.original_price && course.original_price > course.price && (
            <span className="text-sm text-gray-500 line-through">
              {formattedOriginalPrice}
            </span>
          )}
        </div>

        {/* Enroll Button */}
        {showEnrollButton && (
          <div className="pt-3 border-t border-gray-100">
            {isEnrolled ? (
              <a
                href={`/courses/${course.id}`}
                className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
              >
                <svg
                  className="w-4 h-4 mr-2"
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
                className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEnrolling ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                      className="w-4 h-4 mr-2"
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
  );
}

export default memo(CourseCard);

