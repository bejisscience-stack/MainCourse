import {
  getCorsHeaders,
  handleCors,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";
import { getAuthenticatedUser, checkIsAdmin } from "../_shared/auth.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

const VALID_REACTIONS = new Set(["👍", "❤️", "😂", "😮", "😢", "🙏"]);

interface AttachmentRow {
  id: string;
  message_id?: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  mime_type: string;
}

// chat-media is private (mig 235). Rows whose file_url is still a legacy
// https:// public URL keep flowing as `fileUrl` (passthrough — the URL stops
// resolving once mig 235 lands and mig 238 will rewrite these to path form).
// Path-only rows are emitted as `filePath`; the client renderer signs them
// per render via useSignedChatMediaUrl.
function mapAttachmentRow(att: AttachmentRow) {
  const value = att.file_url;
  const isLegacyUrl = typeof value === "string" && value.startsWith("https://");
  return {
    id: att.id,
    fileName: att.file_name,
    fileType: att.file_type,
    fileSize: att.file_size,
    mimeType: att.mime_type,
    ...(isLegacyUrl ? { fileUrl: value } : { filePath: value }),
  };
}

interface ReactionRow {
  message_id: string;
  user_id: string;
  emoji: string;
}

function formatReactions(rows: ReactionRow[] | null | undefined) {
  const grouped = new Map<string, string[]>();

  for (const row of rows || []) {
    if (!VALID_REACTIONS.has(row.emoji)) continue;

    let users = grouped.get(row.emoji);
    if (!users) {
      users = [];
      grouped.set(row.emoji, users);
    }
    if (!users.includes(row.user_id)) users.push(row.user_id);
  }

  return Array.from(grouped.entries()).map(([emoji, users]) => ({
    emoji,
    count: users.length,
    users,
  }));
}

function mapReactionsByMessage(rows: ReactionRow[] | null | undefined) {
  const rowsByMessage = new Map<string, ReactionRow[]>();

  for (const row of rows || []) {
    const messageRows = rowsByMessage.get(row.message_id) || [];
    messageRows.push(row);
    rowsByMessage.set(row.message_id, messageRows);
  }

  const reactionMap = new Map<string, ReturnType<typeof formatReactions>>();
  for (const [messageId, messageRows] of rowsByMessage.entries()) {
    reactionMap.set(messageId, formatReactions(messageRows));
  }

  return reactionMap;
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET" && req.method !== "POST" && req.method !== "PATCH")
    return errorResponse("Method not allowed", 405, cors);

  const auth = await getAuthenticatedUser(req);
  if ("response" in auth) return auth.response;
  const { user, supabase, token } = auth;
  const serviceSupabase = createServiceRoleClient(token);

  // Handle PATCH - toggle a message reaction
  if (req.method === "PATCH") {
    try {
      const body = await req.json().catch(() => ({}));
      const { chatId, messageId, emoji } = body;

      if (!messageId || typeof messageId !== "string") {
        return errorResponse("messageId is required", 400, cors);
      }
      if (!emoji || typeof emoji !== "string" || !VALID_REACTIONS.has(emoji)) {
        return errorResponse("Invalid reaction emoji", 400, cors);
      }

      const { data: message, error: messageError } = await supabase
        .from("messages")
        .select("id, channel_id")
        .eq("id", messageId)
        .maybeSingle();

      if (messageError) {
        console.error("[Chat] Failed to fetch reaction message:", messageError);
        return errorResponse("Failed to fetch message", 500, cors);
      }
      if (!message) return errorResponse("Message not found", 404, cors);
      if (chatId && message.channel_id !== chatId) {
        return errorResponse("Message does not belong to chat", 400, cors);
      }

      const { data: existingReaction, error: existingError } =
        await serviceSupabase
          .from("message_reactions")
          .select("id")
          .eq("message_id", messageId)
          .eq("user_id", user.id)
          .eq("emoji", emoji)
          .maybeSingle();

      if (existingError) {
        console.error(
          "[Chat] Failed to fetch existing reaction:",
          existingError,
        );
        return errorResponse("Failed to update reaction", 500, cors);
      }

      if (existingReaction) {
        const { error: deleteError } = await serviceSupabase
          .from("message_reactions")
          .delete()
          .eq("id", existingReaction.id);

        if (deleteError) {
          console.error("[Chat] Failed to delete reaction:", deleteError);
          return errorResponse("Failed to update reaction", 500, cors);
        }
      } else {
        const { error: insertError } = await serviceSupabase
          .from("message_reactions")
          .insert({
            message_id: messageId,
            user_id: user.id,
            emoji,
          });

        if (insertError) {
          console.error("[Chat] Failed to insert reaction:", insertError);
          return errorResponse("Failed to update reaction", 500, cors);
        }
      }

      const { data: reactionRows, error: reactionsError } =
        await serviceSupabase
          .from("message_reactions")
          .select("message_id, user_id, emoji")
          .eq("message_id", messageId)
          .order("created_at", { ascending: true });

      if (reactionsError) {
        console.error(
          "[Chat] Failed to fetch saved reactions:",
          reactionsError,
        );
        return errorResponse("Failed to fetch reactions", 500, cors);
      }

      return jsonResponse(
        { messageId, reactions: formatReactions(reactionRows) },
        200,
        cors,
      );
    } catch (error) {
      console.error("[Chat] Reaction error:", error);
      return errorResponse("Internal server error", 500, cors);
    }
  }

  // Handle POST - send message
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { chatId, content, replyTo, attachments } = body;

      if (!chatId) return errorResponse("chatId is required", 400, cors);

      const hasContent =
        content && typeof content === "string" && content.trim().length > 0;
      const hasAttachments =
        Array.isArray(attachments) && attachments.length > 0;

      if (!hasContent && !hasAttachments) {
        return errorResponse(
          "Message content or attachments required",
          400,
          cors,
        );
      }
      if (hasContent && content.trim().length > 4000) {
        return errorResponse(
          "Message content too long (max 4000 chars)",
          400,
          cors,
        );
      }

      const sanitizedContent = hasContent
        ? content
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#x27;")
        : null;

      const { data: channel, error: channelError } = await supabase
        .from("channels")
        .select("id, course_id, name")
        .eq("id", chatId)
        .single();

      if (channelError || !channel)
        return errorResponse("Channel not found", 404, cors);

      const isAdmin = await checkIsAdmin(supabase, user.id);

      // Fetch course to check lecturer and permissions
      const { data: course } = await supabase
        .from("courses")
        .select("lecturer_id")
        .eq("id", channel.course_id)
        .single();

      if (!isAdmin) {
        const { data: enrollment } = await supabase
          .from("enrollments")
          .select("id")
          .eq("user_id", user.id)
          .eq("course_id", channel.course_id)
          .single();

        if (!enrollment && course?.lecturer_id !== user.id) {
          // Allow project-access users in the projects channel
          if (channel.name?.toLowerCase() === "projects") {
            const { data: hasAccess } = await supabase.rpc(
              "has_project_access",
              { uid: user.id },
            );
            if (!hasAccess) {
              return errorResponse(
                "Forbidden: You do not have access to this channel",
                403,
                cors,
              );
            }
          } else {
            return errorResponse(
              "Forbidden: You do not have access to this channel",
              403,
              cors,
            );
          }
        }

        // Check if user is muted (only when course/lecturer is known)
        if (course?.lecturer_id) {
          const { data: mutedUser } = await supabase
            .from("muted_users")
            .select("id")
            .eq("lecturer_id", course.lecturer_id)
            .eq("user_id", user.id)
            .single();
          if (mutedUser)
            return errorResponse(
              "You have been muted and cannot send messages",
              403,
              cors,
            );
        }
      }

      // Insert message
      const { data: message, error: insertError } = await supabase
        .from("messages")
        .insert({
          channel_id: chatId,
          course_id: channel.course_id,
          user_id: user.id,
          content: sanitizedContent ? sanitizedContent.trim() : null,
          reply_to_id: replyTo || null,
        })
        .select("id, content, user_id, reply_to_id, edited_at, created_at")
        .single();

      if (insertError)
        return errorResponse("Failed to send message", 500, cors);

      // Insert attachments if present
      if (hasAttachments && message) {
        const attachmentRows = attachments.map((att: any) => ({
          message_id: message.id,
          channel_id: chatId,
          course_id: channel.course_id,
          // After privatization, the client forwards a path from the upload
          // edge fn (as `filePath` per MessageInput) — store it as-is in
          // file_url. Older clients still send `fileUrl` (full public URL).
          file_url:
            att.filePath || att.path || att.fileUrl || att.url || att.file_url,
          file_name: att.fileName || att.name || att.file_name || "attachment",
          file_type: att.fileType || att.type || att.file_type || "image",
          file_size: att.fileSize || att.size || att.file_size || 0,
          mime_type:
            att.mimeType || att.mime_type || "application/octet-stream",
        }));
        const { error: attError } = await supabase
          .from("message_attachments")
          .insert(attachmentRows);
        if (attError) {
          console.error("[Chat] Failed to save attachments:", attError);
          // Return message with warning so client knows attachments weren't saved
          return jsonResponse(
            {
              message: { ...message, content: message.content },
              warning: "Message sent but attachments failed to save",
            },
            201,
            cors,
          );
        }
      }

      // Fetch saved attachments for the response
      let savedAttachments: any[] | undefined;
      if (hasAttachments && message) {
        const { data: attData } = await supabase
          .from("message_attachments")
          .select("id, file_url, file_name, file_type, file_size, mime_type")
          .eq("message_id", message.id);
        if (attData && attData.length > 0) {
          savedAttachments = attData.map(mapAttachmentRow);
        }
      }

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .eq("id", user.id)
        .single();

      // Get reply preview if replying
      let replyPreview = undefined;
      if (replyTo) {
        const { data: replyMessage } = await supabase
          .from("messages")
          .select("id, content, user_id")
          .eq("id", replyTo)
          .single();

        if (replyMessage) {
          const { data: replyProfiles } = await supabase.rpc(
            "get_safe_profiles",
            { user_ids: [replyMessage.user_id] },
          );
          const replyProfile = replyProfiles?.[0] ?? null;
          replyPreview = {
            id: replyMessage.id,
            username: replyProfile?.username || "User",
            content: replyMessage.content
              ? replyMessage.content.length > 100
                ? replyMessage.content.substring(0, 100) + "..."
                : replyMessage.content
              : "",
          };
        }
      }

      const isMessageAuthorLecturer = course?.lecturer_id === user.id;

      const formattedMessage = {
        id: message.id,
        user: {
          id: message.user_id,
          username: profile?.username || "User",
          avatarUrl: profile?.avatar_url || "",
          ...(isMessageAuthorLecturer && { role: "lecturer" }),
        },
        content: message.content,
        timestamp: new Date(message.created_at).getTime(),
        edited: false,
        replyTo: message.reply_to_id || undefined,
        replyPreview,
        attachments: savedAttachments,
        reactions: [],
      };

      return jsonResponse({ message: formattedMessage }, 201, cors);
    } catch (error) {
      console.error("Error:", error);
      return errorResponse("Internal server error", 500, cors);
    }
  }

  // Handle GET - fetch messages
  const url = new URL(req.url);
  const chatId = url.searchParams.get("chatId");
  if (!chatId)
    return errorResponse("chatId query parameter is required", 400, cors);

  try {
    const { data: channel, error: channelError } = await supabase
      .from("channels")
      .select("id, course_id, name, type")
      .eq("id", chatId)
      .single();

    if (channelError || !channel)
      return errorResponse("Channel not found", 404, cors);

    const isAdmin = await checkIsAdmin(supabase, user.id);

    // Fetch course to check permissions and identify lecturer
    const { data: courseData } = await supabase
      .from("courses")
      .select("lecturer_id")
      .eq("id", channel.course_id)
      .single();

    if (!isAdmin) {
      const { data: enrollment } = await supabase
        .from("enrollments")
        .select("id")
        .eq("user_id", user.id)
        .eq("course_id", channel.course_id)
        .single();

      if (!enrollment && courseData?.lecturer_id !== user.id) {
        // Allow project-access users in the projects channel
        if (channel.name?.toLowerCase() === "projects") {
          const { data: hasAccess } = await supabase.rpc("has_project_access", {
            uid: user.id,
          });
          if (!hasAccess) {
            return errorResponse(
              "Forbidden: You do not have access to this channel",
              403,
              cors,
            );
          }
        } else {
          return errorResponse(
            "Forbidden: You do not have access to this channel",
            403,
            cors,
          );
        }
      }
    }

    const lecturerId = courseData?.lecturer_id;
    const before = url.searchParams.get("before");
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "50", 10),
      100,
    );

    let query = supabase
      .from("messages")
      .select(
        "id, content, user_id, reply_to_id, edited_at, created_at, channel_id, course_id",
      )
      .eq("channel_id", chatId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) query = query.lt("created_at", before);

    const { data: messages, error: messagesError } = await query;
    if (messagesError)
      return errorResponse("Failed to fetch messages", 500, cors);
    if (!messages || messages.length === 0)
      return jsonResponse({ messages: [] }, 200, cors);

    const userIds = [...new Set(messages.map((m) => m.user_id))];
    const replyIds = messages
      .filter((m) => m.reply_to_id)
      .map((m) => m.reply_to_id);
    const messageIds = messages.map((m) => m.id);

    const [
      profilesResult,
      replyMessagesResult,
      attachmentsResult,
      reactionsResult,
    ] = await Promise.all([
      supabase.rpc("get_safe_profiles", { user_ids: userIds }),
      replyIds.length > 0
        ? supabase
            .from("messages")
            .select("id, content, user_id")
            .in("id", replyIds)
        : Promise.resolve({ data: null }),
      supabase
        .from("message_attachments")
        .select(
          "id, message_id, file_url, file_name, file_type, file_size, mime_type",
        )
        .in("message_id", messageIds),
      serviceSupabase
        .from("message_reactions")
        .select("message_id, user_id, emoji")
        .in("message_id", messageIds)
        .order("created_at", { ascending: true }),
    ]);

    if (reactionsResult.error) {
      console.error("[Chat] Failed to fetch reactions:", reactionsResult.error);
    }

    const profileMap = new Map(
      profilesResult.data?.map((p) => [p.id, p]) || [],
    );
    const replyMap = new Map();

    if (replyMessagesResult.data?.length) {
      const replyUserIds = [
        ...new Set(replyMessagesResult.data.map((m) => m.user_id)),
      ];
      const { data: replyProfiles } = await supabase.rpc("get_safe_profiles", {
        user_ids: replyUserIds,
      });
      const replyProfileMap = new Map(
        replyProfiles?.map((p) => [p.id, p]) || [],
      );

      for (const reply of replyMessagesResult.data) {
        const replyProfile = replyProfileMap.get(reply.user_id);
        replyMap.set(reply.id, {
          id: reply.id,
          username: replyProfile?.username || "User",
          content: reply.content
            ? reply.content.length > 100
              ? reply.content.substring(0, 100) + "..."
              : reply.content
            : "",
        });
      }
    }

    const attachmentMap = new Map();
    if (attachmentsResult.data) {
      for (const att of attachmentsResult.data) {
        if (!attachmentMap.has(att.message_id))
          attachmentMap.set(att.message_id, []);
        attachmentMap.get(att.message_id).push(mapAttachmentRow(att));
      }
    }

    const reactionMap = reactionsResult.error
      ? new Map()
      : mapReactionsByMessage(reactionsResult.data);

    const formattedMessages = messages.map((msg) => {
      const profile = profileMap.get(msg.user_id);
      return {
        id: msg.id,
        user: {
          id: msg.user_id,
          username: profile?.username || "User",
          avatarUrl: profile?.avatar_url || "",
          ...(lecturerId === msg.user_id && { role: "lecturer" }),
        },
        content: msg.content,
        timestamp: new Date(msg.created_at).getTime(),
        edited: !!msg.edited_at,
        replyTo: msg.reply_to_id || undefined,
        replyPreview: msg.reply_to_id
          ? replyMap.get(msg.reply_to_id)
          : undefined,
        attachments: attachmentMap.get(msg.id),
        reactions: reactionMap.get(msg.id) || [],
      };
    });

    formattedMessages.reverse();
    return jsonResponse({ messages: formattedMessages }, 200, cors);
  } catch (error) {
    console.error("Error:", error);
    return errorResponse("Internal server error", 500, cors);
  }
});
