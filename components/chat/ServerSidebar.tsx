'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { useEnrollments } from '@/hooks/useEnrollments';
import type { Server } from '@/types/server';

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
  const router = useRouter();
  const { user } = useUser();
  const { mutate: mutateEnrollments } = useEnrollments(user?.id || null);

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

  const handleEnroll = async () => {
    if (!enrollmentModal || !user) return;
    
    setIsEnrolling(true);
    try {
      const { error } = await supabase
        .from('enrollments')
        .insert([{ user_id: user.id, course_id: enrollmentModal.courseId }]);

      if (error) {
        if (error.code === '23505') {
          // Already enrolled, just refresh
          await mutateEnrollments();
          setEnrollmentModal(null);
          onServerSelect(enrollmentModal.courseId);
          router.push(`/courses/${enrollmentModal.courseId}/chat`);
          return;
        }
        throw error;
      }

      // Refresh enrollments and navigate
      await mutateEnrollments();
      setEnrollmentModal(null);
      onServerSelect(enrollmentModal.courseId);
      router.push(`/courses/${enrollmentModal.courseId}/chat`);
    } catch (err: any) {
      console.error('Enrollment error:', err);
      alert(err.message || 'Failed to enroll in course. Please try again.');
    } finally {
      setIsEnrolling(false);
    }
  };

  return (
    <>
      <div className="w-16 bg-gray-900 flex flex-col items-center py-3 space-y-2 overflow-y-auto">
        {/* Home/Direct Messages button */}
        {showDMButton && (
          <>
            <button
              className={`w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500 transition-all duration-200 flex items-center justify-center text-white font-bold text-lg ${
                activeServerId === 'home' ? 'rounded-2xl' : ''
              }`}
              onClick={() => onServerSelect('home')}
              onMouseEnter={() => setHoveredServerId('home')}
              onMouseLeave={() => setHoveredServerId(null)}
            >
              <span>DM</span>
            </button>
            <div className="w-8 h-0.5 bg-gray-700"></div>
          </>
        )}

        {/* Server list */}
        {servers.map((server) => {
          const isActive = activeServerId === server.id;
          const isHovered = hoveredServerId === server.id;
          const isEnrolled = enrolledCourseIds.has(server.id) || isLecturer;
          const isLocked = !isEnrolled;

          return (
            <div key={server.id} className="relative group">
              <button
                className={`w-12 h-12 rounded-full transition-all duration-200 flex items-center justify-center text-white font-semibold text-sm relative ${
                  isActive 
                    ? 'rounded-2xl bg-indigo-600' 
                    : isLocked
                    ? 'bg-gray-700/50 hover:bg-gray-700'
                    : 'bg-gray-700 hover:bg-indigo-600'
                }`}
                onClick={() => handleServerClick(server.id)}
                onMouseEnter={() => setHoveredServerId(server.id)}
                onMouseLeave={() => setHoveredServerId(null)}
                disabled={isLocked && isEnrolling}
              >
                {isLocked ? (
                  <svg
                    className="w-6 h-6 text-gray-400"
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

              {/* Lock icon overlay on hover for locked courses */}
              {isLocked && isHovered && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 text-white text-sm rounded whitespace-nowrap z-50 pointer-events-none">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>Click to enroll</span>
                  </div>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-900"></div>
                </div>
              )}

              {/* Tooltip for enrolled courses */}
              {!isLocked && isHovered && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 text-white text-sm rounded whitespace-nowrap z-50 pointer-events-none">
                  {server.name}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-900"></div>
                </div>
              )}

              {/* Active indicator */}
              {isActive && (
                <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r"></div>
              )}
            </div>
          );
        })}

        {/* Add Course button (lecturer only) */}
        {isLecturer && onAddCourse && (
          <button
            className="w-12 h-12 rounded-full bg-gray-700 hover:bg-green-600 transition-all duration-200 flex items-center justify-center text-green-500 hover:text-white text-2xl font-light"
            title="Create Course"
            onClick={onAddCourse}
          >
            +
          </button>
        )}
      </div>

      {/* Enrollment Modal */}
      {enrollmentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  🔒
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-bold text-xl mb-1">Enroll in Course</h3>
                  <p className="text-gray-400 text-sm">This course is locked</p>
                </div>
                <button
                  onClick={() => setEnrollmentModal(null)}
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-6">
                <p className="text-gray-300 mb-4">
                  Would you like to enroll in <span className="font-semibold text-white">{enrollmentModal.courseName}</span>?
                </p>
                <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-gray-400">
                      <p className="text-gray-300 font-medium mb-1">What you'll get:</p>
                      <ul className="space-y-1 text-gray-400">
                        <li>• Access to all course content</li>
                        <li>• Video lectures and materials</li>
                        <li>• Course discussions and projects</li>
                        <li>• Direct communication with instructor</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleEnroll}
                  disabled={isEnrolling}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold px-6 py-3 rounded-xl hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                >
                  {isEnrolling ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Enrolling...
                    </span>
                  ) : (
                    'Enroll Now'
                  )}
                </button>
                <button
                  onClick={() => setEnrollmentModal(null)}
                  disabled={isEnrolling}
                  className="px-6 py-3 bg-gray-700 text-gray-300 font-semibold rounded-xl hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
