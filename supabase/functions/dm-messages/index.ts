import {
  getCorsHeaders,
  handleCors,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";
import { getAuthenticatedUser } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET" && req.method !== "POST")
    return errorResponse("Method not allowed", 405, cors);

  const auth = await getAuthenticatedUser(req);
  if ("response" in auth) return auth.response;
  const { user, supabase } = auth;

  // Handle POST - send DM message
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { dmChannelId, content, replyTo, attachments } = body;

      if (!dmChannelId)
        return errorResponse("dmChannelId is required", 400, cors);

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

      // Verify user is a participant in the DM channel
      const { data: channel, error: channelError } = await supabase
        .from("dm_channels")
        .select("id, user1_id, user2_id")
        .eq("id", dmChannelId)
        .single();

      if (channelError || !channel)
        return errorResponse("DM channel not found", 404, cors);

      if (channel.user1_id !== user.id && channel.user2_id !== user.id) {
        return errorResponse(
          "Forbidden: You are not a participant in this DM channel",
          403,
          cors,
        );
      }

      // Determine the other participant
      const otherUserId =
        channel.user1_id === user.id ? channel.user2_id : channel.user1_id;

      // Check can_dm_user permission (in case friendship was removed)
      const { data: canDm, error: canDmError } = await supabase.rpc(
        "can_dm_user",
        { sender: user.id, receiver: otherUserId },
      );

      if (canDmError) {
        console.error("[DM] can_dm_user check failed:", canDmError);
        return errorResponse("Failed to verify DM permission", 500, cors);
      }

      if (!canDm) {
        return errorResponse(
          "You cannot send messages to this user",
          403,
          cors,
        );
      }

      // Insert message
      const { data: message, error: insertError } = await supabase
        .from("dm_messages")
        .insert({
          dm_channel_id: dmChannelId,
          user_id: user.id,
          content: sanitizedContent ? sanitizedContent.trim() : null,
          reply_to_id: replyTo || null,
        })
        .select("id, content, user_id, reply_to_id, edited_at, created_at")
        .single();

      if (insertError) {
        console.error("[DM] Failed to insert message:", insertError);
        return errorResponse("Failed to send message", 500, cors);
      }

      // Insert attachments if present
      if (hasAttachments && message) {
        const attachmentRows = attachments.map((att: any) => ({
          message_id: message.id,
          dm_channel_id: dmChannelId,
          file_url: att.fileUrl || att.url || att.file_url,
          file_name: att.fileName || att.name || att.file_name || "attachment",
          file_type: att.fileType || att.type || att.file_type || "image",
          file_size: att.fileSize || att.size || att.file_size || 0,
          mime_type:
            att.mimeType || att.mime_type || "application/octet-stream",
        }));
        const { error: attError } = await supabase
          .from("dm_message_attachments")
          .insert(attachmentRows);
        if (attError) {
          console.error("[DM] Failed to save attachments:", attError);
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
          .from("dm_message_attachments")
          .select("id, file_url, file_name, file_type, file_size, mime_type")
          .eq("message_id", message.id);
        if (attData && attData.length > 0) {
          savedAttachments = attData.map((a) => ({
            id: a.id,
            fileUrl: a.file_url,
            fileName: a.file_name,
            fileType: a.file_type,
            fileSize: a.file_size,
            mimeType: a.mime_type,
          }));
        }
      }

      // Get user profile
      const { data: profiles } = await supabase.rpc("get_safe_profiles", {
        user_ids: [user.id],
      });
      const profile = profiles?.[0] ?? null;

      // Get reply preview if replying
      let replyPreview = undefined;
      if (replyTo) {
        const { data: replyMessage } = await supabase
          .from("dm_messages")
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

      const formattedMessage = {
        id: message.id,
        user: {
          id: message.user_id,
          username: profile?.username || "User",
          avatarUrl: profile?.avatar_url || "",
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
      console.error("[DM] Error sending message:", error);
      return errorResponse("Internal server error", 500, cors);
    }
  }

  // Handle GET - fetch paginated DM messages
  const url = new URL(req.url);
  const dmChannelId = url.searchParams.get("dmChannelId");
  if (!dmChannelId)
    return errorResponse("dmChannelId query parameter is required", 400, cors);

  try {
    // Verify user is a participant in the DM channel
    const { data: channel, error: channelError } = await supabase
      .from("dm_channels")
      .select("id, user1_id, user2_id")
      .eq("id", dmChannelId)
      .single();

    if (channelError || !channel)
      return errorResponse("DM channel not found", 404, cors);

    if (channel.user1_id !== user.id && channel.user2_id !== user.id) {
      return errorResponse(
        "Forbidden: You are not a participant in this DM channel",
        403,
        cors,
      );
    }

    const before = url.searchParams.get("before");
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "50", 10),
      100,
    );

    let query = supabase
      .from("dm_messages")
      .select("id, content, user_id, reply_to_id, edited_at, created_at")
      .eq("dm_channel_id", dmChannelId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) query = query.lt("created_at", before);

    const { data: messages, error: messagesError } = await query;
    if (messagesError) {
      console.error("[DM] Failed to fetch messages:", messagesError);
      return errorResponse("Failed to fetch messages", 500, cors);
    }
    if (!messages || messages.length === 0)
      return jsonResponse({ messages: [] }, 200, cors);

    const userIds = [...new Set(messages.map((m) => m.user_id))];
    const replyIds = messages
      .filter((m) => m.reply_to_id)
      .map((m) => m.reply_to_id);
    const messageIds = messages.map((m) => m.id);

    const [profilesResult, replyMessagesResult, attachmentsResult] =
      await Promise.all([
        supabase.rpc("get_safe_profiles", { user_ids: userIds }),
        replyIds.length > 0
          ? supabase
              .from("dm_messages")
              .select("id, content, user_id")
              .in("id", replyIds)
          : Promise.resolve({ data: null }),
        supabase
          .from("dm_message_attachments")
          .select(
            "id, message_id, file_url, file_name, file_type, file_size, mime_type",
          )
          .in("message_id", messageIds),
      ]);

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
        attachmentMap.get(att.message_id).push({
          id: att.id,
          fileUrl: att.file_url,
          fileName: att.file_name,
          fileType: att.file_type,
          fileSize: att.file_size,
          mimeType: att.mime_type,
        });
      }
    }

    const formattedMessages = messages.map((msg) => {
      const profile = profileMap.get(msg.user_id);
      return {
        id: msg.id,
        user: {
          id: msg.user_id,
          username: profile?.username || "User",
          avatarUrl: profile?.avatar_url || "",
        },
        content: msg.content,
        timestamp: new Date(msg.created_at).getTime(),
        edited: !!msg.edited_at,
        replyTo: msg.reply_to_id || undefined,
        replyPreview: msg.reply_to_id
          ? replyMap.get(msg.reply_to_id)
          : undefined,
        attachments: attachmentMap.get(msg.id),
        reactions: [],
      };
    });

    formattedMessages.reverse();
    return jsonResponse({ messages: formattedMessages }, 200, cors);
  } catch (error) {
    console.error("[DM] Error fetching messages:", error);
    return errorResponse("Internal server error", 500, cors);
  }
});
