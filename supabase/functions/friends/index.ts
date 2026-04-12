import { getCorsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getAuthenticatedUser } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET" && req.method !== "DELETE")
    return errorResponse("Method not allowed", 405, cors);

  const auth = await getAuthenticatedUser(req);
  if ("response" in auth) return auth.response;
  const { user, supabase } = auth;

  try {
    // GET - List current user's friends
    if (req.method === "GET") {
      const { data: friendships, error: friendshipsError } = await supabase
        .from("friendships")
        .select("friend_id")
        .eq("user_id", user.id);

      if (friendshipsError) {
        console.error("Error fetching friendships:", friendshipsError);
        return errorResponse("Failed to fetch friends", 500, cors);
      }

      if (!friendships || friendships.length === 0) {
        return jsonResponse({ friends: [] }, 200, cors);
      }

      const friendIds = friendships.map((f: { friend_id: string }) => f.friend_id);

      const { data: profiles, error: profilesError } = await supabase
        .rpc("get_safe_profiles", { user_ids: friendIds });

      if (profilesError) {
        console.error("Error fetching friend profiles:", profilesError);
        return errorResponse("Failed to fetch friend profiles", 500, cors);
      }

      const friends = (profiles || []).map((p: { id: string; username: string; avatar_url: string; role: string }) => ({
        id: p.id,
        username: p.username,
        avatarUrl: p.avatar_url,
        role: p.role,
      }));

      return jsonResponse({ friends }, 200, cors);
    }

    // DELETE - Unfriend a user
    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const friendId = url.searchParams.get("friendId");

      if (!friendId) {
        return errorResponse("Missing friendId parameter", 400, cors);
      }

      const { error: unfriendError } = await supabase
        .rpc("unfriend_user", { uid: user.id, friend: friendId });

      if (unfriendError) {
        console.error("Error unfriending user:", unfriendError);
        return errorResponse("Failed to unfriend user", 500, cors);
      }

      return jsonResponse({ success: true }, 200, cors);
    }
  } catch (err) {
    console.error("Unexpected error in friends function:", err);
    return errorResponse("Internal server error", 500, cors);
  }
});
