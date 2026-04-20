"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LayoutContainer from "@/components/chat/LayoutContainer";
import ChatNavigation from "@/components/chat/ChatNavigation";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/hooks/useUser";
import { useEnrollments } from "@/hooks/useEnrollments";
import { useI18n } from "@/contexts/I18nContext";
import { normalizeProfileUsername } from "@/lib/username";
import type { Server, Channel } from "@/types/server";
import type { Member } from "@/types/member";

export default function StudentChatPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { user, role: userRole, isLoading: userLoading } = useUser();
  const { enrolledCourseIds, isLoading: enrollmentsLoading } = useEnrollments(
    user?.id || null,
  );
  const [servers, setServers] = useState<Server[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/login");
    }
  }, [user, userLoading, router]);

  // Redirect lecturers to their chat page
  useEffect(() => {
    if (!userLoading && userRole === "lecturer") {
      router.push("/lecturer/chat");
    }
  }, [userRole, userLoading, router]);

  const loadEnrolledCoursesAndChannels = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);

      // Handle case when there are no enrollments
      if (!enrolledCourseIds || enrolledCourseIds.size === 0) {
        setServers([]);
        setMembers([]);
        return;
      }

      const courseIds = Array.from(enrolledCourseIds);

      // Fetch courses and channels in parallel (both depend only on courseIds)
      const [coursesResult, channelsResult] = await Promise.all([
        supabase
          .from("courses")
          .select("id, title, lecturer_id")
          .in("id", courseIds),
        supabase
          .from("channels")
          .select(
            "id, course_id, name, type, description, category_name, display_order",
          )
          .in("course_id", courseIds)
          .order("display_order", { ascending: true }),
      ]);

      const { data: courses, error: coursesError } = coursesResult;
      const { data: channelsData, error: channelsError } = channelsResult;

      if (coursesError) {
        throw coursesError;
      }

      if (!courses || courses.length === 0) {
        setServers([]);
        setMembers([]);
        return;
      }

      if (channelsError && channelsError.code !== "PGRST116") {
        console.warn("Error fetching channels:", channelsError);
      }

      // Transform courses into servers/channels structure
      const serversData: Server[] = (courses || []).map((course) => {
        const courseChannels = (channelsData || []).filter(
          (ch) => ch.course_id === course.id,
        );

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
            courseId: course.id,
            categoryName: ch.category_name || undefined,
            displayOrder: ch.display_order || 0,
            messages: [],
          });
        });

        // Sort channels: lectures first, then projects, then by displayOrder
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

      setServers(serversData);

      // Fetch members (enrolled students and lecturers)
      try {
        const { data: enrollments } = await supabase
          .from("enrollments")
          .select("user_id, course_id")
          .in("course_id", courseIds);

        if (enrollments) {
          const userIds = new Set<string>();
          enrollments.forEach((e) => userIds.add(e.user_id));

          // Add lecturer IDs
          courses.forEach((course) => {
            if (course.lecturer_id) {
              userIds.add(course.lecturer_id);
            }
          });

          if (userIds.size > 0) {
            const { data: profiles } = await supabase.rpc("get_safe_profiles", {
              user_ids: Array.from(userIds),
            });

            const membersData: Member[] =
              profiles?.map((profile: any) => {
                const username = normalizeProfileUsername(profile);
                return {
                  id: profile.id,
                  username,
                  avatarUrl: profile.avatar_url || "",
                  status: "online" as const,
                  role: profile.role || "student",
                };
              }) || [];

            setMembers(membersData);
          }
        }
      } catch (membersErr) {
        console.warn("Error loading members:", membersErr);
        setMembers([]);
      }
    } catch (err: any) {
      console.error("Error loading chat data:", err);
      setError(err.message || "Failed to load chat. Please try again.");
    }
  }, [user, enrolledCourseIds]);

  useEffect(() => {
    if (!enrollmentsLoading && user) {
      loadEnrolledCoursesAndChannels();
    }
  }, [enrollmentsLoading, user, loadEnrolledCoursesAndChannels]);

  const handleSendMessage = async (
    channelId: string,
    content: string | null,
  ) => {
    // Message sending is handled by ChatArea component via API
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    // Reactions are handled by ChatArea component
  };

  const loading = userLoading || enrollmentsLoading;

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
                loadEnrolledCoursesAndChannels();
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
    <div className="flex flex-col h-dvh bg-navy-950/20 backdrop-blur-[0.5px]">
      <ChatNavigation />
      <div className="flex-1 overflow-hidden">
        {servers.length === 0 ? (
          <div
            className="flex-1 flex items-center justify-center px-6 py-12 relative overflow-hidden"
            style={{
              backgroundImage:
                "radial-gradient(ellipse at 50% 25%, rgba(16, 185, 129, 0.12), transparent 60%)",
            }}
          >
            <div className="text-center max-w-xl relative">
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-gray-500 mb-3">
                {t("chat.home")}
              </div>
              <h1 className="text-3xl sm:text-4xl font-semibold text-gray-100 leading-tight tracking-tight text-balance">
                {t("chat.noEnrolledCoursesTitle")}
              </h1>
              <p className="mt-4 text-[15px] text-gray-400 leading-relaxed text-pretty max-w-[52ch] mx-auto">
                {t("chat.noEnrolledCoursesDescription")}
              </p>
              <Link
                href="/courses"
                className="mt-8 inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-navy-950 font-semibold px-6 py-3 rounded-xl transition-colors shadow-soft"
              >
                {t("chat.browseCourses")}
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 6l6 6-6 6"
                  />
                </svg>
              </Link>
            </div>
          </div>
        ) : (
          user && (
            <LayoutContainer
              servers={servers}
              currentUserId={user.id}
              isLecturer={false}
              enrolledCourseIds={enrolledCourseIds}
              onSendMessage={handleSendMessage}
              onReaction={handleReaction}
            />
          )
        )}
      </div>
    </div>
  );
}
