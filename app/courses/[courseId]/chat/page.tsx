'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import LayoutContainer from '@/components/chat/LayoutContainer';
import ChatNavigation from '@/components/chat/ChatNavigation';
import ExpiredEnrollmentOverlay from '@/components/ExpiredEnrollmentOverlay';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { useEnrollments } from '@/hooks/useEnrollments';
import { useActiveChannel } from '@/hooks/useActiveChannel';
import { useActiveServer } from '@/hooks/useActiveServer';
import { normalizeProfileUsername } from '@/lib/username';
import type { Server, Channel } from '@/types/server';
import type { Member } from '@/types/member';
import type { Message as MessageType } from '@/types/message';

export default function CourseChatPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params?.courseId as string;
  const { user, role: userRole, isLoading: userLoading } = useUser();
  const { enrolledCourseIds, isEnrollmentActive, getEnrollmentInfo, isLoading: enrollmentsLoading, mutate: mutateEnrollments } = useEnrollments(user?.id || null);
  const [activeServerId, setActiveServerId] = useActiveServer();
  const [activeChannelId, setActiveChannelId] = useActiveChannel();
  const [course, setCourse] = useState<any>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingCourse, setIsLoadingCourse] = useState(true);
  const [hasAutoSelectedChannel, setHasAutoSelectedChannel] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login');
    }
  }, [user, userLoading, router]);

  // Redirect lecturers to their chat page (but allow admins)
  useEffect(() => {
    if (!userLoading && userRole === 'lecturer') {
      router.push('/lecturer/chat');
    }
  }, [userRole, userLoading, router]);

  const loadCourseAndChannels = useCallback(async () => {
    if (!courseId || !user) return;
    try {
      setIsLoadingCourse(true);
      setError(null);

      // Admins can access all courses without enrollment
      // Regular users must be enrolled
      if (userRole !== 'admin' && !enrolledCourseIds.has(courseId)) {
        setError('You are not enrolled in this course.');
        setIsLoadingCourse(false);
        return;
      }

      // Fetch course details first (required for dependent queries)
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (courseError) throw courseError;
      if (!courseData) {
        setError('Course not found.');
        setIsLoadingCourse(false);
        return;
      }

      setCourse(courseData);

      // OPTIMIZATION: Fetch channels, lecturer courses, and members enrollment data in parallel
      const [channelsResult, lecturerCoursesResult, enrollmentsResult] = await Promise.all([
        // Fetch channels for this course
        supabase
          .from('channels')
          .select('*')
          .eq('course_id', courseId)
          .order('display_order', { ascending: true })
          .then(({ data, error }) => {
            if (error) {
              if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
                console.warn('Channels table does not exist yet. Using default channels.');
                return [];
              }
              console.warn('Error fetching channels:', error);
              return [];
            }
            return data || [];
          })
          .catch((err) => {
            console.warn('Channels query failed (table may not exist):', err);
            return [];
          }),

        // Fetch all courses from the same lecturer (if lecturer_id exists)
        courseData.lecturer_id
          ? supabase
              .from('courses')
              .select('*')
              .eq('lecturer_id', courseData.lecturer_id)
              .order('created_at', { ascending: false })
              .then(({ data }) => data || [courseData])
              .catch(() => [courseData])
          : Promise.resolve([courseData]),

        // Fetch enrolled students for members list
        supabase
          .from('enrollments')
          .select('user_id')
          .eq('course_id', courseId)
          .then(({ data, error }) => {
            if (error) return [];
            return data || [];
          })
          .catch(() => []),
      ]);

      let channelsData = channelsResult;
      const allLecturerCourses = lecturerCoursesResult;
      const enrollments = enrollmentsResult;

      // Ensure required channels exist in database (depends on channelsData)
      const hasLectures = channelsData.some((ch: any) => ch.name.toLowerCase() === 'lectures' && ch.type === 'lectures');
      const hasProjects = channelsData.some((ch: any) => ch.name.toLowerCase() === 'projects');

      const channelsToCreate: any[] = [];
      if (!hasLectures) {
        channelsToCreate.push({
          course_id: courseId,
          name: 'lectures',
          type: 'lectures',
          description: `Video lectures for ${courseData.title}`,
          category_name: 'COURSE CHANNELS',
          display_order: 0,
        });
      }
      if (!hasProjects) {
        channelsToCreate.push({
          course_id: courseId,
          name: 'projects',
          type: 'text',
          description: `Project submissions and discussions for ${courseData.title}`,
          category_name: 'COURSE CHANNELS',
          display_order: 1,
        });
      }

      // OPTIMIZATION: Create channels and fetch all lecturer course channels in parallel
      const [newChannelsResult, allChannelsResult, profilesResult] = await Promise.all([
        // Create missing channels if needed
        channelsToCreate.length > 0
          ? supabase
              .from('channels')
              .insert(channelsToCreate)
              .select()
              .then(({ data, error }) => {
                if (error) {
                  console.warn('Error creating required channels:', error);
                  return [];
                }
                return data || [];
              })
              .catch((err) => {
                console.warn('Error creating required channels:', err);
                return [];
              })
          : Promise.resolve([]),

        // Fetch channels for all lecturer courses
        supabase
          .from('channels')
          .select('*')
          .in('course_id', allLecturerCourses.map((c: any) => c.id))
          .order('display_order', { ascending: true })
          .then(({ data }) => data || [])
          .catch(() => []),

        // Fetch member profiles (from enrollments data we already have)
        (() => {
          if (enrollments.length === 0 && !courseData.lecturer_id) {
            return Promise.resolve([]);
          }
          const userIds = [...new Set(enrollments.map((e: any) => e.user_id))];
          if (courseData.lecturer_id) {
            userIds.push(courseData.lecturer_id);
          }
          if (userIds.length === 0) {
            return Promise.resolve([]);
          }
          return supabase
            .from('profiles')
            .select('id, username, email, role')
            .in('id', userIds)
            .then(({ data }) => data || [])
            .catch(() => []);
        })(),
      ]);

      // Add newly created channels to channelsData
      if (newChannelsResult.length > 0) {
        channelsData = [...channelsData, ...newChannelsResult];
      }

      const allChannelsData = allChannelsResult;
      const profiles = profilesResult;

      // Transform all courses into servers
      const serversData: Server[] = allLecturerCourses.map((course: any) => {
        const courseChannels = allChannelsData.filter((ch: any) => ch.course_id === course.id);

        const channelsByCategory: { [key: string]: Channel[] } = {};
        courseChannels.forEach((ch: any) => {
          const category = ch.category_name || 'COURSE CHANNELS';
          if (!channelsByCategory[category]) {
            channelsByCategory[category] = [];
          }
          channelsByCategory[category].push({
            id: ch.id,
            name: ch.name,
            type: ch.type as 'text' | 'voice' | 'lectures',
            description: ch.description || undefined,
            courseId: course.id,
            categoryName: ch.category_name || undefined,
            displayOrder: ch.display_order || 0,
            messages: [],
          });
        });

        // Sort channels: lectures first, then projects, then by displayOrder
        Object.keys(channelsByCategory).forEach((cat) => {
          channelsByCategory[cat].sort((a, b) => {
            if (a.type === 'lectures' && b.type !== 'lectures') return -1;
            if (b.type === 'lectures' && a.type !== 'lectures') return 1;
            if (a.name.toLowerCase() === 'projects' && b.name.toLowerCase() !== 'projects') return -1;
            if (b.name.toLowerCase() === 'projects' && a.name.toLowerCase() !== 'projects') return 1;
            return (a.displayOrder || 0) - (b.displayOrder || 0);
          });
        });

        return {
          id: course.id,
          name: course.title,
          icon: course.title.charAt(0).toUpperCase(),
          channels: Object.entries(channelsByCategory).map(([categoryName, channels]) => ({
            id: `category-${course.id}-${categoryName}`,
            name: categoryName,
            channels,
          })),
        };
      });

      setServers(serversData);

      // Set active server to this course
      setActiveServerId(courseId);

      // Set members from profiles data
      const membersData: Member[] = profiles.map((profile: any) => {
        const username = normalizeProfileUsername(profile);
        return {
          id: profile.id,
          username,
          avatarUrl: '',
          status: 'online' as const,
          role: profile.role || 'student',
        };
      });
      setMembers(membersData);

      setIsLoadingCourse(false);
    } catch (err: any) {
      console.error('Error loading course chat:', err);
      setError(err.message || 'Failed to load course chat. Please try again.');
      setIsLoadingCourse(false);
    }
  }, [courseId, user, enrolledCourseIds]);

  // Check enrollment and fetch course
  useEffect(() => {
    if (courseId && user && !userLoading && !enrollmentsLoading) {
      loadCourseAndChannels();
    }
  }, [courseId, user, userLoading, enrollmentsLoading, loadCourseAndChannels]);

  // Reset auto-select flag when courseId changes
  useEffect(() => {
    setHasAutoSelectedChannel(false);
  }, [courseId]);

  // Auto-select lectures channel when servers are loaded
  useEffect(() => {
    if (servers.length > 0 && !hasAutoSelectedChannel && courseId) {
      // Find the lectures channel
      const server = servers[0];
      const allChannels = server.channels.flatMap(cat => cat.channels);
      const lecturesChannel = allChannels.find(
        ch => ch.type === 'lectures' && ch.name.toLowerCase() === 'lectures'
      );
      
      // Only auto-select if no channel is currently selected, or if the selected channel is not from this course
      const currentChannel = allChannels.find(ch => ch.id === activeChannelId);
      if (lecturesChannel && (!activeChannelId || !currentChannel)) {
        setActiveChannelId(lecturesChannel.id);
        setHasAutoSelectedChannel(true);
      } else if (activeChannelId && currentChannel) {
        // Channel is already selected for this course, mark as done
        setHasAutoSelectedChannel(true);
      }
    }
  }, [servers, activeChannelId, courseId, hasAutoSelectedChannel, setActiveChannelId]);

  const handleSendMessage = async (channelId: string, content: string) => {
    // Message sending is now handled by ChatArea component via API
    // This callback is kept for compatibility but doesn't need to do anything
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    // TODO: Save reaction to database
    console.log('Adding reaction:', { messageId, emoji, userId: user.id });
  };

  const loading = userLoading || isLoadingCourse || enrollmentsLoading;

  if (loading) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-navy-950">
        <ChatNavigation />
        <div className="flex-1 min-h-0 flex items-center justify-center bg-navy-950">
          <div className="text-center text-gray-400">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mb-4"></div>
            <p>Loading course chat...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-navy-950">
        <ChatNavigation />
        <div className="flex-1 min-h-0 flex items-center justify-center bg-navy-950">
          <div className="text-center text-gray-400">
            <p>Please log in to access chat</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-navy-950">
        <ChatNavigation />
        <div className="flex-1 min-h-0 flex items-center justify-center bg-navy-950">
          <div className="text-center text-gray-400 max-w-md">
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-6 py-4 rounded-lg mb-4">
              <p className="font-semibold mb-2">Error loading course chat</p>
              <p className="text-sm">{error}</p>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setError(null);
                  loadCourseAndChannels();
                }}
                className="bg-emerald-500 text-white px-6 py-2 rounded-lg hover:bg-emerald-600 transition-colors"
              >
                Try Again
              </button>
              <Link
                href="/my-courses"
                className="bg-navy-800 text-white px-6 py-2 rounded-lg hover:bg-navy-700 transition-colors"
              >
                Back to My Courses
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check if enrollment is expired (admins bypass this)
  const enrollmentInfo = getEnrollmentInfo(courseId);
  const isEnrolled = enrolledCourseIds.has(courseId);
  const isExpired = isEnrolled && !isEnrollmentActive(courseId);
  const showExpirationOverlay = isExpired && userRole !== 'admin';

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-navy-950/20 backdrop-blur-[0.5px]">
      <ChatNavigation />
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {servers.length === 0 ? (
          <div className="flex-1 min-h-0 flex items-center justify-center bg-navy-950/20 backdrop-blur-[0.5px]">
            <div className="text-center text-gray-400 max-w-md">
              <svg
                className="w-16 h-16 mx-auto mb-4 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              <p className="text-lg font-medium mb-2">Course not found</p>
              <p className="text-sm mb-6">Unable to load course chat</p>
              <Link
                href="/my-courses"
                className="inline-block bg-indigo-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Back to My Courses
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className={showExpirationOverlay ? 'filter blur-sm pointer-events-none' : ''}>
              <LayoutContainer
                servers={servers}
                currentUserId={user.id}
                initialMembers={members}
                isLecturer={false}
                enrolledCourseIds={enrolledCourseIds}
                onSendMessage={handleSendMessage}
                onReaction={handleReaction}
                showDMButton={false}
                isEnrollmentExpired={showExpirationOverlay}
                enrollmentInfo={enrollmentInfo}
                onReEnrollRequest={mutateEnrollments}
              />
            </div>
            {showExpirationOverlay && (
              <ExpiredEnrollmentOverlay
                courseId={courseId}
                courseName={course?.title || 'Course'}
                expiresAt={enrollmentInfo?.expiresAt || null}
                onReEnrollRequest={mutateEnrollments}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
