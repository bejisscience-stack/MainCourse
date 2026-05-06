import {
  getCorsHeaders,
  handleCors,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";
import { getAuthenticatedUser, checkIsAdmin } from "../_shared/auth.ts";

interface PinRow {
  id: string;
  channel_id: string;
  course_id: string;
  message_id: string;
  pinned_by: string;
  pinned_at: string;
}

interface MessageRow {
  id: string;
  content: string | null;
  user_id: string;
  reply_to_id?: string | null;
  edited_at?: string | null;
  created_at: string;
}

function toPreview(content: string | null | undefined, maxLength = 120) {
  const value = (content || "").trim();
  if (value.length <= maxLength) return value;
  return `${value.substring(0, maxLength)}...`;
}

async function fetchPinnedMessages(supabase: any, chatId: string) {
  const { data: pins, error: pinsError } = await supabase
    .from("chat_pinned_messages")
    .select("id, channel_id, course_id, message_id, pinned_by, pinned_at")
    .eq("channel_id", chatId)
    .order("pinned_at", { ascending: false });

  if (pinsError) {
    console.error("[Chat Pins] Failed to fetch pins:", pinsError);
    throw new Error("Failed to fetch pinned messages");
  }

  const pinRows = (pins || []) as PinRow[];
  if (pinRows.length === 0) return [];

  const messageIds = pinRows.map((pin) => pin.message_id);
  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("id, content, user_id, reply_to_id, edited_at, created_at")
    .in("id", messageIds);

  if (messagesError) {
    console.error("[Chat Pins] Failed to fetch pinned message rows:", messagesError);
    throw new Error("Failed to fetch pinned messages");
  }

  const messageRows = (messages || []) as MessageRow[];
  const messageMap = new Map(messageRows.map((message) => [message.id, message]));
  const visibleMessageIds = messageRows.map((message) => message.id);
  const userIds = [
    ...new Set([
      ...messageRows.map((message) => message.user_id),
      ...pinRows.map((pin) => pin.pinned_by),
    ]),
  ];

  const [profilesResult, attachmentsResult] = await Promise.all([
    userIds.length > 0
      ? supabase.rpc("get_safe_profiles", { user_ids: userIds })
      : Promise.resolve({ data: [] }),
    visibleMessageIds.length > 0
      ? supabase
          .from("message_attachments")
          .select(
            "id, message_id, file_url, file_name, file_type, file_size, mime_type",
          )
          .in("message_id", visibleMessageIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileMap = new Map(
    (profilesResult.data || []).map((profile: any) => [profile.id, profile]),
  );
  const attachmentMap = new Map<string, any[]>();

  for (const attachment of attachmentsResult.data || []) {
    const existing = attachmentMap.get(attachment.message_id) || [];
    existing.push({
      id: attachment.id,
      fileUrl: attachment.file_url,
      fileName: attachment.file_name,
      fileType: attachment.file_type,
      fileSize: attachment.file_size,
      mimeType: attachment.mime_type,
    });
    attachmentMap.set(attachment.message_id, existing);
  }

  return pinRows
    .map((pin) => {
      const message = messageMap.get(pin.message_id);
      if (!message) return null;

      const authorProfile = profileMap.get(message.user_id);
      const pinnedByProfile = profileMap.get(pin.pinned_by);

      return {
        id: pin.id,
        messageId: pin.message_id,
        channelId: pin.channel_id,
        courseId: pin.course_id,
        pinnedAt: new Date(pin.pinned_at).getTime(),
        pinnedBy: {
          id: pin.pinned_by,
          username: pinnedByProfile?.username || "User",
        },
        message: {
          id: message.id,
          content: message.content || "",
          timestamp: new Date(message.created_at).getTime(),
          edited: !!message.edited_at,
          replyTo: message.reply_to_id || undefined,
          attachments: attachmentMap.get(message.id),
          user: {
            id: message.user_id,
            username: authorProfile?.username || "User",
            avatarUrl: authorProfile?.avatar_url || "",
          },
        },
        preview: toPreview(message.content),
      };
    })
    .filter(Boolean);
}

async function getChannelAndCourse(supabase: any, chatId: string) {
  const { data: channel, error: channelError } = await supabase
    .from("channels")
    .select("id, course_id, name")
    .eq("id", chatId)
    .maybeSingle();

  if (channelError) {
    console.error("[Chat Pins] Failed to fetch channel:", channelError);
    throw new Error("Failed to fetch channel");
  }
  if (!channel) return { channel: null, course: null };

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("lecturer_id")
    .eq("id", channel.course_id)
    .maybeSingle();

  if (courseError) {
    console.error("[Chat Pins] Failed to fetch course:", courseError);
    throw new Error("Failed to fetch course");
  }

  return { channel, course };
}

async function canManagePins(supabase: any, userId: string, course: any) {
  if (!course) return false;
  if (course.lecturer_id === userId) return true;
  return await checkIsAdmin(supabase, userId);
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET" && req.method !== "POST" && req.method !== "DELETE") {
    return errorResponse("Method not allowed", 405, cors);
  }

  const auth = await getAuthenticatedUser(req);
  if ("response" in auth) return auth.response;
  const { user, supabase } = auth;

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const chatId = url.searchParams.get("chatId");
      if (!chatId) return errorResponse("chatId query parameter is required", 400, cors);

      const pins = await fetchPinnedMessages(supabase, chatId);
      return jsonResponse({ pins }, 200, cors);
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { chatId, messageId } = body;

      if (!chatId || typeof chatId !== "string") {
        return errorResponse("chatId is required", 400, cors);
      }
      if (!messageId || typeof messageId !== "string") {
        return errorResponse("messageId is required", 400, cors);
      }

      const { channel, course } = await getChannelAndCourse(supabase, chatId);
      if (!channel || !course) return errorResponse("Channel not found", 404, cors);

      if (!(await canManagePins(supabase, user.id, course))) {
        return errorResponse("Forbidden: Only the lecturer can pin messages", 403, cors);
      }

      const { data: message, error: messageError } = await supabase
        .from("messages")
        .select("id, channel_id, course_id")
        .eq("id", messageId)
        .maybeSingle();

      if (messageError) {
        console.error("[Chat Pins] Failed to fetch message:", messageError);
        return errorResponse("Failed to fetch message", 500, cors);
      }
      if (!message) return errorResponse("Message not found", 404, cors);
      if (message.channel_id !== chatId || message.course_id !== channel.course_id) {
        return errorResponse("Message does not belong to this chat", 400, cors);
      }

      const { error: insertError } = await supabase
        .from("chat_pinned_messages")
        .insert({
          channel_id: chatId,
          course_id: channel.course_id,
          message_id: messageId,
          pinned_by: user.id,
        });

      if (insertError && insertError.code !== "23505") {
        console.error("[Chat Pins] Failed to pin message:", insertError);
        return errorResponse("Failed to pin message", 500, cors);
      }

      const pins = await fetchPinnedMessages(supabase, chatId);
      return jsonResponse({ pins }, 200, cors);
    }

    const url = new URL(req.url);
    const chatId = url.searchParams.get("chatId");
    const messageId = url.searchParams.get("messageId");

    if (!chatId) return errorResponse("chatId query parameter is required", 400, cors);
    if (!messageId) {
      return errorResponse("messageId query parameter is required", 400, cors);
    }

    const { channel, course } = await getChannelAndCourse(supabase, chatId);
    if (!channel || !course) return errorResponse("Channel not found", 404, cors);

    if (!(await canManagePins(supabase, user.id, course))) {
      return errorResponse("Forbidden: Only the lecturer can unpin messages", 403, cors);
    }

    const { error: deleteError } = await supabase
      .from("chat_pinned_messages")
      .delete()
      .eq("channel_id", chatId)
      .eq("message_id", messageId);

    if (deleteError) {
      console.error("[Chat Pins] Failed to unpin message:", deleteError);
      return errorResponse("Failed to unpin message", 500, cors);
    }

    const pins = await fetchPinnedMessages(supabase, chatId);
    return jsonResponse({ pins }, 200, cors);
  } catch (error) {
    console.error("[Chat Pins] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return errorResponse(message, 500, cors);
  }
});
