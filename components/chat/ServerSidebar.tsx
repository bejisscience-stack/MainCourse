'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/contexts/I18nContext';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { useEnrollments } from '@/hooks/useEnrollments';
import PaymentDialog from '@/components/PaymentDialog';
import type { Server } from '@/types/server';
import type { Course } from '@/components/CourseCard';

interface ServerSidebarProps {
  servers: Server[];
  activeServerId: string | null;
  onServerSelect: (serverId: string) => void;
  onAddCourse?: () => void;
  isLecturer?: boolean;
  enrolledCourseIds?: Set<string>;
  showDMButton?: boolean;
}

export default function ServerSidebar({
  servers,
  activeServerId,
  onServerSelect,
  onAddCourse,
  isLecturer = false,
  enrolledCourseIds = new Set(),
  showDMButton = true,
}: ServerSidebarProps) {
  const [hoveredServerId, setHoveredServerId] = useState<string | null>(null);
  const [enrollmentModal, setEnrollmentModal] = useState<{ courseId: string; courseName: string } | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [courseForPayment, setCourseForPayment] = useState<Course | null>(null);
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useUser();
  const { mutate: mutateEnrollments } = useEnrollments(user?.id || null);

  // Fetch course details when enrollment modal is shown
  useEffect(() => {
    if (enrollmentModal) {
      const fetchCourse = async () => {
        try {
          const { data, error } = await supabase
            .from('courses')
            .select('*')
            .eq('id', enrollmentModal.courseId)
            .single();

          if (error) throw error;

          if (data) {
            const course: Course = {
              id: data.id,
              title: data.title,
              description: data.description,
              course_type: data.course_type as 'Editing' | 'Content Creation' | 'Website Creation',
              price: data.price,
              original_price: data.original_price,
              author: data.author || '',
              creator: data.creator || '',
              intro_video_url: data.intro_video_url,
              thumbnail_url: data.thumbnail_url,
              rating: data.rating || 0,
              review_count: data.review_count || 0,
              is_bestseller: data.is_bestseller || false,
            };
            setCourseForPayment(course);
          }
        } catch (err) {
          console.error('Error fetching course:', err);
          setEnrollmentModal(null);
        }
      };

      fetchCourse();
    } else {
      setCourseForPayment(null);
    }
  }, [enrollmentModal]);

  const handleServerClick = (serverId: string) => {
    const isEnrolled = enrolledCourseIds.has(serverId);
    
    if (!isEnrolled && !isLecturer) {
      // Show enrollment modal for unenrolled courses
      const server = servers.find(s => s.id === serverId);
      if (server) {
        setEnrollmentModal({ courseId: serverId, courseName: server.name });
      }
      return;
    }
    
    // Allow navigation for enrolled courses or lecturers
    onServerSelect(serverId);
  };

  const handleEnroll = async (courseId: string) => {
    if (!user) return;
    
    // Prevent duplicate enrollment attempts
    if (enrolledCourseIds.has(courseId)) {
      setEnrollmentModal(null);
      setCourseForPayment(null);
      onServerSelect(courseId);
      router.push(`/courses/${courseId}/chat`);
      return;
    }
    
    setIsEnrolling(true);
    try {
      // Perform the actual enrollment with verification
      const { data: insertedData, error } = await supabase
        .from('enrollments')
        .insert([{ user_id: user.id, course_id: courseId }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          // Already enrolled, just refresh
          await mutateEnrollments();
          setEnrollmentModal(null);
          setCourseForPayment(null);
          onServerSelect(courseId);
          router.push(`/courses/${courseId}/chat`);
          return;
        }
        throw error;
      }

      // Verify we got exactly one enrollment back for the correct course
      if (insertedData && insertedData.course_id === courseId) {
        // Refresh enrollments and navigate
        await mutateEnrollments();
        setEnrollmentModal(null);
        setCourseForPayment(null);
        onServerSelect(courseId);
        router.push(`/courses/${courseId}/chat`);
      } else {
        throw new Error('Enrollment verification failed');
      }
    } catch (err: any) {
      console.error('Enrollment error:', err);
      alert(err.message || 'Failed to enroll in course. Please try again.');
      // Revalidate to get correct state
      await mutateEnrollments();
    } finally {
      setIsEnrolling(false);
    }
  };

  const handlePaymentDialogClose = () => {
    setEnrollmentModal(null);
    setCourseForPayment(null);
  };

  return (
    <>
      <div className="w-16 bg-navy-950/85 border-r border-navy-800/60 flex flex-col items-center py-4 gap-3 overflow-y-auto chat-scrollbar">
        {/* Home/Direct Messages button */}
        {showDMButton && (
          <>
            <button
              className={`w-12 h-12 rounded-2xl bg-emerald-500/90 hover:bg-emerald-500 transition-all duration-200 flex items-center justify-center text-white font-semibold text-sm shadow-soft ${
                activeServerId === 'home' ? 'ring-2 ring-emerald-400/50 shadow-glow' : ''
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70`}
              onClick={() => onServerSelect('home')}
              onMouseEnter={() => setHoveredServerId('home')}
              onMouseLeave={() => setHoveredServerId(null)}
            >
              <span>DM</span>
            </button>
            <div className="w-8 h-px bg-navy-800/70"></div>
          </>
        )}

        {/* Server list - only show for students, not lecturers */}
        {!isLecturer && servers.map((server) => {
          const isActive = activeServerId === server.id;
          const isHovered = hoveredServerId === server.id;
          const isEnrolled = enrolledCourseIds.has(server.id);
          const isLocked = !isEnrolled;

          return (
            <div key={server.id} className="relative group">
              <button
                className={`w-12 h-12 rounded-xl transition-all duration-200 flex items-center justify-center text-sm font-semibold relative border ${
                  isActive
                    ? 'rounded-2xl bg-emerald-500/15 text-emerald-200 border-emerald-500/40 shadow-soft-lg'
                    : isLocked
                    ? 'bg-navy-900/40 text-gray-500 border-navy-800/50'
                    : 'bg-navy-900/70 text-gray-200 border-navy-800/60 hover:bg-navy-800/80 hover:border-navy-700/70 hover:text-white'
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50`}
                onClick={() => handleServerClick(server.id)}
                onMouseEnter={() => setHoveredServerId(server.id)}
                onMouseLeave={() => setHoveredServerId(null)}
                disabled={isLocked && isEnrolling}
                aria-label={isLocked ? t('enrollment.courseLockedTooltip') : server.name}
                title={isLocked ? t('enrollment.courseLockedTooltip') : server.name}
              >
                {isLocked ? (
                  <svg
                    className="w-6 h-6 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                ) : (
                  server.icon || server.name.charAt(0).toUpperCase()
                )}
              </button>

              {/* Tooltip for locked courses */}
              {isLocked && isHovered && (
                <div
                  className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-navy-900/95 border border-navy-700/60 text-gray-200 text-sm rounded-lg whitespace-nowrap z-50 pointer-events-none shadow-xl"
                  role="tooltip"
                >
                  <span>{t('enrollment.courseLockedTooltip')}</span>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-navy-900/95"></div>
                </div>
              )}

              {/* Tooltip for enrolled courses */}
              {!isLocked && isHovered && (
                <div
                  className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-navy-900/95 border border-navy-700/60 text-gray-200 text-sm rounded-lg whitespace-nowrap z-50 pointer-events-none shadow-xl"
                  role="tooltip"
                >
                  {server.name}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-navy-900/95"></div>
                </div>
              )}

              {/* Active indicator */}
              {isActive && (
                <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-10 bg-emerald-400 rounded-full"></div>
              )}
            </div>
          );
        })}

        {/* Add Course button (lecturer only) */}
        {isLecturer && (
          <button
            className="w-12 h-12 rounded-xl bg-navy-900/70 border border-navy-800/60 hover:border-emerald-500/50 hover:bg-emerald-500/15 transition-all duration-200 flex items-center justify-center text-emerald-300 hover:text-emerald-200 text-2xl font-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50"
            title={t('lecturerDashboard.createCourse')}
            onClick={() => router.push('/lecturer/dashboard?createCourse=true')}
          >
            +
          </button>
        )}
      </div>

      {/* Payment Dialog */}
      {courseForPayment && (
        <PaymentDialog
          course={courseForPayment}
          isOpen={!!courseForPayment}
          onClose={handlePaymentDialogClose}
          onEnroll={handleEnroll}
        />
      )}
    </>
  );
}
