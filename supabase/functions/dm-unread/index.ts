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

  if (req.method === "GET") {
    const url = new URL(req.url);
    const conversationId = url.searchParams.get("conversationId");
    if (!conversationId)
      return errorResponse("conversationId is required", 400, cors);

    try {
      const { data } = await supabase
        .from("dm_unread_messages")
        .select("unread_count, last_read_at")
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();

      return jsonResponse(
        {
          unreadCount: data?.unread_count || 0,
          lastReadAt: data?.last_read_at || null,
        },
        200,
        cors,
      );
    } catch (error) {
      console.error("[dm-unread] GET error", error);
      return errorResponse("Internal server error", 500, cors);
    }
  }

  // POST -> reset
  try {
    const body = await req.json();
    const conversationId = body?.conversationId;
    if (typeof conversationId !== "string" || conversationId.length === 0)
      return errorResponse("conversationId is required", 400, cors);

    const { error } = await supabase.rpc("reset_dm_unread_count", {
      p_conversation_id: conversationId,
      p_user_id: user.id,
    });

    if (error) {
      console.error("[dm-unread] reset rpc error", error);
      return errorResponse(
        error.message || "Failed to reset unread count",
        400,
        cors,
      );
    }

    return jsonResponse(
      {
        unreadCount: 0,
        lastReadAt: new Date().toISOString(),
      },
      200,
      cors,
    );
  } catch (error) {
    console.error("[dm-unread] POST error", error);
    return errorResponse("Internal server error", 500, cors);
  }
});
