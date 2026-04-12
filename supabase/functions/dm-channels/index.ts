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

  try {
    // GET - List user's DM channels with last message preview
    if (req.method === "GET") {
      const { data: channels, error: channelsError } = await supabase
        .from("dm_channels")
        .select("id, user1_id, user2_id, created_at")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (channelsError) {
        console.error("Error fetching DM channels:", channelsError);
        return errorResponse("Failed to fetch DM channels", 500, cors);
      }

      if (!channels || channels.length === 0) {
        return jsonResponse({ channels: [] }, 200, cors);
      }

      // Determine the "other user" for each channel
      const otherUserIds = channels.map(
        (ch: { user1_id: string; user2_id: string }) =>
          ch.user1_id === user.id ? ch.user2_id : ch.user1_id,
      );

      // Fetch profiles for all other users
      const { data: profiles, error: profilesError } = await supabase.rpc(
        "get_safe_profiles",
        { user_ids: otherUserIds },
      );

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        return errorResponse("Failed to fetch user profiles", 500, cors);
      }

      const profileMap = new Map(
        (profiles || []).map(
          (p: { id: string; username: string; avatar_url: string }) => [
            p.id,
            { id: p.id, username: p.username, avatarUrl: p.avatar_url },
          ],
        ),
      );

      // Fetch latest message for each channel
      const channelIds = channels.map((ch: { id: string }) => ch.id);

      const { data: latestMessages, error: messagesError } = await supabase
        .from("dm_messages")
        .select("dm_channel_id, content, created_at, user_id")
        .in("dm_channel_id", channelIds)
        .order("created_at", { ascending: false });

      if (messagesError) {
        console.error("Error fetching latest messages:", messagesError);
        return errorResponse("Failed to fetch messages", 500, cors);
      }

      // Build a map of channel_id -> latest message (first occurrence since ordered desc)
      const lastMessageMap = new Map<
        string,
        { content: string; timestamp: string; senderId: string }
      >();
      for (const msg of latestMessages || []) {
        if (!lastMessageMap.has(msg.dm_channel_id)) {
          lastMessageMap.set(msg.dm_channel_id, {
            content: msg.content,
            timestamp: msg.created_at,
            senderId: msg.user_id,
          });
        }
      }

      // Fetch unread counts for current user
      const { data: unreadRows, error: unreadError } = await supabase
        .from("dm_unread_messages")
        .select("dm_channel_id, unread_count")
        .eq("user_id", user.id)
        .in("dm_channel_id", channelIds);

      if (unreadError) {
        console.error("Error fetching unread counts:", unreadError);
        return errorResponse("Failed to fetch unread counts", 500, cors);
      }

      const unreadMap = new Map(
        (unreadRows || []).map(
          (r: { dm_channel_id: string; unread_count: number }) => [
            r.dm_channel_id,
            r.unread_count,
          ],
        ),
      );

      // Build response
      const result = channels.map(
        (ch: {
          id: string;
          user1_id: string;
          user2_id: string;
          created_at: string;
        }) => {
          const otherUserId =
            ch.user1_id === user.id ? ch.user2_id : ch.user1_id;
          const otherUser = profileMap.get(otherUserId) || {
            id: otherUserId,
            username: "Unknown",
            avatarUrl: null,
          };
          const lastMessage = lastMessageMap.get(ch.id) || null;
          const unreadCount = unreadMap.get(ch.id) || 0;

          return {
            id: ch.id,
            otherUser,
            lastMessage,
            unreadCount,
            createdAt: ch.created_at,
          };
        },
      );

      // Sort: most recent message first, channels with no messages last
      result.sort(
        (
          a: { lastMessage: { timestamp: string } | null },
          b: { lastMessage: { timestamp: string } | null },
        ) => {
          if (!a.lastMessage && !b.lastMessage) return 0;
          if (!a.lastMessage) return 1;
          if (!b.lastMessage) return -1;
          return (
            new Date(b.lastMessage.timestamp).getTime() -
            new Date(a.lastMessage.timestamp).getTime()
          );
        },
      );

      return jsonResponse({ channels: result }, 200, cors);
    }

    // POST - Get or create a DM channel
    if (req.method === "POST") {
      const body = await req.json();
      const { userId } = body;

      if (!userId) {
        return errorResponse("Missing userId in request body", 400, cors);
      }

      if (userId === user.id) {
        return errorResponse(
          "Cannot create a DM channel with yourself",
          400,
          cors,
        );
      }

      // Check permission
      const { data: canDm, error: canDmError } = await supabase.rpc(
        "can_dm_user",
        { sender: user.id, receiver: userId },
      );

      if (canDmError) {
        console.error("Error checking DM permission:", canDmError);
        return errorResponse("Failed to check DM permission", 500, cors);
      }

      if (!canDm) {
        return errorResponse("You cannot message this user", 403, cors);
      }

      // Get or create channel
      const { data: channelId, error: channelError } = await supabase.rpc(
        "get_or_create_dm_channel",
        { uid1: user.id, uid2: userId },
      );

      if (channelError) {
        console.error("Error getting/creating DM channel:", channelError);
        return errorResponse("Failed to get or create DM channel", 500, cors);
      }

      // Fetch the other user's profile
      const { data: profiles, error: profileError } = await supabase.rpc(
        "get_safe_profiles",
        { user_ids: [userId] },
      );

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        return errorResponse("Failed to fetch user profile", 500, cors);
      }

      const otherUser =
        profiles && profiles.length > 0
          ? {
              id: profiles[0].id,
              username: profiles[0].username,
              avatarUrl: profiles[0].avatar_url,
            }
          : { id: userId, username: "Unknown", avatarUrl: null };

      return jsonResponse(
        {
          channel: {
            id: channelId,
            otherUser,
          },
        },
        200,
        cors,
      );
    }
  } catch (err) {
    console.error("Unexpected error in dm-channels function:", err);
    return errorResponse("Internal server error", 500, cors);
  }
});
