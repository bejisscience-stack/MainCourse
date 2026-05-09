import {
  getCorsHeaders,
  handleCors,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";
import { getAuthenticatedUser } from "../_shared/auth.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

const VALID_REACTIONS = new Set(["👍", "❤️", "😂", "😮", "😢", "🙏"]);

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

interface AttachmentInput {
  fileUrl?: string;
  url?: string;
  file_url?: string;
  fileName?: string;
  name?: string;
  file_name?: string;
  fileType?: string;
  type?: string;
  file_type?: string;
  fileSize?: number;
  size?: number;
  file_size?: number;
  mimeType?: string;
  mime_type?: string;
  filePath?: string;
  path?: string;
  file_path?: string;
}

function sanitize(content: string): string {
  return content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

interface SafeProfileRow {
  id: string;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
}

function toUser(profile?: SafeProfileRow | null, fallbackId = "") {
  return {
    id: profile?.id || fallbackId,
    username: profile?.username || "User",
    avatarUrl: profile?.avatar_url || "",
  };
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

  // PATCH - toggle a DM message reaction
  if (req.method === "PATCH") {
    try {
      const body = await req.json().catch(() => ({}));
      const { conversationId, messageId, emoji } = body || {};

      if (!messageId || typeof messageId !== "string") {
        return errorResponse("messageId is required", 400, cors);
      }
      if (!emoji || typeof emoji !== "string" || !VALID_REACTIONS.has(emoji)) {
        return errorResponse("Invalid reaction emoji", 400, cors);
      }

      const { data: message, error: messageError } = await supabase
        .from("dm_messages")
        .select("id, conversation_id")
        .eq("id", messageId)
        .maybeSingle();

      if (messageError) {
        console.error("[dm-messages] reaction lookup error", messageError);
        return errorResponse("Failed to fetch message", 500, cors);
      }
      if (!message) return errorResponse("Message not found", 404, cors);
      if (conversationId && message.conversation_id !== conversationId) {
        return errorResponse(
          "Message does not belong to conversation",
          400,
          cors,
        );
      }

      // Verify the requester participates in this conversation. The supabase
      // (user-scoped) client already had RLS visibility on the message row,
      // but we double-check participation explicitly so service-role writes
      // below cannot be triggered for a non-participant.
      const { data: participation, error: pErr } = await supabase
        .from("dm_participants")
        .select("conversation_id")
        .eq("conversation_id", message.conversation_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (pErr || !participation) return errorResponse("Forbidden", 403, cors);

      const { data: existingReaction, error: existingError } =
        await serviceSupabase
          .from("dm_message_reactions")
          .select("id")
          .eq("message_id", messageId)
          .eq("user_id", user.id)
          .eq("emoji", emoji)
          .maybeSingle();

      if (existingError) {
        console.error(
          "[dm-messages] existing reaction lookup error",
          existingError,
        );
        return errorResponse("Failed to update reaction", 500, cors);
      }

      if (existingReaction) {
        const { error: deleteError } = await serviceSupabase
          .from("dm_message_reactions")
          .delete()
          .eq("id", existingReaction.id);

        if (deleteError) {
          console.error("[dm-messages] delete reaction error", deleteError);
          return errorResponse("Failed to update reaction", 500, cors);
        }
      } else {
        const { error: insertError } = await serviceSupabase
          .from("dm_message_reactions")
          .insert({
            message_id: messageId,
            user_id: user.id,
            emoji,
          });

        if (insertError) {
          console.error("[dm-messages] insert reaction error", insertError);
          return errorResponse("Failed to update reaction", 500, cors);
        }
      }

      const { data: reactionRows, error: reactionsError } =
        await serviceSupabase
          .from("dm_message_reactions")
          .select("message_id, user_id, emoji")
          .eq("message_id", messageId)
          .order("created_at", { ascending: true });

      if (reactionsError) {
        console.error(
          "[dm-messages] fetch saved reactions error",
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
      console.error("[dm-messages] PATCH error", error);
      return errorResponse("Internal server error", 500, cors);
    }
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { conversationId, content, replyTo, attachments } = body || {};

      if (!conversationId || typeof conversationId !== "string")
        return errorResponse("conversationId is required", 400, cors);

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

      const { data: participation, error: pErr } = await supabase
        .from("dm_participants")
        .select("conversation_id")
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (pErr || !participation) return errorResponse("Forbidden", 403, cors);

      const sanitizedContent = hasContent ? sanitize(content.trim()) : null;

      const { data: message, error: insertError } = await supabase
        .from("dm_messages")
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          content: sanitizedContent,
          reply_to_id: replyTo || null,
        })
        .select("id, content, user_id, reply_to_id, edited_at, created_at")
        .single();

      if (insertError) {
        console.error("[dm-messages] insert error", insertError);
        return errorResponse("Failed to send message", 500, cors);
      }

      let savedAttachments: unknown[] | undefined;
      if (hasAttachments && message) {
        const rows = (attachments as AttachmentInput[]).map((a) => ({
          message_id: message.id,
          conversation_id: conversationId,
          file_url: a.fileUrl || a.url || a.file_url || "",
          file_path: a.filePath || a.path || a.file_path || null,
          file_name: a.fileName || a.name || a.file_name || "attachment",
          file_type: a.fileType || a.type || a.file_type || "image",
          file_size: a.fileSize || a.size || a.file_size || 0,
          mime_type: a.mimeType || a.mime_type || "application/octet-stream",
        }));

        const { error: attError } = await supabase
          .from("dm_message_attachments")
          .insert(rows);

        if (attError) {
          console.error("[dm-messages] attachment error", attError);
        } else {
          const { data: attData } = await supabase
            .from("dm_message_attachments")
            .select(
              "id, file_url, file_path, file_name, file_type, file_size, mime_type",
            )
            .eq("message_id", message.id);
          savedAttachments = (attData || []).map((a) => ({
            id: a.id,
            fileUrl: a.file_url,
            filePath: a.file_path || undefined,
            fileName: a.file_name,
            fileType: a.file_type,
            fileSize: a.file_size,
            mimeType: a.mime_type,
          }));
        }
      }

      // Author profile (no email).
      const { data: profilesData } = await supabase.rpc("get_safe_profiles", {
        user_ids: [user.id],
      });
      const authorProfile = (profilesData || [])[0] as
        | SafeProfileRow
        | undefined;

      let replyPreview:
        | { id: string; username: string; content: string }
        | undefined;
      if (replyTo) {
        const { data: replyMessage } = await supabase
          .from("dm_messages")
          .select("id, content, user_id, conversation_id")
          .eq("id", replyTo)
          .maybeSingle();
        if (replyMessage && replyMessage.conversation_id === conversationId) {
          const { data: replyProfiles } = await supabase.rpc(
            "get_safe_profiles",
            { user_ids: [replyMessage.user_id] },
          );
          const rp = (replyProfiles || [])[0] as SafeProfileRow | undefined;
          replyPreview = {
            id: replyMessage.id,
            username: rp?.username || "User",
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
        user: toUser(authorProfile, user.id),
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
      console.error("[dm-messages] POST error", error);
      return errorResponse("Internal server error", 500, cors);
    }
  }

  // GET
  const url = new URL(req.url);
  const conversationId = url.searchParams.get("conversationId");
  if (!conversationId)
    return errorResponse("conversationId is required", 400, cors);

  try {
    const { data: participation } = await supabase
      .from("dm_participants")
      .select("conversation_id")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!participation) return errorResponse("Forbidden", 403, cors);

    const before = url.searchParams.get("before");
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "50", 10),
      100,
    );

    let query = supabase
      .from("dm_messages")
      .select("id, content, user_id, reply_to_id, edited_at, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) query = query.lt("created_at", before);

    const { data: messages, error: messagesError } = await query;
    if (messagesError) {
      console.error("[dm-messages] list error", messagesError);
      return errorResponse("Failed to fetch messages", 500, cors);
    }
    if (!messages || messages.length === 0)
      return jsonResponse({ messages: [] }, 200, cors);

    const userIds = [...new Set(messages.map((m) => m.user_id))];
    const replyIds = messages
      .filter((m) => m.reply_to_id)
      .map((m) => m.reply_to_id as string);
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
            .from("dm_messages")
            .select("id, content, user_id")
            .in("id", replyIds)
        : Promise.resolve({ data: null }),
      supabase
        .from("dm_message_attachments")
        .select(
          "id, message_id, file_url, file_path, file_name, file_type, file_size, mime_type",
        )
        .in("message_id", messageIds),
      serviceSupabase
        .from("dm_message_reactions")
        .select("message_id, user_id, emoji")
        .in("message_id", messageIds)
        .order("created_at", { ascending: true }),
    ]);

    if (reactionsResult.error) {
      console.error(
        "[dm-messages] reactions fetch error",
        reactionsResult.error,
      );
    }
    const reactionMap = reactionsResult.error
      ? new Map()
      : mapReactionsByMessage(reactionsResult.data);

    const profileMap = new Map<string, SafeProfileRow>();
    for (const p of (profilesResult.data || []) as SafeProfileRow[])
      profileMap.set(p.id, p);

    const replyMap = new Map<
      string,
      { id: string; username: string; content: string }
    >();
    if (replyMessagesResult.data?.length) {
      const replyUserIds = [
        ...new Set(replyMessagesResult.data.map((m) => m.user_id)),
      ];
      const { data: replyProfiles } = await supabase.rpc("get_safe_profiles", {
        user_ids: replyUserIds,
      });
      const replyProfileMap = new Map<string, SafeProfileRow>();
      for (const p of (replyProfiles || []) as SafeProfileRow[])
        replyProfileMap.set(p.id, p);

      for (const reply of replyMessagesResult.data) {
        const rp = replyProfileMap.get(reply.user_id);
        replyMap.set(reply.id, {
          id: reply.id,
          username: rp?.username || "User",
          content: reply.content
            ? reply.content.length > 100
              ? reply.content.substring(0, 100) + "..."
              : reply.content
            : "",
        });
      }
    }

    const attachmentMap = new Map<string, unknown[]>();
    for (const a of attachmentsResult.data || []) {
      if (!attachmentMap.has(a.message_id)) attachmentMap.set(a.message_id, []);
      attachmentMap.get(a.message_id)!.push({
        id: a.id,
        fileUrl: a.file_url,
        filePath: a.file_path || undefined,
        fileName: a.file_name,
        fileType: a.file_type,
        fileSize: a.file_size,
        mimeType: a.mime_type,
      });
    }

    const formatted = messages.map((m) => {
      const p = profileMap.get(m.user_id);
      return {
        id: m.id,
        user: toUser(p, m.user_id),
        content: m.content,
        timestamp: new Date(m.created_at).getTime(),
        edited: !!m.edited_at,
        replyTo: m.reply_to_id || undefined,
        replyPreview: m.reply_to_id ? replyMap.get(m.reply_to_id) : undefined,
        attachments: attachmentMap.get(m.id),
        reactions: reactionMap.get(m.id) || [],
      };
    });

    formatted.reverse();
    return jsonResponse({ messages: formatted }, 200, cors);
  } catch (error) {
    console.error("[dm-messages] GET error", error);
    return errorResponse("Internal server error", 500, cors);
  }
});
