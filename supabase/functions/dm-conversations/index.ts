import {
  getCorsHeaders,
  handleCors,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";
import { getAuthenticatedUser } from "../_shared/auth.ts";

interface SafeProfile {
  id: string;
  username: string;
  avatarUrl: string;
  role?: string;
}

function toSafeProfile(p: {
  id: string;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
}): SafeProfile {
  return {
    id: p.id,
    username: p.username || "User",
    avatarUrl: p.avatar_url || "",
    ...(p.role ? { role: p.role } : {}),
  };
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET" && req.method !== "POST")
    return errorResponse("Method not allowed", 405, cors);

  const auth = await getAuthenticatedUser(req);
  if ("response" in auth) return auth.response;
  const { user, supabase } = auth;

  if (req.method === "GET") {
    try {
      // Conversations the caller participates in.
      const { data: myParticipations, error: pErr } = await supabase
        .from("dm_participants")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (pErr) {
        console.error("[dm-conversations] participants error", pErr);
        return errorResponse("Failed to load conversations", 500, cors);
      }

      const conversationIds = (myParticipations || []).map(
        (p) => p.conversation_id,
      );
      if (conversationIds.length === 0)
        return jsonResponse({ conversations: [] }, 200, cors);

      const [
        conversationsRes,
        otherParticipantsRes,
        unreadRes,
        lastMessagesRes,
      ] = await Promise.all([
        supabase
          .from("dm_conversations")
          .select("id, created_at, updated_at, last_message_at")
          .in("id", conversationIds)
          .order("last_message_at", {
            ascending: false,
            nullsFirst: false,
          }),
        supabase
          .from("dm_participants")
          .select("conversation_id, user_id")
          .in("conversation_id", conversationIds)
          .neq("user_id", user.id),
        supabase
          .from("dm_unread_messages")
          .select("conversation_id, unread_count, last_read_at")
          .in("conversation_id", conversationIds)
          .eq("user_id", user.id),
        // Last message per conversation: fetch a window large enough to cover
        // each conversation's newest, then keep first per id in code.
        supabase
          .from("dm_messages")
          .select("id, conversation_id, content, user_id, created_at")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false })
          .limit(conversationIds.length * 5),
      ]);

      if (conversationsRes.error) {
        console.error("[dm-conversations] list error", conversationsRes.error);
        return errorResponse("Failed to load conversations", 500, cors);
      }

      const otherIds = [
        ...new Set((otherParticipantsRes.data || []).map((p) => p.user_id)),
      ];
      const { data: profilesData } = await supabase.rpc("get_safe_profiles", {
        user_ids: otherIds,
      });
      const profileMap = new Map<string, SafeProfile>();
      for (const p of profilesData || [])
        profileMap.set(p.id, toSafeProfile(p));

      const otherByConversation = new Map<string, string>();
      for (const p of otherParticipantsRes.data || []) {
        if (!otherByConversation.has(p.conversation_id))
          otherByConversation.set(p.conversation_id, p.user_id);
      }

      const unreadByConversation = new Map<
        string,
        { unreadCount: number; lastReadAt: string | null }
      >();
      for (const r of unreadRes.data || []) {
        unreadByConversation.set(r.conversation_id, {
          unreadCount: r.unread_count || 0,
          lastReadAt: r.last_read_at || null,
        });
      }

      // Track attachment presence for last messages we surface.
      const lastMessageByConversation = new Map<
        string,
        {
          id: string;
          content: string | null;
          userId: string;
          createdAt: number;
        }
      >();
      for (const m of lastMessagesRes.data || []) {
        if (!lastMessageByConversation.has(m.conversation_id)) {
          lastMessageByConversation.set(m.conversation_id, {
            id: m.id,
            content: m.content,
            userId: m.user_id,
            createdAt: new Date(m.created_at).getTime(),
          });
        }
      }

      const lastMessageIds = [...lastMessageByConversation.values()].map(
        (m) => m.id,
      );
      let attachmentMessageIds = new Set<string>();
      if (lastMessageIds.length > 0) {
        const { data: atts } = await supabase
          .from("dm_message_attachments")
          .select("message_id")
          .in("message_id", lastMessageIds);
        attachmentMessageIds = new Set((atts || []).map((a) => a.message_id));
      }

      const conversations = (conversationsRes.data || []).map((c) => {
        const otherId = otherByConversation.get(c.id);
        const otherUser = otherId ? profileMap.get(otherId) : undefined;
        const unread = unreadByConversation.get(c.id);
        const lm = lastMessageByConversation.get(c.id);
        return {
          id: c.id,
          otherUser: otherUser || null,
          lastMessageAt: c.last_message_at
            ? new Date(c.last_message_at).getTime()
            : null,
          unreadCount: unread?.unreadCount || 0,
          lastReadAt: unread?.lastReadAt
            ? new Date(unread.lastReadAt).getTime()
            : null,
          lastMessage: lm
            ? {
                id: lm.id,
                content: lm.content,
                userId: lm.userId,
                createdAt: lm.createdAt,
                hasAttachments: attachmentMessageIds.has(lm.id),
              }
            : null,
        };
      });

      return jsonResponse({ conversations }, 200, cors);
    } catch (error) {
      console.error("[dm-conversations] GET error", error);
      return errorResponse("Internal server error", 500, cors);
    }
  }

  // POST { friendId } -> open or create
  try {
    const body = await req.json();
    const friendId = body?.friendId;
    if (typeof friendId !== "string" || friendId.length === 0)
      return errorResponse("friendId is required", 400, cors);
    if (friendId === user.id)
      return errorResponse("Cannot DM yourself", 400, cors);

    const { data: conversationId, error } = await supabase.rpc(
      "open_or_create_dm_conversation",
      { p_friend_id: friendId },
    );

    if (error) {
      console.error("[dm-conversations] rpc error", error);
      return errorResponse(
        error.message || "Failed to open conversation",
        400,
        cors,
      );
    }

    // Fetch other-user profile for convenience.
    const { data: profilesData } = await supabase.rpc("get_safe_profiles", {
      user_ids: [friendId],
    });
    const otherUser = profilesData?.[0] ? toSafeProfile(profilesData[0]) : null;

    return jsonResponse(
      {
        conversation: {
          id: conversationId,
          otherUser,
          lastMessageAt: null,
          unreadCount: 0,
          lastReadAt: null,
          lastMessage: null,
        },
      },
      200,
      cors,
    );
  } catch (error) {
    console.error("[dm-conversations] POST error", error);
    return errorResponse("Internal server error", 500, cors);
  }
});
