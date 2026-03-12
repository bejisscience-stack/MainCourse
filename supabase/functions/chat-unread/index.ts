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

  if (req.method !== "POST" && req.method !== "GET")
    return errorResponse("Method not allowed", 405, cors);

  const auth = await getAuthenticatedUser(req);
  if ("response" in auth) return auth.response;
  const { user, supabase } = auth;

  // GET - Fetch unread count for a channel
  if (req.method === "GET") {
    const url = new URL(req.url);
    const chatId = url.searchParams.get("chatId");
    if (!chatId) return errorResponse("chatId is required", 400, cors);

    try {
      const { data: unreadData } = await supabase
        .from("unread_messages")
        .select("unread_count")
        .eq("channel_id", chatId)
        .eq("user_id", user.id)
        .single();

      return jsonResponse(
        { unreadCount: unreadData?.unread_count || 0 },
        200,
        cors,
      );
    } catch (error) {
      console.error("Error:", error);
      return errorResponse("Internal server error", 500, cors);
    }
  }

  // POST - Mark channel as read (reset unread count)
  try {
    const body = await req.json();
    const { chatId } = body;
    if (!chatId) return errorResponse("chatId is required", 400, cors);

    const { data: channel, error: channelError } = await supabase
      .from("channels")
      .select("id, course_id")
      .eq("id", chatId)
      .single();

    if (channelError || !channel)
      return errorResponse("Channel not found", 404, cors);

    const { data: unreadData, error: resetError } = await supabase
      .from("unread_messages")
      .upsert(
        {
          channel_id: chatId,
          course_id: channel.course_id,
          user_id: user.id,
          unread_count: 0,
          last_read_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "channel_id,user_id" },
      )
      .select("last_read_at")
      .single();

    if (resetError) {
      return jsonResponse(
        { error: "Failed to reset unread count", details: resetError.message },
        500,
        cors,
      );
    }

    return jsonResponse(
      {
        unreadCount: 0,
        lastReadAt: unreadData.last_read_at,
      },
      200,
      cors,
    );
  } catch (error) {
    console.error("Error:", error);
    return errorResponse("Internal server error", 500, cors);
  }
});
