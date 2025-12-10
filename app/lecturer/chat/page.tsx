'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LayoutContainer from '@/components/chat/LayoutContainer';
import ChatNavigation from '@/components/chat/ChatNavigation';
import CourseCreationModal from '@/components/CourseCreationModal';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { useLecturerCourses } from '@/hooks/useLecturerCourses';
import type { Server, Channel } from '@/types/server';
import type { Member } from '@/types/member';
import type { Message as MessageType } from '@/types/message';
import type { User } from '@supabase/supabase-js';

export default function LecturerChatPage() {
  const router = useRouter();
  const { user, role: userRole, isLoading: userLoading } = useUser();
  const { courses, isLoading: coursesLoading, mutate: mutateCourses } = useLecturerCourses(user?.id || null);
  const [servers, setServers] = useState<Server[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCourseModal, setShowCourseModal] = useState(false);

  const handleAddCourse = useCallback(() => {
    setShowCourseModal(true);
  }, []);

  // Redirect if not lecturer or not logged in
  useEffect(() => {
    if (!userLoading) {
      if (!user) {
        router.push('/login');
      } else if (userRole !== 'lecturer') {
        router.push('/');
      }
    }
  }, [user, userRole, userLoading, router]);

  const loadChannelsAndMembers = useCallback(async () => {
    if (!user) return;
    
    try {
      setError(null);

      // Handle case when there are no courses
      if (!courses || courses.length === 0) {
        setServers([]);
        setMembers([]);
        return;
      }

      // Fetch channels from database (only if courses exist)
      let channelsData: any[] = [];
      const courseIds = courses.map((c) => c.id);
      if (courseIds.length > 0) {
        try {
          const { data: channels, error: channelsError } = await supabase
            .from('channels')
            .select('*')
            .in('course_id', courseIds)
            .order('display_order', { ascending: true });

          if (channelsError) {
            // If channels table doesn't exist (PGRST116) or query fails, continue with empty channels
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
      }

      // Ensure required channels exist in database for each course
      for (const course of courses) {
        const courseChannels = (channelsData || []).filter((ch) => ch.course_id === course.id);
        const hasLectures = courseChannels.some((ch) => ch.name.toLowerCase() === 'lectures' && ch.type === 'lectures');
        const hasProjects = courseChannels.some((ch) => ch.name.toLowerCase() === 'projects');
        
        // Create required channels in database if they don't exist
        const channelsToCreate: any[] = [];
        if (!hasLectures) {
          channelsToCreate.push({
            course_id: course.id,
            name: 'lectures',
            type: 'lectures',
            description: `Video lectures for ${course.title}`,
            category_name: 'COURSE CHANNELS',
            display_order: 0,
          });
        }
        if (!hasProjects) {
          channelsToCreate.push({
            course_id: course.id,
            name: 'projects',
            type: 'text',
            description: `Project submissions and discussions for ${course.title}`,
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
      }

      // Transform courses into servers/channels structure
      const serversData: Server[] = (courses || []).map((course) => {
        const courseChannels = (channelsData || []).filter((ch) => ch.course_id === course.id);

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
            courseId: course.id,
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

      // Fetch members (enrolled students)
      try {
        const courseIds = courses.map((c) => c.id);
        if (courseIds.length > 0) {
          const { data: enrollments, error: enrollmentsError } = await supabase
            .from('enrollments')
            .select('user_id, courses(id, title)')
            .in('course_id', courseIds);

          if (!enrollmentsError && enrollments && enrollments.length > 0) {
            const userIds = [...new Set(enrollments.map((e) => e.user_id))];
            if (userIds.length > 0) {
              const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .in('id', userIds);

              const membersData: Member[] =
                profiles?.map((profile) => ({
                  id: profile.id,
                  username: profile.full_name || profile.email?.split('@')[0] || 'User',
                  avatarUrl: '',
                  status: 'online' as const,
                })) || [];

              setMembers(membersData);
            }
          }
        }
      } catch (membersErr) {
        // Members loading is not critical, continue
        console.warn('Error loading members:', membersErr);
        setMembers([]);
      }
    } catch (err: any) {
      console.error('Error loading chat data:', err);
      setError(err.message || 'Failed to load chat. Please try again.');
    }
  }, [user, courses]);

  useEffect(() => {
    if (!coursesLoading && user) {
      loadChannelsAndMembers();
    }
  }, [coursesLoading, user, loadChannelsAndMembers]);

  const handleCourseCreated = useCallback(() => {
    mutateCourses();
    loadChannelsAndMembers();
    setShowCourseModal(false);
  }, [mutateCourses, loadChannelsAndMembers]);

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

  const handleChannelCreate = async (channel: Omit<Channel, 'id'>) => {
    if (!user || !channel.courseId) return;

    try {
      const { data, error } = await supabase
        .from('channels')
        .insert([
          {
            course_id: channel.courseId,
            name: channel.name,
            type: channel.type,
            description: channel.description || null,
            category_name: channel.categoryName || 'COURSE CHANNELS',
            display_order: channel.displayOrder || 0,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Refresh servers
      loadChannelsAndMembers();
    } catch (err: any) {
      console.error('Error creating channel:', err);
      throw err;
    }
  };

  const handleChannelUpdate = async (channelId: string, updates: Partial<Channel>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('channels')
        .update({
          name: updates.name,
          type: updates.type,
          description: updates.description || null,
          category_name: updates.categoryName,
          display_order: updates.displayOrder,
        })
        .eq('id', channelId);

      if (error) throw error;

      // Refresh servers
      loadChannelsAndMembers();
    } catch (err: any) {
      console.error('Error updating channel:', err);
      throw err;
    }
  };

  const handleChannelDelete = async (channelId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.from('channels').delete().eq('id', channelId);

      if (error) throw error;

      // Refresh servers
      loadChannelsAndMembers();
    } catch (err: any) {
      console.error('Error deleting channel:', err);
      throw err;
    }
  };

  const loading = userLoading || coursesLoading;

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <ChatNavigation />
        <div className="flex-1 flex items-center justify-center bg-gray-900">
          <div className="text-center text-gray-400">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
            <p>Loading chat...</p>
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
              <p className="font-semibold mb-2">Error loading chat</p>
              <p className="text-sm">{error}</p>
            </div>
            <button
              onClick={() => {
                setError(null);
                loadChannelsAndMembers();
              }}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <ChatNavigation />
      <CourseCreationModal
        isOpen={showCourseModal}
        onClose={() => setShowCourseModal(false)}
        onSuccess={handleCourseCreated}
        user={user}
      />
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
              <p className="text-lg font-medium mb-2">No courses yet</p>
              <p className="text-sm mb-6">Create your first course to start chatting with students</p>
              <Link
                href="/lecturer/dashboard"
                className="inline-block bg-indigo-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <LayoutContainer
            servers={servers}
            currentUserId={user.id}
            initialMembers={members}
            isLecturer={true}
            onAddCourse={handleAddCourse}
            onSendMessage={handleSendMessage}
            onReaction={handleReaction}
            onChannelCreate={handleChannelCreate}
            onChannelUpdate={handleChannelUpdate}
            onChannelDelete={handleChannelDelete}
          />
        )}
      </div>
    </div>
  );
}
