'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import LayoutContainer from '@/components/chat/LayoutContainer';
import ChatNavigation from '@/components/chat/ChatNavigation';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { useEnrollments } from '@/hooks/useEnrollments';
import type { Server, Channel } from '@/types/server';
import type { Member } from '@/types/member';
import type { Message as MessageType } from '@/types/message';

export default function CourseChatPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params?.courseId as string;
  const { user, role: userRole, isLoading: userLoading } = useUser();
  const { enrolledCourseIds, isLoading: enrollmentsLoading } = useEnrollments(user?.id || null);
  const [course, setCourse] = useState<any>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingCourse, setIsLoadingCourse] = useState(true);

  // Redirect if not logged in
  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login');
    }
  }, [user, userLoading, router]);

  // Redirect lecturers to their chat page
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

      // Check if user is enrolled
      if (!enrolledCourseIds.has(courseId)) {
        setError('You are not enrolled in this course.');
        setIsLoadingCourse(false);
        return;
      }

      // Fetch course details
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

      // Fetch channels from database
      let channelsData: any[] = [];
      try {
        const { data: channels, error: channelsError } = await supabase
          .from('channels')
          .select('*')
          .eq('course_id', courseId)
          .order('display_order', { ascending: true });

        if (channelsError) {
          // If channels table doesn't exist or query fails, continue with empty channels
          if (channelsError.code === 'PGRST116' || channelsError.message?.includes('relation') || channelsError.message?.includes('does not exist')) {
            console.warn('Channels table does not exist yet. Using default channels.');
            channelsData = [];
          } else {
            console.warn('Error fetching channels:', channelsError);
            channelsData = [];
          }
        } else {
          channelsData = channels || [];
        }
      } catch (channelsErr: any) {
        // Channels table might not exist yet, continue with empty channels
        console.warn('Channels query failed (table may not exist):', channelsErr);
        channelsData = [];
      }

      // Ensure required channels exist in database
      const hasLectures = channelsData.some((ch) => ch.name.toLowerCase() === 'lectures' && ch.type === 'lectures');
      const hasProjects = channelsData.some((ch) => ch.name.toLowerCase() === 'projects');
      
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
      
      if (channelsToCreate.length > 0) {
        try {
          const { data: newChannels, error: createError } = await supabase
            .from('channels')
            .insert(channelsToCreate)
            .select();
          
          if (!createError && newChannels) {
            channelsData.push(...newChannels);
          }
        } catch (err) {
          console.warn('Error creating required channels:', err);
        }
      }

      // Transform course into server/channels structure
      const courseChannels = channelsData || [];
      
      // Group channels by category
      const channelsByCategory: { [key: string]: Channel[] } = {};
      courseChannels.forEach((ch) => {
        const category = ch.category_name || 'COURSE CHANNELS';
        if (!channelsByCategory[category]) {
          channelsByCategory[category] = [];
        }
        channelsByCategory[category].push({
          id: ch.id,
          name: ch.name,
          type: ch.type as 'text' | 'voice' | 'lectures',
          description: ch.description || undefined,
          courseId: courseData.id,
          categoryName: ch.category_name || undefined,
          displayOrder: ch.display_order || 0,
          messages: [],
        });
      });

      // Sort channels: lectures first, then projects, then by displayOrder
      Object.keys(channelsByCategory).forEach((cat) => {
        channelsByCategory[cat].sort((a, b) => {
          // Lectures always first
          if (a.type === 'lectures' && b.type !== 'lectures') return -1;
          if (b.type === 'lectures' && a.type !== 'lectures') return 1;
          // Projects second
          if (a.name.toLowerCase() === 'projects' && b.name.toLowerCase() !== 'projects') return -1;
          if (b.name.toLowerCase() === 'projects' && a.name.toLowerCase() !== 'projects') return 1;
          // Then by displayOrder
          return (a.displayOrder || 0) - (b.displayOrder || 0);
        });
      });

      const server: Server = {
        id: courseData.id,
        name: courseData.title,
        icon: courseData.title.charAt(0).toUpperCase(),
        channels: Object.entries(channelsByCategory).map(([categoryName, channels]) => ({
          id: `category-${courseData.id}-${categoryName}`,
          name: categoryName,
          channels,
        })),
      };

      setServers([server]);

      // Fetch members (enrolled students and lecturer)
      try {
        // Get enrolled students
        const { data: enrollments, error: enrollmentsError } = await supabase
          .from('enrollments')
          .select('user_id')
          .eq('course_id', courseId);

        if (!enrollmentsError && enrollments && enrollments.length > 0) {
          const userIds = [...new Set(enrollments.map((e) => e.user_id))];
          
          // Add lecturer ID
          if (courseData.lecturer_id) {
            userIds.push(courseData.lecturer_id);
          }

          if (userIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, full_name, email, role')
              .in('id', userIds);

            const membersData: Member[] =
              profiles?.map((profile) => ({
                id: profile.id,
                username: profile.full_name || profile.email?.split('@')[0] || 'User',
                avatarUrl: '',
                status: 'online' as const,
                role: profile.role || 'student',
              })) || [];

            setMembers(membersData);
          }
        }
      } catch (membersErr) {
        // Members loading is not critical, continue
        console.warn('Error loading members:', membersErr);
        setMembers([]);
      }

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

  const handleSendMessage = async (channelId: string, content: string) => {
    if (!user) return;

    // Extract course ID from channel ID (format: channel-{courseId}-{channelName})
    const courseIdMatch = channelId.match(/channel-(.+?)-/);
    if (!courseIdMatch) return;

    const courseId = courseIdMatch[1];

    // In a real implementation, you would save to database here
    // For now, we'll just log it
    console.log('Sending message:', { channelId, content, courseId, userId: user.id });

    // TODO: Save message to database
    // await supabase.from('messages').insert({
    //   channel_id: channelId,
    //   user_id: user.id,
    //   content,
    //   course_id: courseId,
    // });
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    // TODO: Save reaction to database
    console.log('Adding reaction:', { messageId, emoji, userId: user.id });
  };

  const loading = userLoading || isLoadingCourse || enrollmentsLoading;

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <ChatNavigation />
        <div className="flex-1 flex items-center justify-center bg-gray-900">
          <div className="text-center text-gray-400">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
            <p>Loading course chat...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col h-screen">
        <ChatNavigation />
        <div className="flex-1 flex items-center justify-center bg-gray-900">
          <div className="text-center text-gray-400">
            <p>Please log in to access chat</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen">
        <ChatNavigation />
        <div className="flex-1 flex items-center justify-center bg-gray-900">
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
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Try Again
              </button>
              <Link
                href="/my-courses"
                className="bg-gray-700 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Back to My Courses
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <ChatNavigation />
      <div className="flex-1 overflow-hidden">
        {servers.length === 0 ? (
          <div className="flex-1 flex items-center justify-center bg-gray-900">
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
          <LayoutContainer
            servers={servers}
            currentUserId={user.id}
            initialMembers={members}
            isLecturer={false}
            onSendMessage={handleSendMessage}
            onReaction={handleReaction}
          />
        )}
      </div>
    </div>
  );
}
