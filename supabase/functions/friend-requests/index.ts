import { getCorsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getAuthenticatedUser } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET" && req.method !== "POST" && req.method !== "PATCH")
    return errorResponse("Method not allowed", 405, cors);

  const auth = await getAuthenticatedUser(req);
  if ("response" in auth) return auth.response;
  const { user, supabase } = auth;

  try {
    // GET - List friend requests for the current user
    if (req.method === "GET") {
      const url = new URL(req.url);
      const type = url.searchParams.get("type") || "incoming";

      if (!["incoming", "outgoing", "all"].includes(type)) {
        return errorResponse("Invalid type parameter. Must be incoming, outgoing, or all", 400, cors);
      }

      let requests: { id: string; sender_id: string; receiver_id: string; status: string; created_at: string }[] = [];

      if (type === "incoming" || type === "all") {
        const { data, error } = await supabase
          .from("friend_requests")
          .select("id, sender_id, receiver_id, status, created_at")
          .eq("receiver_id", user.id)
          .eq("status", "pending");

        if (error) {
          console.error("Error fetching incoming friend requests:", error);
          return errorResponse("Failed to fetch incoming requests", 500, cors);
        }

        requests = [...requests, ...(data || [])];
      }

      if (type === "outgoing" || type === "all") {
        const { data, error } = await supabase
          .from("friend_requests")
          .select("id, sender_id, receiver_id, status, created_at")
          .eq("sender_id", user.id)
          .eq("status", "pending");

        if (error) {
          console.error("Error fetching outgoing friend requests:", error);
          return errorResponse("Failed to fetch outgoing requests", 500, cors);
        }

        requests = [...requests, ...(data || [])];
      }

      if (requests.length === 0) {
        return jsonResponse({ requests: [] }, 200, cors);
      }

      // Collect all user IDs we need profiles for (the "other" user in each request)
      const userIds = requests.map((r) =>
        r.sender_id === user.id ? r.receiver_id : r.sender_id
      );
      const uniqueUserIds = [...new Set(userIds)];

      const { data: profiles, error: profilesError } = await supabase
        .rpc("get_safe_profiles", { user_ids: uniqueUserIds });

      if (profilesError) {
        console.error("Error fetching request profiles:", profilesError);
        return errorResponse("Failed to fetch user profiles", 500, cors);
      }

      const profileMap = new Map(
        (profiles || []).map((p: { id: string; username: string; avatar_url: string }) => [p.id, p])
      );

      const formattedRequests = requests.map((r) => {
        const otherUserId = r.sender_id === user.id ? r.receiver_id : r.sender_id;
        const profile = profileMap.get(otherUserId) as { id: string; username: string; avatar_url: string } | undefined;

        return {
          id: r.id,
          senderId: r.sender_id,
          receiverId: r.receiver_id,
          status: r.status,
          createdAt: r.created_at,
          user: profile
            ? { id: profile.id, username: profile.username, avatarUrl: profile.avatar_url }
            : { id: otherUserId, username: "Unknown", avatarUrl: null },
        };
      });

      return jsonResponse({ requests: formattedRequests }, 200, cors);
    }

    // POST - Send a friend request
    if (req.method === "POST") {
      const body = await req.json();
      const { receiverId } = body;

      if (!receiverId) {
        return errorResponse("Missing receiverId", 400, cors);
      }

      if (receiverId === user.id) {
        return errorResponse("Cannot send a friend request to yourself", 400, cors);
      }

      const { data, error } = await supabase
        .rpc("send_friend_request", { sender: user.id, receiver: receiverId });

      if (error) {
        console.error("Error sending friend request:", error);
        return errorResponse(error.message || "Failed to send friend request", 400, cors);
      }

      return jsonResponse({ success: true, data }, 200, cors);
    }

    // PATCH - Accept or reject a friend request
    if (req.method === "PATCH") {
      const body = await req.json();
      const { requestId, action } = body;

      if (!requestId || !action) {
        return errorResponse("Missing requestId or action", 400, cors);
      }

      if (!["accept", "reject"].includes(action)) {
        return errorResponse("Invalid action. Must be accept or reject", 400, cors);
      }

      if (action === "accept") {
        const { data, error } = await supabase
          .rpc("accept_friend_request", { request_id: requestId, accepting_user: user.id });

        if (error) {
          console.error("Error accepting friend request:", error);
          return errorResponse(error.message || "Failed to accept friend request", 400, cors);
        }

        return jsonResponse({ success: true, data }, 200, cors);
      }

      if (action === "reject") {
        const { data, error } = await supabase
          .from("friend_requests")
          .update({ status: "rejected" })
          .eq("id", requestId)
          .eq("receiver_id", user.id)
          .eq("status", "pending")
          .select()
          .single();

        if (error) {
          console.error("Error rejecting friend request:", error);
          return errorResponse("Failed to reject friend request", 400, cors);
        }

        if (!data) {
          return errorResponse("Friend request not found or already handled", 404, cors);
        }

        return jsonResponse({ success: true }, 200, cors);
      }
    }
  } catch (err) {
    console.error("Unexpected error in friend-requests function:", err);
    return errorResponse("Internal server error", 500, cors);
  }
});
