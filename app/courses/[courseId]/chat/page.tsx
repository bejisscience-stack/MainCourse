"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import LayoutContainer from "@/components/chat/LayoutContainer";
import ChatNavigation from "@/components/chat/ChatNavigation";
import ExpiredEnrollmentOverlay from "@/components/ExpiredEnrollmentOverlay";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/hooks/useUser";
import { useEnrollments } from "@/hooks/useEnrollments";
import { useActiveChannel } from "@/hooks/useActiveChannel";
import { useActiveServer } from "@/hooks/useActiveServer";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import type { Server, Channel } from "@/types/server";
import type { Message as MessageType } from "@/types/message";

export default function CourseChatPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const courseId = params?.courseId as string;
  const channelParam = searchParams.get("channel");
  const { user, role: userRole, isLoading: userLoading } = useUser();
  const {
    enrolledCourseIds,
    isEnrollmentActive,
    getEnrollmentInfo,
    isLoading: enrollmentsLoading,
    mutate: mutateEnrollments,
  } = useEnrollments(user?.id || null);
  const { hasProjectAccess, isLoading: projectAccessLoading } =
    useProjectAccess(user?.id);
  const [activeServerId, setActiveServerId] = useActiveServer();
  const [activeChannelId, setActiveChannelId] = useActiveChannel();
  const [course, setCourse] = useState<any>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingCourse, setIsLoadingCourse] = useState(true);
  const [hasAutoSelectedChannel, setHasAutoSelectedChannel] = useState(false);

  // Stable primitive to prevent infinite re-renders from Set/boolean reference changes
  const isEnrolledInCourse = enrolledCourseIds.has(courseId);
  const loadedCourseRef = useRef<string | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/login");
    }
  }, [user, userLoading, router]);

  // Redirect lecturers to their chat page (but allow admins)
  useEffect(() => {
    if (!userLoading && userRole === "lecturer") {
      router.push("/lecturer/chat");
    }
  }, [userRole, userLoading, router]);

  const loadCourseAndChannels = useCallback(async () => {
    if (!courseId || !user) return;
    try {
      setIsLoadingCourse(true);
      setError(null);

      // Admins can access all courses without enrollment
      // Regular users must be enrolled OR have project access
      if (userRole !== "admin" && !isEnrolledInCourse && !hasProjectAccess) {
        setError("You are not enrolled in this course.");
        setIsLoadingCourse(false);
        return;
      }

      // Fetch course details and channels in parallel
      const [courseResult, channelsResult] = await Promise.all([
        supabase
          .from("courses")
          .select("id, title, lecturer_id")
          .eq("id", courseId)
          .single(),
        supabase
          .from("channels")
          .select(
            "id, course_id, name, type, description, category_name, display_order",
          )
          .eq("course_id", courseId)
          .order("display_order", { ascending: true }),
      ]);

      const { data: courseData, error: courseError } = courseResult;
      if (courseError) throw courseError;
      if (!courseData) {
        setError("Course not found.");
        setIsLoadingCourse(false);
        return;
      }

      setCourse(courseData);

      // Process channels result
      let channelsData: any[] = [];
      const { data: channels, error: channelsError } = channelsResult;
      if (channelsError) {
        if (
          channelsError.code === "PGRST116" ||
          channelsError.message?.includes("relation") ||
          channelsError.message?.includes("does not exist")
        ) {
          console.warn(
            "Channels table does not exist yet. Using default channels.",
          );
        } else {
          console.warn("Error fetching channels:", channelsError);
        }
        channelsData = [];
      } else {
        channelsData = channels || [];
      }

      // Ensure required channels exist in database
      const hasLectures = channelsData.some(
        (ch) => ch.name.toLowerCase() === "lectures" && ch.type === "lectures",
      );
      const hasProjects = channelsData.some(
        (ch) => ch.name.toLowerCase() === "projects",
      );

      const channelsToCreate: any[] = [];
      if (!hasLectures) {
        channelsToCreate.push({
          course_id: courseId,
          name: "lectures",
          type: "lectures",
          description: `Video lectures for ${courseData.title}`,
          category_name: "COURSE CHANNELS",
          display_order: 0,
        });
      }
      if (!hasProjects) {
        channelsToCreate.push({
          course_id: courseId,
          name: "projects",
          type: "text",
          description: `Project submissions and discussions for ${courseData.title}`,
          category_name: "COURSE CHANNELS",
          display_order: 1,
        });
      }

      if (channelsToCreate.length > 0) {
        try {
          const { data: newChannels, error: createError } = await supabase
            .from("channels")
            .insert(channelsToCreate)
            .select(
              "id, course_id, name, type, description, category_name, display_order",
            );

          if (!createError && newChannels) {
            channelsData.push(...newChannels);
          }
        } catch (err) {
          console.warn("Error creating required channels:", err);
        }
      }

      // Transform course into server/channels structure
      const courseChannels = channelsData || [];

      // Group channels by category
      const channelsByCategory: { [key: string]: Channel[] } = {};
      courseChannels.forEach((ch) => {
        const category = ch.category_name || "COURSE CHANNELS";
        if (!channelsByCategory[category]) {
          channelsByCategory[category] = [];
        }
        channelsByCategory[category].push({
          id: ch.id,
          name: ch.name,
          type: ch.type as "text" | "voice" | "lectures",
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
          if (a.type === "lectures" && b.type !== "lectures") return -1;
          if (b.type === "lectures" && a.type !== "lectures") return 1;
          // Projects second
          if (
            a.name.toLowerCase() === "projects" &&
            b.name.toLowerCase() !== "projects"
          )
            return -1;
          if (
            b.name.toLowerCase() === "projects" &&
            a.name.toLowerCase() !== "projects"
          )
            return 1;
          // Then by displayOrder
          return (a.displayOrder || 0) - (b.displayOrder || 0);
        });
      });

      // Fetch all courses from the same lecturer
      let allLecturerCourses: any[] = [courseData];
      if (courseData.lecturer_id) {
        const { data: lecturerCourses } = await supabase
          .from("courses")
          .select("id, title, lecturer_id")
          .eq("lecturer_id", courseData.lecturer_id)
          .order("created_at", { ascending: false });

        if (lecturerCourses && lecturerCourses.length > 0) {
          allLecturerCourses = lecturerCourses;
        }
      }

      // Fetch channels for all lecturer courses
      const lecturerCourseIds = allLecturerCourses.map((c) => c.id);
      const { data: allChannelsData } = await supabase
        .from("channels")
        .select(
          "id, course_id, name, type, description, category_name, display_order",
        )
        .in("course_id", lecturerCourseIds)
        .order("display_order", { ascending: true });

      // Transform all courses into servers
      const serversData: Server[] = allLecturerCourses.map((course) => {
        const courseChannels = (allChannelsData || []).filter(
          (ch) => ch.course_id === course.id,
        );

        const channelsByCategory: { [key: string]: Channel[] } = {};
        courseChannels.forEach((ch) => {
          const category = ch.category_name || "COURSE CHANNELS";
          if (!channelsByCategory[category]) {
            channelsByCategory[category] = [];
          }
          channelsByCategory[category].push({
            id: ch.id,
            name: ch.name,
            type: ch.type as "text" | "voice" | "lectures",
            description: ch.description || undefined,
            courseId: course.id,
            categoryName: ch.category_name || undefined,
            displayOrder: ch.display_order || 0,
            messages: [],
          });
        });

        // Sort channels
        Object.keys(channelsByCategory).forEach((cat) => {
          channelsByCategory[cat].sort((a, b) => {
            if (a.type === "lectures" && b.type !== "lectures") return -1;
            if (b.type === "lectures" && a.type !== "lectures") return 1;
            if (
              a.name.toLowerCase() === "projects" &&
              b.name.toLowerCase() !== "projects"
            )
              return -1;
            if (
              b.name.toLowerCase() === "projects" &&
              a.name.toLowerCase() !== "projects"
            )
              return 1;
            return (a.displayOrder || 0) - (b.displayOrder || 0);
          });
        });

        return {
          id: course.id,
          name: course.title,
          icon: course.title.charAt(0).toUpperCase(),
          channels: Object.entries(channelsByCategory).map(
            ([categoryName, channels]) => ({
              id: `category-${course.id}-${categoryName}`,
              name: categoryName,
              channels,
            }),
          ),
        };
      });

      // Filter channels for project-access-only users (not enrolled, not admin)
      const isProjectAccessOnly =
        !isEnrolledInCourse && userRole !== "admin" && hasProjectAccess;
      const filteredServers = isProjectAccessOnly
        ? serversData.map((server) => ({
            ...server,
            channels: server.channels
              .map((category) => ({
                ...category,
                channels: category.channels.filter(
                  (ch) => ch.name.toLowerCase() === "projects",
                ),
              }))
              .filter((category) => category.channels.length > 0),
          }))
        : serversData;

      setServers(filteredServers);

      // Set active server to this course
      setActiveServerId(courseId);

      setIsLoadingCourse(false);
    } catch (err: any) {
      console.error("Error loading course chat:", err);
      setError(err.message || "Failed to load course chat. Please try again.");
      setIsLoadingCourse(false);
    }
  }, [courseId, user, isEnrolledInCourse, hasProjectAccess, userRole]);

  // Check enrollment and fetch course (only once per courseId)
  useEffect(() => {
    if (
      courseId &&
      user &&
      !userLoading &&
      !enrollmentsLoading &&
      !projectAccessLoading
    ) {
      // Prevent re-triggering for the same course
      if (loadedCourseRef.current === courseId) return;
      loadedCourseRef.current = courseId;
      loadCourseAndChannels();
    }
  }, [
    courseId,
    user,
    userLoading,
    enrollmentsLoading,
    projectAccessLoading,
    loadCourseAndChannels,
  ]);

  // Reset flags when courseId changes
  useEffect(() => {
    setHasAutoSelectedChannel(false);
    loadedCourseRef.current = null;
  }, [courseId]);

  // Auto-select channel when servers are loaded
  // Project-access-only users get the "projects" channel; enrolled users get "lectures"
  const isProjectAccessOnly =
    !isEnrolledInCourse && userRole !== "admin" && hasProjectAccess;

  useEffect(() => {
    if (servers.length > 0 && !hasAutoSelectedChannel && courseId) {
      const server = servers[0];
      const allChannels = server.channels.flatMap((cat) => cat.channels);

      // If a channel query param is present, use it (e.g. ?channel=projects)
      if (channelParam) {
        const paramChannel = allChannels.find(
          (ch) => ch.name.toLowerCase() === channelParam.toLowerCase(),
        );
        if (paramChannel) {
          setActiveChannelId(paramChannel.id);
          setHasAutoSelectedChannel(true);
          // Clean the URL to avoid re-triggering on refresh
          window.history.replaceState({}, "", window.location.pathname);
          return;
        }
      }

      // Pick the right default channel
      const targetChannel = isProjectAccessOnly
        ? allChannels.find((ch) => ch.name.toLowerCase() === "projects")
        : allChannels.find(
            (ch) =>
              ch.type === "lectures" && ch.name.toLowerCase() === "lectures",
          );

      // Only auto-select if no channel is currently selected, or if the selected channel is not from this course
      const currentChannel = allChannels.find(
        (ch) => ch.id === activeChannelId,
      );
      if (targetChannel && (!activeChannelId || !currentChannel)) {
        setActiveChannelId(targetChannel.id);
        setHasAutoSelectedChannel(true);
      } else if (activeChannelId && currentChannel) {
        // Channel is already selected for this course, mark as done
        setHasAutoSelectedChannel(true);
      }
    }
  }, [
    servers,
    activeChannelId,
    courseId,
    hasAutoSelectedChannel,
    setActiveChannelId,
    isProjectAccessOnly,
    channelParam,
  ]);

  const handleSendMessage = async (
    channelId: string,
    content: string | null,
  ) => {
    // Message sending is now handled by ChatArea component via API
    // This callback is kept for compatibility but doesn't need to do anything
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    // TODO: Save reaction to database
  };

  const loading =
    userLoading ||
    isLoadingCourse ||
    enrollmentsLoading ||
    projectAccessLoading;

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-navy-950">
        <ChatNavigation />
        <div className="flex-1 flex items-center justify-center bg-navy-950">
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
      <div className="flex flex-col h-screen bg-navy-950">
        <ChatNavigation />
        <div className="flex-1 flex items-center justify-center bg-navy-950">
          <div className="text-center text-gray-400">
            <p>Please log in to access chat</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen bg-navy-950">
        <ChatNavigation />
        <div className="flex-1 flex items-center justify-center bg-navy-950">
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
  const showExpirationOverlay = isExpired && userRole !== "admin";

  // Gate access: allow if admin, OR enrolled, OR (not enrolled but has project access)
  const hasAccess =
    userRole === "admin" || isEnrolled || (!isEnrolled && hasProjectAccess);

  if (!hasAccess && userRole !== "admin") {
    return (
      <div className="flex flex-col h-[100dvh] bg-navy-950/20 backdrop-blur-[0.5px]">
        <ChatNavigation />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400 max-w-md">
            <p className="text-lg font-medium mb-4">No Access</p>
            <p className="text-sm mb-6">
              You must be enrolled in this course or have an active project
              subscription.
            </p>
            <Link
              href="/my-courses"
              className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg"
            >
              Back to My Courses
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-navy-950/20 backdrop-blur-[0.5px] overscroll-none">
      <ChatNavigation />
      <div className="flex-1 overflow-hidden relative">
        {servers.length === 0 ? (
          <div className="flex-1 flex items-center justify-center bg-navy-950/20 backdrop-blur-[0.5px]">
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
            {user && (
              <div
                className={`h-full w-full ${showExpirationOverlay ? "filter blur-sm pointer-events-none" : ""}`}
              >
                <LayoutContainer
                  servers={servers}
                  currentUserId={user.id}
                  isLecturer={false}
                  enrolledCourseIds={enrolledCourseIds}
                  onSendMessage={handleSendMessage}
                  onReaction={handleReaction}
                  showDMButton={false}
                  isEnrolledInCourse={isEnrolled || userRole === "admin"}
                  enrollmentInfo={enrollmentInfo}
                  onReEnrollRequest={mutateEnrollments}
                />
              </div>
            )}
            {showExpirationOverlay && course && (
              <ExpiredEnrollmentOverlay
                course={course}
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
